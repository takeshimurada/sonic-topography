from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from urllib.parse import urlparse, parse_qs

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://sonic:0416@db:5432/sonic_db")

def _build_engine():
    parsed = urlparse(DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    is_external = parsed.hostname and "render.com" in parsed.hostname

    if is_external:
        # Parse query params to check if ssl=require is already specified
        qs = parse_qs(parsed.query)
        ssl_mode = qs.get("ssl", ["require"])[0]
        # Strip query string from URL so asyncpg doesn't double-parse it
        clean_url = DATABASE_URL.split("?")[0]
        return create_async_engine(
            clean_url,
            echo=False,
            connect_args={"ssl": ssl_mode},
        )
    return create_async_engine(DATABASE_URL, echo=False)

engine = _build_engine()
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
