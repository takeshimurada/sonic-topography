"""
Seed roles dictionary.

Usage:
  docker exec sonic_backend python scripts/db/seed/seed-roles.py
"""

import asyncio
import uuid
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Docker 컨테이너 내부에서는 /app이 루트
sys.path.insert(0, "/app")

from app.database import DATABASE_URL
from app.models import Role

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

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        existing = await session.execute(select(Role.role_name))
        existing_names = set(existing.scalars().all())

        to_insert = []
        for name, group in ROLE_SEED:
            if name in existing_names:
                continue
            to_insert.append(Role(
                role_id=f"local:role:{uuid.uuid4()}",
                role_name=name,
                role_group=group
            ))

        if not to_insert:
            print("✅ roles: already seeded")
            return

        session.add_all(to_insert)
        await session.commit()
        print(f"✅ roles: inserted {len(to_insert)}")

if __name__ == "__main__":
    asyncio.run(main())
