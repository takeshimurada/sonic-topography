import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const SOURCES_FILE = path.join(ROOT, "scripts", "fetch", "award_sources_alltime.json");
const OUT_FILE = path.join(ROOT, "scripts", "fetch", "award_seeds_alltime.json");
const OUT_FILE_ALBUM_ONLY = path.join(ROOT, "scripts", "fetch", "award_seeds_alltime_album_only.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sonic-topography/alltime-seed-builder" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
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
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "\n");
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

function decodeJsonEscapes(text) {
  if (!text) return "";
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function cleanText(input) {
  if (!input) return "";
  let text = input;
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function stripFormatting(input) {
  if (!input) return "";
  let text = input;
  text = text.replace(/\[(.*?)\]\([^)]*\)/g, "$1");
  text = text.replace(/[*_`~]/g, "");
  text = text.replace(/[“”]/g, "\"");
  return cleanText(text);
}

function sanitizeAlbumTitle(title) {
  let t = stripFormatting(title);
  t = t.replace(/^["']+|["']+$/g, "");
  t = t.split(/\s*\(|\s*\[|\s*;|\s*\|/)[0].trim();
  return t;
}

function sanitizeArtistName(name) {
  let t = stripFormatting(name);
  t = t.replace(/^["']+|["']+$/g, "");
  t = t.split(/\s*\(|\s*\[|\s*;|\s*\|/)[0].trim();
  return t;
}

function normalizeQuery(album, artist) {
  const a = album.replace(/"/g, '\\"');
  const b = artist.replace(/"/g, '\\"');
  return `album:"${a}" artist:"${b}"`;
}

function normalizeAlbumOnlyQuery(album) {
  const a = album.replace(/"/g, '\\"');
  return `album:"${a}"`;
}

function parseAlbumAndYear(input) {
  const raw = stripFormatting(input);
  if (!raw) return { album: "", year: null };
  let year = null;
  let title = raw;
  let match = raw.match(/\((\d{4})\)\s*$/);
  if (!match) match = raw.match(/\[(\d{4})\]\s*$/);
  if (!match) match = raw.match(/,\s*(\d{4})\s*$/);
  if (!match) match = raw.match(/[-\u2013\u2014]\s*(\d{4})\s*$/);
  if (match) {
    year = Number(match[1]);
    title = raw.replace(match[0], "").trim();
  }
  return { album: sanitizeAlbumTitle(title), year };
}

function extractAlbumOnlyFromText(text) {
  const seeds = [];
  if (!text) return seeds;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleaned = stripFormatting(line).replace(/^(no\.?|#)?\s*\d+\.?\s+/i, "");
    const albumYear = parseAlbumAndYear(cleaned);
    if (albumYear.album && albumYear.year) {
      seeds.push({ album: albumYear.album, year: albumYear.year });
    }
  }
  return seeds;
}

function extractPairsFromText(text, options = {}) {
  const pairs = [];
  if (!text) return pairs;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const rankMatch = line.match(/^(no\.?|#)?\s*(\d+)\.?\s+/i);
    const rank = rankMatch ? Number(rankMatch[2]) : null;
    if (options.requireRank && rank == null) continue;
    if (options.maxRank && rank != null && rank > options.maxRank) continue;
    let cleaned = stripFormatting(line).replace(/^(no\.?|#)?\s*\d+\.?\s+/i, "");
    let match = cleaned.match(/^(.+?)\s*[\u2013\u2014:\-]\s*(.+)$/);
    if (!match) match = cleaned.match(/^(.+?),\s+(.+)$/);
    if (!match) match = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
    if (!match) continue;
    const left = match[1].trim();
    const right = match[2].trim();
    if (!left || !right) continue;
    if (/^.+\s+by\s+.+$/i.test(cleaned)) {
      pairs.push({ album: left, artist: right, rank });
    } else {
      pairs.push({ artist: left, album: right, rank });
    }
  }
  return pairs;
}

function extractFromWikipediaTables(html) {
  const seeds = [];
  const tables = html.match(/<table[^>]*class="wikitable[^"]*"[\s\S]*?<\/table>/g) || [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];
    let header = null;
    for (const row of rows) {
      const cellMatches = row.match(/<(t[hd])[\s\S]*?<\/t[hd]>/g) || [];
      if (!cellMatches.length) continue;

      const cellTexts = cellMatches.map((c) => htmlToText(c));
      const hasAlbum = cellTexts.some((t) => /album|work/i.test(t));
      const hasArtist = cellTexts.some((t) => /artist|band/i.test(t));
      const hasRank = cellTexts.some((t) => /rank|position|no\.?|number/i.test(t));
      const isHeader = row.includes("<th") && hasAlbum && hasArtist && hasRank;
      if (isHeader) {
        header = cellTexts.map((t) => t.toLowerCase());
        continue;
      }

      if (!header) continue;
      const albumIndex = header.findIndex((t) => t.includes("album") || t.includes("work"));
      const artistIndex = header.findIndex((t) => t.includes("artist") || t.includes("band"));
      if (albumIndex < 0 || artistIndex < 0) continue;

      const albumRaw = cellTexts[albumIndex] || "";
      const artistRaw = cellTexts[artistIndex] || "";
      const album = sanitizeAlbumTitle(albumRaw);
      const artist = sanitizeArtistName(artistRaw);
      if (!album || !artist) continue;
      seeds.push({ album, artist });
    }
  }
  return seeds;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((c) => c.trim());
}

async function parseCsvUrl(url, columns) {
  const text = await fetchText(url);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const artistKey = columns?.artist || "Artist";
  const albumKey = columns?.album || "Album";
  const artistIndex = header.findIndex((h) => h === artistKey);
  const albumIndex = header.findIndex((h) => h === albumKey);
  if (artistIndex < 0 || albumIndex < 0) return [];
  const seeds = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const artistRaw = cells[artistIndex] || "";
    const albumRaw = cells[albumIndex] || "";
    const artist = sanitizeArtistName(artistRaw);
    const album = sanitizeAlbumTitle(albumRaw);
    if (artist && album) {
      seeds.push({ artist, album });
    }
  }
  return seeds;
}

async function parseListChallenges(url) {
  const seeds = [];
  const albumOnlySeeds = [];
  const firstPage = await fetchText(url);
  const pageMatch = firstPage.match(/Page\s+1\s+of\s+(\d+)/i);
  const totalPages = pageMatch ? Number(pageMatch[1]) : 1;
  const parsePage = (html) => {
    const items = Array.from(html.matchAll(/<div class="item-name">\s*([^<]+)\s*<\/div>/g)).map((m) => m[1].trim());
    for (const item of items) {
      const pairs = extractPairsFromText(item);
      if (pairs.length > 0) {
        for (const pair of pairs) {
          const albumParsed = parseAlbumAndYear(pair.album);
          const artist = sanitizeArtistName(pair.artist);
          if (albumParsed.album && artist) seeds.push({ album: albumParsed.album, artist, year: albumParsed.year });
        }
      } else {
        for (const albumOnly of extractAlbumOnlyFromText(item)) {
          if (albumOnly.album && albumOnly.year) albumOnlySeeds.push(albumOnly);
        }
      }
    }
  };

  parsePage(firstPage);
  for (let page = 2; page <= totalPages; page += 1) {
    const pageUrl = `${url}?page=${page}`;
    try {
      const html = await fetchText(pageUrl);
      parsePage(html);
    } catch (e) {
      console.warn(`  ListChallenges failed: ${pageUrl} (${e.message})`);
    }
    await sleep(120);
  }
  return { seeds, albumOnlySeeds };
}

async function parseMarkdownList(url) {
  const text = await fetchText(url);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const seeds = [];
  for (const line of lines) {
    if (!/^\d+\.|^\*|^-/.test(line)) continue;
    const cleaned = stripFormatting(line).replace(/^\s*(\d+\.|\*|-)\s+/, "");
    const pairs = extractPairsFromText(cleaned);
    for (const pair of pairs) {
      const album = sanitizeAlbumTitle(pair.album);
      const artist = sanitizeArtistName(pair.artist);
      if (album && artist) seeds.push({ album, artist });
    }
  }
  return seeds;
}

function extractFromScripts(html) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const out = [];
  for (const script of scripts) {
    const content = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    const decoded = decodeJsonEscapes(content);
    out.push(decoded);
  }
  return out.join("\n");
}

async function parseHtmlTextList(url, options = {}) {
  const html = await fetchText(url);
  const combinedText = `${htmlToText(html)}\n${extractFromScripts(html)}`;
  const seeds = [];
  const seenRanks = new Set();
  for (const pair of extractPairsFromText(combinedText, options)) {
    if (options.requireRank && pair.rank != null) {
      if (seenRanks.has(pair.rank)) continue;
      seenRanks.add(pair.rank);
    }
    const album = sanitizeAlbumTitle(pair.album);
    const artist = sanitizeArtistName(pair.artist);
    if (album && artist) seeds.push({ album, artist });
  }
  return seeds;
}

async function parseGuardianSeries(url) {
  const links = new Set();
  let rssUrl = `${url}/rss`;
  try {
    const html = await fetchText(url);
    const rssMatch = html.match(/href="(https:\/\/www\.theguardian\.com\/music\/series\/1000-albums-to-hear-before-you-die\/rss)"/);
    if (rssMatch?.[1]) rssUrl = rssMatch[1];
  } catch (e) {
    console.warn(`  Guardian series failed: ${url} (${e.message})`);
  }
  try {
    const rss = await fetchText(rssUrl);
    const linkMatches = Array.from(rss.matchAll(/<link>(https:\/\/www\.theguardian\.com\/music\/[^<]+)<\/link>/g));
    for (const match of linkMatches) {
      if (!match[1].includes("/series/")) links.add(match[1]);
    }
  } catch (e) {
    console.warn(`  Guardian RSS failed: ${rssUrl} (${e.message})`);
  }

  // Series "all" pages list the per-letter articles for Nov 17-23, 2007
  const days = [17, 18, 19, 20, 21, 22, 23];
  for (const day of days) {
    const dayStr = String(day).padStart(2, "0");
    const dayUrl = `https://www.theguardian.com/music/series/1000-albums-to-hear-before-you-die/2007/nov/${dayStr}/all`;
    try {
      const html = await fetchText(dayUrl);
      const linkMatches = Array.from(html.matchAll(/href="(https:\/\/www\.theguardian\.com\/music\/2007\/nov\/\d{2}\/1000tohearbeforeyoudie[^"]*)"/g));
      for (const match of linkMatches) {
        links.add(match[1]);
      }
    } catch (e) {
      console.warn(`  Guardian day failed: ${dayUrl} (${e.message})`);
    }
    await sleep(120);
  }

  const seeds = [];
  for (const link of Array.from(links)) {
    try {
      const page = await fetchText(link);
      const text = htmlToText(page);
      const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!/(19|20)\d{2}/.test(line)) continue;
        for (const pair of extractPairsFromText(line)) {
          const album = sanitizeAlbumTitle(pair.album);
          const artist = sanitizeArtistName(pair.artist);
          if (album && artist) seeds.push({ album, artist });
        }
      }
    } catch (e) {
      console.warn(`  Guardian failed: ${link} (${e.message})`);
    }
    await sleep(150);
  }
  return seeds;
}

