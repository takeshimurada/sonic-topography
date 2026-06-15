import os
import asyncpg
from fastapi import APIRouter

router = APIRouter()

_DB_URL = os.getenv("DATABASE_URL", "")

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/health/db")
async def health_db():
    """Diagnostic: test raw asyncpg connection with ssl=require"""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(_DB_URL.replace("postgresql+asyncpg://", "postgresql://"))
        conn = await asyncpg.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip("/"),
            ssl="require",
            timeout=10,
        )
        row = await conn.fetchval("SELECT version()")
        await conn.close()
        return {"status": "ok", "pg_version": row}
    except Exception as e:
        return {"status": "error", "type": type(e).__name__, "msg": str(e)}
