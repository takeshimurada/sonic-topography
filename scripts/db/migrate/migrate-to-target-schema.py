"""
Migration to target schema.

This script:
1) Creates new tables.
2) Migrates existing data from old tables when present.
3) Seeds roles (minimal).

Usage:
  docker exec sonic_backend python scripts/db/migrate/migrate-to-target-schema.py
"""

import asyncio
import json
import uuid
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select

# Docker 컨테이너 내부에서는 /app이 루트
sys.path.insert(0, "/app")

from app.database import DATABASE_URL, Base
from app.models import (
    CreatorIdMap,
    Creator,
    CreatorSpotifyProfile,
    AlbumGroup,
    Release,
    Track,
    Role,
    AlbumCredit,
    TrackCredit,
    AlbumLink,
    MapNode,
    UserAlbumAction,
    CreatorLink,
    CulturalAsset,
    AssetLink,
)

ROLE_SEED = [
    ("Primary Artist", "artist"),
    ("Featured Artist", "artist"),
    ("Producer", "production"),
    ("Co-Producer", "production"),
    ("Executive Producer", "production"),
    ("Composer", "writing"),
    ("Lyricist", "writing"),
    ("Arranger", "writing"),
    ("Recording Engineer", "engineering"),
    ("Mixing Engineer", "engineering"),
    ("Mastering Engineer", "engineering"),
    ("Assistant Engineer", "engineering"),
    ("Lead Vocals", "performance"),
    ("Backing Vocals", "performance"),
]

def namespaced_creator(raw_id: str) -> str:
    return f"spotify:artist:{raw_id}"

async def table_exists(session: AsyncSession, name: str) -> bool:
    result = await session.execute(text("SELECT to_regclass(:name)"), {"name": name})
    return result.scalar() is not None

