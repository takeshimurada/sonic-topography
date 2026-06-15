from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import asyncpg
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://sonic:0416@db:5432/sonic_db")

def _build_engine():
    parsed = urlparse(DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    is_external = parsed.hostname and "render.com" in parsed.hostname

    if is_external:
        host = parsed.hostname
        port = parsed.port or 5432
        user = parsed.username
        password = parsed.password
        database = parsed.path.lstrip("/")

        async def _creator(**kw):
            return await asyncpg.connect(
                host=host, port=port,
                user=user, password=password,
                database=database,
                ssl="require",
            )

        return create_async_engine(
            "postgresql+asyncpg://",
            async_creator=_creator,
            echo=False,
        )

    return create_async_engine(DATABASE_URL, echo=False)

engine = _build_engine()
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