function uniqueSeeds(seeds) {
  const seen = new Map();
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
    if (seen.has(key)) {
      const existing = seen.get(key);
      const merge = (field, value) => {
        if (!value) return;
        if (!existing[field]) existing[field] = [];
        if (!Array.isArray(existing[field])) existing[field] = [existing[field]];
        if (Array.isArray(value)) {
          for (const v of value) if (v && !existing[field].includes(v)) existing[field].push(v);
        } else if (!existing[field].includes(value)) {
          existing[field].push(value);
        }
      };
      merge("awards", seed.award || seed.awards);
      merge("sources", seed.source || seed.sources);
      merge("regions", seed.region || seed.regions);
      merge("countries", seed.country || seed.countries);
      merge("genreTags", seed.genreTags);
      if (!existing.year && seed.year) existing.year = seed.year;
      continue;
    }
    seen.set(key, seed);
    out.push(seed);
  }
  return out;
}

function uniqueAlbumOnlySeeds(seeds) {
  const seen = new Map();
  const out = [];
  for (const seed of seeds) {
    if (!seed?.album) continue;
    const key = `${seed.album.toLowerCase()}|||${seed.year || ""}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      const merge = (field, value) => {
        if (!value) return;
        if (!existing[field]) existing[field] = [];
        if (!Array.isArray(existing[field])) existing[field] = [existing[field]];
        if (Array.isArray(value)) {
          for (const v of value) if (v && !existing[field].includes(v)) existing[field].push(v);
        } else if (!existing[field].includes(value)) {
          existing[field].push(value);
        }
      };
      merge("awards", seed.award || seed.awards);
      merge("sources", seed.source || seed.sources);
      merge("regions", seed.region || seed.regions);
      merge("countries", seed.country || seed.countries);
      merge("genreTags", seed.genreTags);
      if (!existing.year && seed.year) existing.year = seed.year;
      continue;
    }
    seen.set(key, seed);
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
    console.error("No sources found in award_sources_alltime.json");
    process.exit(1);
  }

  const allSeeds = [];
  const albumOnlySeeds = [];
  const sourceUrls = [];

  for (const src of sources) {
    if (src.kind === "wikipedia-page") {
      const url = `https://en.wikipedia.org/wiki/${src.title}`;
      sourceUrls.push(url);
      try {
        const html = await fetchText(url);
        const extracted = extractFromWikipediaTables(html);
        console.log(`Wikipedia ${src.id}: ${extracted.length} seeds`);
        for (const seed of extracted) {
          const albumParsed = parseAlbumAndYear(seed.album);
          allSeeds.push({
            type: "album",
            album: albumParsed.album,
            artist: seed.artist,
            query: normalizeQuery(albumParsed.album, seed.artist),
            source: url,
            award: src.award || null,
            region: src.region || null,
            country: src.country || null,
            genreTags: src.genreTags || null,
            year: albumParsed.year || null
          });
        }
      } catch (e) {
        console.warn(`  Wikipedia failed: ${url} (${e.message})`);
      }
    } else if (src.kind === "csv-url") {
      sourceUrls.push(src.url);
      try {
        const extracted = await parseCsvUrl(src.url, src.columns);
        console.log(`CSV ${src.id}: ${extracted.length} seeds`);
        for (const seed of extracted) {
          const albumParsed = parseAlbumAndYear(seed.album);
          allSeeds.push({
            type: "album",
            album: albumParsed.album,
            artist: seed.artist,
            query: normalizeQuery(albumParsed.album, seed.artist),
            source: src.url,
            award: src.award || null,
            region: src.region || null,
            country: src.country || null,
            genreTags: src.genreTags || null,
            year: albumParsed.year || null
          });
        }
      } catch (e) {
        console.warn(`  CSV failed: ${src.url} (${e.message})`);
      }
    } else if (src.kind === "markdown-list") {
      sourceUrls.push(src.url);
      try {
        const extracted = await parseMarkdownList(src.url);
        console.log(`Markdown ${src.id}: ${extracted.length} seeds`);
        for (const seed of extracted) {
          const albumParsed = parseAlbumAndYear(seed.album);
          allSeeds.push({
            type: "album",
            album: albumParsed.album,
            artist: seed.artist,
            query: normalizeQuery(albumParsed.album, seed.artist),
            source: src.url,
            award: src.award || null,
            region: src.region || null,
            country: src.country || null,
            genreTags: src.genreTags || null,
            year: albumParsed.year || null
          });
        }
      } catch (e) {
        console.warn(`  Markdown failed: ${src.url} (${e.message})`);
      }
    } else if (src.kind === "listchallenges") {
      sourceUrls.push(src.url);
      try {
        const extracted = await parseListChallenges(src.url);
        console.log(`ListChallenges ${src.id}: ${extracted.seeds.length} seeds`);
        for (const seed of extracted.seeds) {
          allSeeds.push({
            type: "album",
            album: seed.album,
            artist: seed.artist,
            query: normalizeQuery(seed.album, seed.artist),
            source: src.url,
            award: src.award || null,
            region: src.region || null,
            country: src.country || null,
            genreTags: src.genreTags || null,
            year: seed.year || null
          });
        }
        for (const seed of extracted.albumOnlySeeds) {
          albumOnlySeeds.push({
            type: "album",
            album: seed.album,
            query: normalizeAlbumOnlyQuery(seed.album),
            source: src.url,
            award: src.award || null,
            region: src.region || null,
            country: src.country || null,
            genreTags: src.genreTags || null,
            year: seed.year || null
          });
        }
      } catch (e) {
        console.warn(`  ListChallenges failed: ${src.url} (${e.message})`);
      }
    } else if (src.kind === "guardian-series") {
      sourceUrls.push(src.url);
      const extracted = await parseGuardianSeries(src.url);
      console.log(`Guardian ${src.id}: ${extracted.length} seeds`);
      for (const seed of extracted) {
        const albumParsed = parseAlbumAndYear(seed.album);
        allSeeds.push({
          type: "album",
          album: albumParsed.album,
          artist: seed.artist,
          query: normalizeQuery(albumParsed.album, seed.artist),
          source: src.url,
          award: src.award || null,
          region: src.region || null,
          country: src.country || null,
          genreTags: src.genreTags || null,
          year: albumParsed.year || null
        });
      }
    } else if (src.kind === "html-text-list" || src.kind === "pitchfork-article") {
      sourceUrls.push(src.url);
      const extracted = await parseHtmlTextList(src.url, { requireRank: Boolean(src.requireRank), maxRank: src.maxRank || null });
      console.log(`HTML ${src.id}: ${extracted.length} seeds`);
      for (const seed of extracted) {
        const albumParsed = parseAlbumAndYear(seed.album);
        allSeeds.push({
          type: "album",
          album: albumParsed.album,
          artist: seed.artist,
          query: normalizeQuery(albumParsed.album, seed.artist),
          source: src.url,
          award: src.award || null,
          region: src.region || null,
          country: src.country || null,
          genreTags: src.genreTags || null,
          year: albumParsed.year || null
        });
      }
    }
    await sleep(250);
  }

  const deduped = uniqueSeeds(allSeeds);
  const dedupedAlbumOnly = uniqueAlbumOnlySeeds(albumOnlySeeds);
  const output = {
    generatedAt: new Date().toISOString(),
    notes: rawSources?.notes || "Generated from award_sources_alltime.json",
    sources: sourceUrls,
    seeds: deduped
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nWrote ${deduped.length} seeds to ${OUT_FILE}`);

  if (dedupedAlbumOnly.length > 0) {
    const albumOnlyOutput = {
      generatedAt: new Date().toISOString(),
      notes: "Album-only seeds (missing artist) for later enrichment.",
      sources: sourceUrls,
      seeds: dedupedAlbumOnly
    };
    fs.writeFileSync(OUT_FILE_ALBUM_ONLY, JSON.stringify(albumOnlyOutput, null, 2), "utf-8");
    console.log(`Wrote ${dedupedAlbumOnly.length} album-only seeds to ${OUT_FILE_ALBUM_ONLY}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
