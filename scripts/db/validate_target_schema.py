"""
Validate target schema integrity.

Checks:
1) FK integrity for credits and tracks.
2) Role references exist.
3) creator_id namespace (spotify:artist: prefix for spotify creators).
4) No raw artist ids remain in creator_id_map usage tables.

Usage:
  docker exec sonic_backend python scripts/db/validate_target_schema.py
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Docker 컨테이너 내부에서는 /app이 루트
sys.path.insert(0, "/app")

from app.database import DATABASE_URL

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # helper: table exists
        async def table_exists(name: str) -> bool:
            result = await session.execute(text("SELECT to_regclass(:name)"), {"name": name})
            return result.scalar() is not None

        async def column_exists(table: str, column: str) -> bool:
            result = await session.execute(text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table AND column_name = :column
            """), {"table": table, "column": column})
            return result.first() is not None

        # track_credits -> tracks
        if await table_exists("track_credits"):
            result = await session.execute(text("""
                SELECT COUNT(*) 
                FROM track_credits tc
                LEFT JOIN tracks t ON tc.track_id = t.track_id
                WHERE t.track_id IS NULL
            """))
            missing_tracks = result.scalar()
            print(f"✅ track_credits -> tracks missing: {missing_tracks}")
        else:
            print("⚠️ track_credits table missing (skip)")

        # album_credits -> album_groups
        if await table_exists("album_credits"):
            if await column_exists("album_credits", "album_group_id"):
                result = await session.execute(text("""
                    SELECT COUNT(*) 
                    FROM album_credits ac
                    LEFT JOIN album_groups ag ON ac.album_group_id = ag.album_group_id
                    WHERE ag.album_group_id IS NULL
                """))
                missing_album_groups = result.scalar()
                print(f"✅ album_credits -> album_groups missing: {missing_album_groups}")
            elif await column_exists("album_credits", "album_id"):
                print("⚠️ album_credits uses legacy column album_id (skip FK check to album_groups)")
            else:
                print("⚠️ album_credits missing album_group_id/album_id (skip)")
        else:
            print("⚠️ album_credits table missing (skip)")

        # role refs
        if await table_exists("album_credits") and await table_exists("roles"):
            if await column_exists("album_credits", "role_id"):
                result = await session.execute(text("""
                    SELECT COUNT(*) 
                    FROM album_credits ac
                    LEFT JOIN roles r ON ac.role_id = r.role_id
                    WHERE r.role_id IS NULL
                """))
                missing_roles = result.scalar()
                print(f"✅ album_credits -> roles missing: {missing_roles}")
            else:
                print("⚠️ album_credits uses legacy role column (skip roles FK check)")
        else:
            print("⚠️ roles/album_credits table missing (skip)")

        # creator namespace check (spotify creators)
        result = await session.execute(text("""
            SELECT COUNT(*) FROM creators
            WHERE creator_id LIKE 'spotify:artist:%'
        """))
        spotify_creators = result.scalar()

        result = await session.execute(text("SELECT COUNT(*) FROM creators"))
        total_creators = result.scalar()
        print(f"✅ creators with spotify namespace: {spotify_creators}/{total_creators}")

        # raw id leakage (simple heuristic)
        result = await session.execute(text("""
            SELECT COUNT(*) FROM creators
            WHERE creator_id ~ '^[A-Za-z0-9]{20,}$'
        """))
        raw_like = result.scalar()
        print(f"✅ raw id looking creators: {raw_like}")

    print("✅ validation completed")

if __name__ == "__main__":
    asyncio.run(main())
