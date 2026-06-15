import os
import asyncpg
from fastapi import APIRouter
from urllib.parse import urlparse

router = APIRouter()

_DB_URL = os.getenv("DATABASE_URL", "")

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/health/db")
async def health_db():
    """Diagnostic: test multiple connection modes"""
    parsed = urlparse(_DB_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0])
    host = parsed.hostname
    port = parsed.port or 5432
    user = parsed.username
    password = parsed.password
    database = parsed.path.lstrip("/")

    results = {}

    # Test 1: ssl=require
    try:
        conn = await asyncpg.connect(host=host, port=port, user=user,
            password=password, database=database, ssl="require", timeout=8)
        row = await conn.fetchval("SELECT version()")
        await conn.close()
        results["ssl_require"] = {"ok": True, "version": row}
    except Exception as e:
        results["ssl_require"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    # Test 2: ssl=False (no SSL)
    try:
        conn = await asyncpg.connect(host=host, port=port, user=user,
            password=password, database=database, ssl=False, timeout=8)
        row = await conn.fetchval("SELECT version()")
        await conn.close()
        results["ssl_false"] = {"ok": True, "version": row}
    except Exception as e:
        results["ssl_false"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    # Test 3: dns resolution check
    import socket
    try:
        ip = socket.gethostbyname(host)
        results["dns"] = {"ok": True, "host": host, "ip": ip}
    except Exception as e:
        results["dns"] = {"ok": False, "host": host, "msg": str(e)}

    return results
