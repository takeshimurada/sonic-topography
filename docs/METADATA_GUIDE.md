# 🎵 메타데이터 수집 가이드

아티스트, 협업 아티스트, 크레딧 정보를 수집하고 DB에 저장하는 가이드입니다.

## 📋 목차

1. [Phase 1: 아티스트 기본 정보](#phase-1-아티스트-기본-정보)
2. [Phase 2: 협업 아티스트](#phase-2-협업-아티스트)
3. [Phase 3: 크레딧 정보](#phase-3-크레딧-정보)
4. [DB 임포트](#db-임포트)
5. [전체 프로세스](#전체-프로세스)

---

## 🗄️ DB 구조

### 새로운 테이블

```sql
-- 아티스트 정보
artists (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  genres JSON,
  popularity INTEGER,
  followers INTEGER,
  image_url VARCHAR,
  spotify_url VARCHAR
)

-- 앨범-아티스트 관계 (N:N)
album_artists (
  id SERIAL PRIMARY KEY,
  album_id VARCHAR REFERENCES albums(id),
  artist_id VARCHAR REFERENCES artists(id),
  role VARCHAR,  -- 'main', 'featured', 'remixer'
  order INTEGER
)

-- 크레딧 정보
album_credits (
  id SERIAL PRIMARY KEY,
  album_id VARCHAR REFERENCES albums(id),
  person_name VARCHAR,
  role VARCHAR,  -- 'producer', 'composer', 'engineer'
  source VARCHAR  -- 'spotify', 'musicbrainz', 'manual'
)
```

---

## 🚀 Phase 1: 아티스트 기본 정보

### 기능
- Spotify API로 아티스트 상세 정보 수집
- 장르, 인기도, 팔로워, 이미지 등

### 실행

```bash
npm run fetch:artists
```

### 소요 시간
- 1,000개 아티스트 기준: **약 5분**
- 50개씩 배치 처리로 빠르게 수집

### 결과 파일
```
out/artists_spotify.json
{
  "generatedAt": "2026-01-20T...",
  "totalArtists": 1000,
  "artists": {
    "4TMHGUX5WI7OOm53PqSDAT": {
      "id": "4TMHGUX5WI7OOm53PqSDAT",
      "name": "Grateful Dead",
      "genres": ["jam band", "psychedelic rock"],
      "popularity": 72,
      "followers": 2500000,
      "image_url": "https://...",
      "spotify_url": "https://open.spotify.com/artist/..."
    }
  }
}
```

---

## 🤝 Phase 2: 협업 아티스트

### 기능
- 앨범의 모든 트랙에서 아티스트 정보 추출
- 메인 아티스트 vs 피처링 아티스트 구분

### 실행

```bash
npm run fetch:collaborations
```

### 소요 시간
- 1,000개 앨범 기준: **약 20분**
- 각 앨범마다 트랙 정보 조회 필요

### 결과 파일
```
out/album_collaborations.json
{
  "generatedAt": "2026-01-20T...",
  "totalAlbums": 1000,
  "albums": {
    "4jxokHekH1qSad1DcC82ku": {
      "album_id": "spotify:album:4jxokHekH1qSad1DcC82ku",
      "main_artists": [
        {
          "id": "4TMHGUX5WI7OOm53PqSDAT",
          "name": "Grateful Dead",
          "role": "main"
        }
      ],
      "featured_artists": [
        {
          "id": "another_artist_id",
          "name": "Guest Artist",
          "role": "featured"
        }
      ],
      "total_tracks": 8
    }
  }
}
```

---

## 🎼 Phase 3: 크레딧 정보

### 기능
- MusicBrainz API로 프로듀서, 작곡가, 엔지니어 정보 수집
- 앨범 크레딧 메타데이터

### 실행

```bash
npm run fetch:credits
```

### ⚠️ 주의사항
- **MusicBrainz는 1 req/sec 제한**
- **소요 시간이 매우 김!**

### 소요 시간
- 1,000개 앨범 기준: **약 30-40분**
- 인내심 필요! ☕

### 결과 파일
```
out/album_credits.json
{
  "generatedAt": "2026-01-20T...",
  "totalAlbums": 1000,
  "albums": {
    "4jxokHekH1qSad1DcC82ku": {
      "album_id": "spotify:album:4jxokHekH1qSad1DcC82ku",
      "musicbrainz_id": "release-id-here",
      "credits": [
        {
          "person_name": "George Martin",
          "role": "producer",
          "source": "musicbrainz"
        },
        {
          "person_name": "Geoff Emerick",
          "role": "engineer",
          "source": "musicbrainz"
        }
      ],
      "found": true
    }
  }
}
```

---

## 💾 DB 임포트

### 모든 메타데이터를 DB에 저장

```bash
npm run metadata:import
```

이 명령어는:
1. JSON 파일들을 Docker 컨테이너로 복사
2. Python 스크립트로 DB 임포트 실행
3. 중복 체크 (이미 있으면 스킵)
4. 통계 출력

### 실행 결과
```
🗄️  메타데이터 DB 임포트 시작
======================================================================

🎤 Phase 1: 아티스트 정보 임포트
======================================================================
📥 아티스트 데이터 로드: 1000개
📋 기존 DB 아티스트: 0개
✅ 아티스트 임포트 완료: 1000개

🤝 Phase 2: 협업 관계 임포트
======================================================================
📥 협업 데이터 로드: 1000개 앨범
✅ 협업 관계 임포트 완료: 2500개

🎼 Phase 3: 크레딧 정보 임포트
======================================================================
📥 크레딧 데이터 로드: 1000개 앨범
✅ 크레딧 임포트 완료: 3500개

📊 최종 DB 통계
======================================================================
🎤 아티스트: 1000개
🤝 앨범-아티스트 관계: 2500개
   • 메인: 2000개
   • 피처링: 500개
🎼 크레딧: 3500개
   역할별 분포:
   • producer: 800개
   • composer: 600개
   • engineer: 500개
```

---

## 🎯 전체 프로세스

### 처음부터 끝까지 한 번에

```bash
# 1. 앨범 데이터 수집 (이미 있으면 스킵)
npm run fetch:spotify

# 2. 메타데이터 수집 (Phase 1, 2, 3)
npm run fetch:metadata

# 3. DB 임포트
npm run metadata:import
```

### 또는 단계별로

```bash
# Phase 1만
npm run fetch:artists
npm run metadata:import

# Phase 2만
npm run fetch:collaborations
npm run metadata:import

# Phase 3만 (시간 오래 걸림!)
npm run fetch:credits
npm run metadata:import
```

---

## 📊 데이터 활용 예시

### 1. 아티스트 페이지
```sql
-- 아티스트 정보 + 앨범 목록
SELECT 
  a.name,
  a.genres,
  a.popularity,
  COUNT(aa.album_id) as total_albums
FROM artists a
LEFT JOIN album_artists aa ON a.id = aa.artist_id
WHERE aa.role = 'main'
GROUP BY a.id;
```

### 2. 앨범 상세 - 참여 아티스트
```sql
-- 앨범의 모든 참여 아티스트
SELECT 
  a.name,
  aa.role,
  aa.order
FROM album_artists aa
JOIN artists a ON aa.artist_id = a.id
WHERE aa.album_id = 'spotify:album:xxx'
ORDER BY aa.role, aa.order;
```

### 3. 프로듀서 검색
```sql
-- 특정 프로듀서가 참여한 앨범
SELECT 
  alb.title,
  alb.artist_name,
  alb.year
FROM album_credits ac
JOIN albums alb ON ac.album_id = alb.id
WHERE ac.person_name = 'George Martin'
  AND ac.role = 'producer';
```

---

## ⚡ 성능 최적화

### 중복 실행 가능
- 모든 스크립트는 **재실행 가능**
- 이미 수집한 데이터는 **스킵**
- 중간에 멈춰도 **이어서 실행** 가능

### 중간 저장
- 일정 간격마다 자동 저장
- Phase 1: 250개마다
- Phase 2: 100개마다
- Phase 3: 50개마다

### Rate Limit 대응
- Spotify: 자동 재시도
- MusicBrainz: 1초 대기

---

## 🐛 문제 해결

### Phase 1 실패
```bash
# Spotify API 인증 확인
node scripts/ops/test-spotify-auth.mjs

# .env 파일 확인
cat .env
```

### Phase 2 느림
- 정상입니다! 각 앨범마다 API 호출 필요
- 100개마다 진행 상황 저장됨

### Phase 3 매우 느림
- MusicBrainz는 1 req/sec 제한
- **백그라운드 실행 추천**:
  ```bash
  nohup npm run fetch:credits > credits.log 2>&1 &
  ```

### DB 임포트 에러
```bash
# 백엔드 컨테이너 확인
docker ps | grep sonic_backend

# 로그 확인
docker-compose logs backend

# 직접 실행
docker exec -it sonic_backend bash
python scripts/db/import/import-metadata.py
```

---

## 📈 향후 계획

프론트엔드에서 활용:
- 🎤 아티스트 페이지/탭
- 🤝 협업 네트워크 시각화
- 🎼 프로듀서/크레딧 검색
- 📊 통계 및 인사이트

---

**메타데이터 수집 완료!** 🎉

이제 풍부한 음악 메타데이터가 DB에 저장되었습니다.
