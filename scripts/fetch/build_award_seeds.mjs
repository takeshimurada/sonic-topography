import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const SOURCES_FILE = path.join(ROOT, "scripts", "fetch", "award_sources.json");
const OUT_FILE = path.join(ROOT, "scripts", "fetch", "award_seeds.json");

const WIKI_API = "https://en.wikipedia.org/w/api.php";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sonic-topography/award-seed-builder" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sonic-topography/award-seed-builder" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function cleanText(input) {
  if (!input) return "";
  let text = input;
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function decodeEntities(text) {
  if (!text) return "";
  let out = text;
  out = out.replace(/&nbsp;/g, " ");
  out = out.replace(/&amp;/g, "&");
  out = out.replace(/&quot;/g, "\"");
  out = out.replace(/&apos;/g, "'");
  out = out.replace(/&#39;/g, "'");
  out = out.replace(/&lt;/g, "<");
  out = out.replace(/&gt;/g, ">");
  out = out.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return out;
}

function htmlToText(html) {
  if (!html) return "";
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "");
  text = text.replace(/<sup[^>]*>.*?<\/sup>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<\/?[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/\[\d+\]/g, "");
  text = text.replace(/\s+\n/g, "\n");
  text = text.replace(/\n\s+/g, "\n");
  return text.trim();
}

function normalizeQuery(album, artist) {
  const a = album.replace(/"/g, '\\"');
  const b = artist.replace(/"/g, '\\"');
  return `album:"${a}" artist:"${b}"`;
}

function sanitizeAlbumTitle(title) {
  let t = cleanText(title);
  t = t.split(/\s*\(|\s*\[|\s*;|\s*\|/)[0].trim();
  return t;
}

function sanitizeArtistName(name) {
  let t = cleanText(name);
  t = t.split(/\s*\(|\s*\[|\s*;|\s*\|/)[0].trim();
  return t;
}

function extractPairsFromText(text) {
  const pairs = [];
  if (!text) return pairs;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^(.+?)\s+[\u2013\u2014-]\s+(.+)$/);
    if (!match) continue;
    const left = match[1].trim();
    const right = match[2].trim();
    if (!left || !right) continue;
    pairs.push({ artist: left, album: right });
  }
  return pairs;
}

function extractSeedsFromHtml(html) {
  const seeds = [];
  const tables = html.match(/<table[^>]*class="wikitable[^"]*"[\s\S]*?<\/table>/g) || [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];
    let header = null;
    let currentYear = null;

    for (const row of rows) {
      const cellMatches = row.match(/<(t[hd])[\s\S]*?<\/t[hd]>/g) || [];
      if (!cellMatches.length) continue;

      const cellTexts = cellMatches.map((c) => htmlToText(c));
      const rowText = cellTexts.join(" ");
      const yearMatch = rowText.match(/(?:19|20)\d{2}/);
      if (yearMatch) currentYear = Number(yearMatch[0]);

      const hasYearHeader = cellTexts.some((t) => /year/i.test(t));
      const hasAlbumHeader = cellTexts.some((t) => /album|work/i.test(t));
      const hasArtistHeader = cellTexts.some((t) => /artist|winner|nominee|recipient/i.test(t));
      const isHeader = row.includes("<th") && hasYearHeader && hasAlbumHeader && hasArtistHeader;
      if (isHeader) {
        header = cellTexts.map((t) => t.toLowerCase());
        continue;
      }

      if (!header) continue;

      const albumIndex = header.findIndex((t) => t.includes("album") || t.includes("work"));
      const artistIndex = header.findIndex((t) => t.includes("artist"));
      const winnerIndex = header.findIndex((t) => t.includes("winner") || t.includes("recipient"));
      const nomineesIndex = header.findIndex((t) => t.includes("nominee"));

      if (albumIndex >= 0 && (artistIndex >= 0 || winnerIndex >= 0)) {
        const albumRaw = cellTexts[albumIndex] || "";
        const artistRaw = cellTexts[artistIndex >= 0 ? artistIndex : winnerIndex] || "";
        const album = sanitizeAlbumTitle(albumRaw);
        const artist = sanitizeArtistName(artistRaw);
        if (album && artist && !/song/i.test(album)) {
          seeds.push({ album, artist, year: currentYear });
        }
      }

      if (nomineesIndex >= 0) {
        const nomineeRaw = cellTexts[nomineesIndex] || "";
        const pairs = extractPairsFromText(nomineeRaw);
        for (const pair of pairs) {
          const album = sanitizeAlbumTitle(pair.album);
          const artist = sanitizeArtistName(pair.artist);
          if (album && artist && !/song/i.test(album)) {
            seeds.push({ album, artist, year: currentYear });
          }
        }
      }
    }
  }
  return seeds;
}

async function listCategoryMembers(categoryTitle) {
  const members = [];
  let cmcontinue = "";
  do {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", categoryTitle);
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");
    if (cmcontinue) url.searchParams.set("cmcontinue", cmcontinue);
    const json = await fetchJson(url.toString());
    const items = json?.query?.categorymembers || [];
    for (const item of items) {
      if (item?.title) members.push(item.title);
    }
    cmcontinue = json?.continue?.cmcontinue || "";
  } while (cmcontinue);
  return members;
}

async function fetchHtml(title) {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  return fetchText(url);
}

function uniqueSeeds(seeds) {
  const seen = new Set();
  const out = [];
  for (const seed of seeds) {
    if (!seed) continue;
    let key = "";
    if (seed.query) {
      key = String(seed.query).toLowerCase();
    } else if (seed.album && seed.artist) {
      key = `${seed.album.toLowerCase()}|||${seed.artist.toLowerCase()}`;
    } else {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seed);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SOURCES_FILE)) {
    console.error(`Missing sources file: ${SOURCES_FILE}`);
    process.exit(1);
  }

  const rawSources = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8"));
  const sources = Array.isArray(rawSources?.sources) ? rawSources.sources : [];
  if (!sources.length) {
    console.error("No sources found in award_sources.json");
    process.exit(1);
  }

  const allSeeds = [];
  const sourceUrls = [];
  const existingSeeds = [];

  if (fs.existsSync(OUT_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
      if (Array.isArray(prev?.seeds)) {
        for (const seed of prev.seeds) {
          if (seed?.query) {
            existingSeeds.push(seed);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  for (const src of sources) {
    if (!src?.kind) continue;

    let titles = [];
    if (src.kind === "wikipedia-category") {
      const categoryTitle = src.category;
      if (!categoryTitle) continue;
      console.log(`Category: ${categoryTitle}`);
      titles = await listCategoryMembers(categoryTitle);
      sourceUrls.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(categoryTitle)}`);
    } else if (src.kind === "wikipedia-page") {
      if (!src.title) continue;
      titles = [src.title];
      sourceUrls.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(src.title)}`);
    } else {
      continue;
    }

    for (const title of titles) {
      try {
        const html = await fetchHtml(title);
        const extracted = extractSeedsFromHtml(html);
        for (const seed of extracted) {
          allSeeds.push({
            type: "album",
            query: normalizeQuery(seed.album, seed.artist),
            source: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            award: src.award || null,
            region: src.region || null,
            year: seed.year || null
          });
        }
      } catch (e) {
        console.warn(`  Failed: ${title} (${e.message})`);
      }
      await sleep(250);
    }
  }

  const deduped = uniqueSeeds([...existingSeeds, ...allSeeds]);
  const output = {
    generatedAt: new Date().toISOString(),
    notes: rawSources?.notes || "Generated from award_sources.json",
    sources: sourceUrls,
    seeds: deduped
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nWrote ${deduped.length} seeds to ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
