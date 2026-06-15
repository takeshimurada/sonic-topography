import asyncio
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import engine, Base
from .routers import health, albums, artists, users, research

app = FastAPI(title="Sonic Topography API")

@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "type": type(exc).__name__, "trace": traceback.format_exc()[-2000:]})

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "https://music-mapmap.pages.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def _init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("DB init complete")
    except Exception as e:
        print(f"DB init failed (non-fatal): {e}")

@app.on_event("startup")
async def startup():
    asyncio.create_task(_init_db())

app.include_router(health.router)
app.include_router(albums.router)
app.include_router(artists.router)
app.include_router(users.router)
app.include_router(research.router)
