"""API 테스트 스크립트"""
import asyncio
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models import Album

async def test_api():
    """API 엔드포인트 데이터 테스트"""
    async with AsyncSessionLocal() as session:
        # 총 앨범 수 확인
        result = await session.execute(select(func.count(Album.id)))
        total = result.scalar()
        print(f"✅ 총 앨범 수: {total}개")
        
        # 최근 10개 앨범 조회
        stmt = select(Album).order_by(Album.year.desc()).limit(10)
        result = await session.execute(stmt)
        albums = result.scalars().all()
        
        print(f"\n📀 최근 앨범 10개:")
        for album in albums:
            print(f"  - {album.year}: {album.artist_name} - {album.title} ({album.genre})")
        
        # 연도별 분포
        stmt = select(Album.year, func.count(Album.id)).group_by(Album.year).order_by(Album.year)
        result = await session.execute(stmt)
        year_dist = result.all()
        
        print(f"\n📊 연도별 분포 (샘플):")
        for year, count in year_dist[:10]:
            print(f"  {year}: {count}개")
        
        # 장르별 분포
        stmt = select(Album.genre, func.count(Album.id)).group_by(Album.genre).order_by(func.count(Album.id).desc()).limit(10)
        result = await session.execute(stmt)
        genre_dist = result.all()
        
        print(f"\n🎵 인기 장르 TOP 10:")
        for genre, count in genre_dist:
            print(f"  {genre}: {count}개")
        
        # 지역별 분포
        stmt = select(Album.region_bucket, func.count(Album.id)).group_by(Album.region_bucket).order_by(func.count(Album.id).desc())
        result = await session.execute(stmt)
        region_dist = result.all()
        
        print(f"\n🌍 지역별 분포:")
        for region, count in region_dist:
            print(f"  {region}: {count}개")
        
        # 맵 포인트 시뮬레이션 (zoom=3.0)
        stmt = select(Album).where(Album.year >= 1960, Album.year <= 2024).limit(5)
        result = await session.execute(stmt)
        sample_albums = result.scalars().all()
        
        print(f"\n🗺️  맵 포인트 샘플 (5개):")
        for album in sample_albums:
            print(f"  - x:{album.year}, y:{album.genre_vibe:.2f}, r:{album.popularity*10+2:.1f}, color:{album.region_bucket}")
            print(f"    {album.artist_name} - {album.title}")

if __name__ == "__main__":
    asyncio.run(test_api())
