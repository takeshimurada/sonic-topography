from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import ssl

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://sonic:0416@db:5432/sonic_db")

# External Render DB URLs require SSL; local/internal URLs do not
_connect_args = {}
if "render.com" in DATABASE_URL:
    _ssl_ctx = ssl.create_default_context()
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=_connect_args)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
