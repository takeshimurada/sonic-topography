"""API 응답 디버깅 스크립트"""
import asyncio
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Album

async def debug_albums():
    """백엔드 API 응답 형식 확인"""
    async with AsyncSessionLocal() as session:
        # 첫 5개 앨범 조회
        stmt = select(Album).limit(5)
        result = await session.execute(stmt)
        albums = result.scalars().all()
        
        print("=== 백엔드 데이터 샘플 ===\n")
        for album in albums:
            data = {
                "id": album.id,
                "title": album.title,
                "artist_name": album.artist_name,
                "year": album.year,
                "genre": album.genre,
                "genre_vibe": album.genre_vibe,
                "region_bucket": album.region_bucket,
                "country": album.country,
                "popularity": album.popularity,
                "cover_url": album.cover_url
            }
            print(json.dumps(data, indent=2, ensure_ascii=False))
            print()

if __name__ == "__main__":
    asyncio.run(debug_albums())