async def column_exists(session: AsyncSession, table: str, column: str) -> bool:
    result = await session.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table AND column_name = :column
    """), {"table": table, "column": column})
    return result.first() is not None

async def seed_roles(session: AsyncSession):
    existing = await session.execute(select(Role.role_name))
    existing_names = set(existing.scalars().all())
    for name, group in ROLE_SEED:
        if name in existing_names:
            continue
        session.add(Role(
            role_id=f"local:role:{uuid.uuid4()}",
            role_name=name,
            role_group=group
        ))
    await session.commit()

async def ensure_role(session: AsyncSession, role_name: str, role_group: str = "other") -> str:
    result = await session.execute(select(Role).where(Role.role_name == role_name))
    role = result.scalars().first()
    if role:
        return role.role_id
    role_id = f"local:role:{uuid.uuid4()}"
    session.add(Role(role_id=role_id, role_name=role_name, role_group=role_group))
    await session.commit()
    return role_id

async def migrate_creators_from_artists(session: AsyncSession):
    if not await table_exists(session, "artists"):
        print("ℹ️  artists table not found, skipping creators migration.")
        return

    rows = await session.execute(text("SELECT id, name, genres, popularity, followers, image_url, spotify_url FROM artists"))
    for row in rows.fetchall():
        old_id = row.id
        new_id = namespaced_creator(old_id)
        session.add(CreatorIdMap(old_id=old_id, new_id=new_id))
        session.add(Creator(
            creator_id=new_id,
            display_name=row.name,
            image_url=row.image_url,
            kind="person",
            primary_role_tag="artist"
        ))
        session.add(CreatorSpotifyProfile(
            creator_id=new_id,
            genres=row.genres or [],
            popularity=row.popularity,
            followers=row.followers,
            spotify_url=row.spotify_url
        ))
    await session.commit()
    print("✅ creators migrated from artists")

async def migrate_album_groups(session: AsyncSession):
    if not await table_exists(session, "albums"):
        print("ℹ️  albums table not found, skipping album_groups migration.")
        return
    existing = await session.execute(text("SELECT album_group_id FROM album_groups"))
    existing_ids = set(r[0] for r in existing.fetchall())
    rows = await session.execute(text("""
        SELECT id, title, artist_name, year, country, genre, popularity, cover_url, genre_vibe
        FROM albums
    """))
    for row in rows.fetchall():
        if row.id in existing_ids:
            continue
        session.add(AlbumGroup(
            album_group_id=row.id,
            title=row.title,
            primary_artist_display=row.artist_name,
            original_year=row.year,
            country_code=row.country,
            primary_genre=row.genre,
            popularity=row.popularity,
            cover_url=row.cover_url
        ))
        session.add(MapNode(
            album_group_id=row.id,
            x=row.year or 0,
            y=row.genre_vibe or 0.5,
            size=(row.popularity or 0) * 10 + 2
        ))
        session.add(Release(
            release_id=f"local:release:{uuid.uuid4()}",
            album_group_id=row.id,
            release_title=row.title
        ))
    await session.commit()
    print("✅ album_groups + map_nodes + releases migrated")

async def migrate_album_details(session: AsyncSession):
    if not await table_exists(session, "album_details"):
        return
    rows = await session.execute(text("SELECT album_id, tracklist, external_links FROM album_details"))
    for row in rows.fetchall():
        # tracks
        tracklist = row.tracklist or []
        if tracklist:
            release = await session.execute(text("""
                SELECT release_id FROM releases WHERE album_group_id = :album_id LIMIT 1
            """), {"album_id": row.album_id})
            release_id = release.scalar()
            for idx, item in enumerate(tracklist, start=1):
                title = item if isinstance(item, str) else item.get("title")
                duration = None if isinstance(item, str) else item.get("duration_ms")
                session.add(Track(
                    track_id=f"local:track:{uuid.uuid4()}",
                    release_id=release_id,
                    disc_no=1,
                    track_no=idx,
                    title=title,
                    duration_ms=duration
                ))
        # links
        links = row.external_links or []
        for link in links:
            url = link.get("url") if isinstance(link, dict) else None
            if not url:
                continue
            provider = link.get("provider", "other") if isinstance(link, dict) else "other"
            session.add(AlbumLink(
                album_group_id=row.album_id,
                provider=provider,
                url=url,
                external_id=link.get("external_id")
            ))
    await session.commit()
    print("✅ album_details migrated to tracks + album_links")

async def migrate_album_credits(session: AsyncSession):
    source_table = None
    if await table_exists(session, "album_credits_legacy"):
        source_table = "album_credits_legacy"
    elif await table_exists(session, "album_credits"):
        # legacy schema?
        if await column_exists(session, "album_credits", "album_id") and not await column_exists(session, "album_credits", "album_group_id"):
            source_table = "album_credits"
        else:
            # already migrated schema, skip
            print("ℹ️  album_credits already migrated, skipping.")
            return
    else:
        print("ℹ️  album_credits table not found, skipping.")
        return

    rows = await session.execute(text(f"SELECT album_id, person_name, role FROM {source_table}"))
    for row in rows.fetchall():
        role_id = await ensure_role(session, row.role, "other")
        # find or create creator for person_name
        creator = await session.execute(select(Creator).where(Creator.display_name == row.person_name))
        creator_row = creator.scalars().first()
        if not creator_row:
            creator_id = f"local:creator:{uuid.uuid4()}"
            creator_row = Creator(
                creator_id=creator_id,
                display_name=row.person_name,
                kind="person",
                primary_role_tag=row.role
            )
            session.add(creator_row)
            await session.commit()
        session.add(AlbumCredit(
            album_group_id=row.album_id,
            creator_id=creator_row.creator_id,
            role_id=role_id
        ))
    await session.commit()
    print("✅ album_credits migrated")

async def migrate_user_ratings(session: AsyncSession):
    if not await table_exists(session, "user_ratings"):
        return
    rows = await session.execute(text("SELECT user_id, album_id, rating, listened_at FROM user_ratings"))
    for row in rows.fetchall():
        session.add(UserAlbumAction(
            user_id=row.user_id,
            album_group_id=row.album_id,
            status="listened",
            rating=row.rating
        ))
    await session.commit()
    print("✅ user_ratings migrated to user_album_actions")

async def migrate_ai_research(session: AsyncSession):
    if not await table_exists(session, "ai_research"):
        return
    rows = await session.execute(text("SELECT id, album_id, summary_md FROM ai_research"))
    for row in rows.fetchall():
        asset_id = f"local:asset:{uuid.uuid4()}"
        session.add(CulturalAsset(
            asset_id=asset_id,
            asset_type="article",
            title=f"AI Research {row.album_id}",
            url=f"local:ai_research:{row.id}",
            summary=row.summary_md
        ))
        session.add(AssetLink(
            asset_id=asset_id,
            entity_type="album_group",
            entity_id=row.album_id,
            link_type="about"
        ))
    await session.commit()
    print("✅ ai_research migrated to cultural_assets (duplicated)")

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # if legacy album_credits exists, rename it so new table can be created
        result = await conn.execute(text("SELECT to_regclass('album_credits')"))
        has_album_credits = result.scalar() is not None
        if has_album_credits:
            result = await conn.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'album_credits' AND column_name = 'album_group_id'
            """))
            has_new_column = result.first() is not None
            if not has_new_column:
                await conn.execute(text("ALTER TABLE album_credits RENAME TO album_credits_legacy"))

        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed_roles(session)
        await migrate_creators_from_artists(session)
        await migrate_album_groups(session)
        await migrate_album_details(session)
        await migrate_album_credits(session)
        await migrate_user_ratings(session)
        await migrate_ai_research(session)

    print("✅ target schema migration completed")

if __name__ == "__main__":
    asyncio.run(main())
