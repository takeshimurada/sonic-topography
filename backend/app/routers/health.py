import os
import ssl
import socket
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
    parsed = urlparse(_DB_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0])
    host = parsed.hostname
    port = parsed.port or 5432
    user = parsed.username
    password = parsed.password
    database = parsed.path.lstrip("/")
    native_dsn = f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode=require"

    results = {}

    # DNS check
    try:
        results["dns"] = {"ok": True, "ip": socket.gethostbyname(host)}
    except Exception as e:
        results["dns"] = {"ok": False, "msg": str(e)}

    # Test 1: ssl="require" (asyncpg string mode)
    try:
        conn = await asyncpg.connect(host=host, port=port, user=user,
            password=password, database=database, ssl="require", timeout=8)
        results["ssl_require"] = {"ok": True, "v": await conn.fetchval("SELECT version()")}
        await conn.close()
    except Exception as e:
        results["ssl_require"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    # Test 2: ssl=True (create_default_context — verifies cert)
    try:
        conn = await asyncpg.connect(host=host, port=port, user=user,
            password=password, database=database, ssl=True, timeout=8)
        results["ssl_true"] = {"ok": True, "v": await conn.fetchval("SELECT version()")}
        await conn.close()
    except Exception as e:
        results["ssl_true"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    # Test 3: native DSN with ?sslmode=require
    try:
        conn = await asyncpg.connect(native_dsn, timeout=8)
        results["sslmode_dsn"] = {"ok": True, "v": await conn.fetchval("SELECT version()")}
        await conn.close()
    except Exception as e:
        results["sslmode_dsn"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    # Test 4: PROTOCOL_TLS with minimal settings
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        conn = await asyncpg.connect(host=host, port=port, user=user,
            password=password, database=database, ssl=ctx, timeout=8)
        results["ssl_ctx"] = {"ok": True, "v": await conn.fetchval("SELECT version()")}
        await conn.close()
    except Exception as e:
        results["ssl_ctx"] = {"ok": False, "type": type(e).__name__, "msg": str(e)}

    return results
