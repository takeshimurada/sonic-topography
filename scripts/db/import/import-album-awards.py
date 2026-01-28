"""
Import award/list badges from seed files into album_awards table.

Usage:
  docker exec sonic_backend python scripts/db/import/import-album-awards.py
"""

import asyncio
import json
import re
import uuid
import unicodedata
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

import sys
sys.path.insert(0, "/app")

from app.database import DATABASE_URL, Base
from app.models import AlbumGroup, AlbumAward

DEFAULT_SEED_FILES = [
    "/app/scripts/fetch/award_seeds.json",
    "/app/scripts/fetch/award_seeds_alltime.json",
]

def normalize_text(value: str) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())

def parse_query(query: str):
    if not query:
        return None, None
    album = None
    artist = None
    match = re.search(r'album:"([^"]+)"', query)
    if match:
        album = match.group(1).strip()
    match = re.search(r'artist:"([^"]+)"', query)
    if match:
        artist = match.group(1).strip()
    return album, artist

def load_seeds(path: Path, default_award_kind: str):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    seeds = data.get("seeds", [])
    for seed in seeds:
        if "award_kind" not in seed and default_award_kind:
            seed["award_kind"] = default_award_kind
    return seeds

def build_album_index(albums):
    by_album_artist = {}
    by_album_artist_year = {}
    for album in albums:
        title = normalize_text(album.title)
        artist = normalize_text(album.primary_artist_display)
        if not title or not artist:
            continue
        key = f"{title}|||{artist}"
        by_album_artist.setdefault(key, []).append(album.album_group_id)
        if album.original_year:
            key_year = f"{title}|||{artist}|||{album.original_year}"
            by_album_artist_year.setdefault(key_year, []).append(album.album_group_id)
    return by_album_artist, by_album_artist_year

def find_album_id(by_album_artist, by_album_artist_year, title, artist, year):
    norm_title = normalize_text(title)
    norm_artist = normalize_text(artist)
    if not norm_title or not norm_artist:
        return None
    if year:
        key_year = f"{norm_title}|||{norm_artist}|||{year}"
        if key_year in by_album_artist_year:
            return by_album_artist_year[key_year][0]
    key = f"{norm_title}|||{norm_artist}"
    if key in by_album_artist:
        return by_album_artist[key][0]
    return None

async def main():
    seeds = []
    for path in DEFAULT_SEED_FILES:
        default_kind = "list" if "alltime" in path else "award"
        seeds.extend(load_seeds(Path(path), default_kind))

    if not seeds:
        print("⚠️  No seeds loaded. Skipping album_awards import.")
        return

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        albums_res = await session.execute(select(AlbumGroup))
        albums = albums_res.scalars().all()

        existing_res = await session.execute(
            select(
                AlbumAward.album_group_id,
                AlbumAward.award_name,
                AlbumAward.award_year,
                AlbumAward.award_result,
                AlbumAward.source_url
            )
        )
        existing = set(existing_res.all())

    by_album_artist, by_album_artist_year = build_album_index(albums)

    new_awards = []
    skipped_no_match = 0
    skipped_no_award = 0

    for seed in seeds:
        album = seed.get("album")
        artist = seed.get("artist")
        if not album or not artist:
            album, artist = parse_query(seed.get("query", ""))
        if not album or not artist:
            skipped_no_match += 1
            continue

        awards = seed.get("awards") or seed.get("award")
        if isinstance(awards, str):
            awards = [awards]
        if not awards:
            skipped_no_award += 1
            continue

        sources = seed.get("sources") or seed.get("source")
        if isinstance(sources, str):
            sources = [sources]

        year = seed.get("year")
        album_id = find_album_id(by_album_artist, by_album_artist_year, album, artist, year)
        if not album_id:
            skipped_no_match += 1
            continue

        award_kind = seed.get("award_kind") or "award"

        for award_name in awards:
            key = (album_id, award_name, year, None, (sources[0] if sources else None))
            if key in existing:
                continue
            existing.add(key)
            new_awards.append(AlbumAward(
                album_award_id=f"local:album_award:{uuid.uuid4()}",
                album_group_id=album_id,
                award_name=award_name,
                award_kind=award_kind,
                award_year=year,
                award_result=seed.get("award_result"),
                award_category=seed.get("award_category"),
                source_url=sources[0] if sources else None,
                sources=sources,
                region=seed.get("region"),
                country=seed.get("country"),
                genre_tags=seed.get("genreTags")
            ))

    print(f"✅ album_awards to insert: {len(new_awards)}")
    print(f"⚠️  skipped (no award): {skipped_no_award}")
    print(f"⚠️  skipped (no match): {skipped_no_match}")

    if not new_awards:
        return

    async with async_session() as session:
        session.add_all(new_awards)
        await session.commit()

    print("✅ album_awards import complete.")

if __name__ == "__main__":
    asyncio.run(main())
