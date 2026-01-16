import React, { useState, useMemo, useEffect } from 'react';
import { DeckGL } from '@deck.gl/react';
import { OrthographicView, LinearInterpolator } from '@deck.gl/core';
import { ScatterplotLayer, LineLayer, TextLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import { scaleLinear } from 'd3';
import { useStore } from '../../state/store';
import { Album, Region } from '../../types';

// Easing 함수 (부드러운 감속)
const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const MIN_YEAR = 1960;
const MAX_YEAR = 2024;
const DAYS_PER_YEAR = 365;
const WORLD_WIDTH = 1200;  // 800 → 1200 (50% 확장)
const WORLD_HEIGHT = 900;  // 600 → 900 (50% 확장)

// 지역별 대략적인 Y 범위 (위=0, 아래=1)
const REGION_Y_CENTER: Record<string, number> = {
  'Asia': 0.15,           // 위쪽
  'Oceania': 0.20,        // 위쪽
  'North America': 0.50,  // 중간
  'Europe': 0.82,         // 아래쪽
  'Latin America': 0.85,  // 아래쪽
  'South America': 0.88,  // 아래쪽
  'Caribbean': 0.80,      // 아래쪽
  'Africa': 0.90,         // 아래쪽
};

// 문자열을 숫자로 변환 (시드 생성)
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Y 좌표 생성: 지역 중심 + 분산 (지역 구분 명확하게)
const getY = (region: string, albumId: string, vibe: number): number => {
  const regionCenter = REGION_Y_CENTER[region] || 0.5;
  
  // 앨범 ID 기반 분산 (지역 내에서만)
  const seed = hashCode(albumId + 'y');
  const spread = ((seed % 10000) / 10000 - 0.5) * 0.3; // ±0.15 범위 (지역 구분 유지)
  
  // vibe도 활용해서 자연스럽게 분산
  const vibeInfluence = (vibe - 0.5) * 0.15; // vibe에 따라 ±0.075
  
  const finalY = regionCenter + spread + vibeInfluence;
  
  // 0-1 범위 내로 제한
  return Math.max(0, Math.min(1, finalY));
};

// X 좌표 생성: 연도 + 더 넓은 분산 (경계 밖으로 살짝 나가게)
const getX = (year: number, albumId: string): number => {
  const seed = hashCode(albumId + 'x');
  // 연도 내에서 -0.2 ~ 1.2 범위로 분산 (경계 넘어가게!)
  const dayRatio = ((seed % 10000) / 10000 - 0.1) * 1.4; // -0.14 ~ 1.26
  return year + dayRatio;
};

// 장르별 색상 매핑
const GENRE_RGB: Record<string, [number, number, number]> = {
  // 록/메탈
  'Rock': [239, 68, 68],           // 빨강
  'Hard Rock': [220, 38, 38],
  'Metal': [127, 29, 29],
  'Alternative': [251, 146, 60],    // 주황
  'Indie': [253, 186, 116],
  'Punk': [234, 88, 12],
  
  // 팝/댄스
  'Pop': [236, 72, 153],            // 핑크
  'Dance': [219, 39, 119],
  'Electronic': [168, 85, 247],     // 보라
  'EDM': [147, 51, 234],
  'House': [126, 34, 206],
  'Techno': [107, 33, 168],
  
  // 힙합/R&B
  'Hip Hop': [234, 179, 8],         // 금색
  'Rap': [202, 138, 4],
  'R&B': [132, 204, 22],            // 라임
  'Soul': [101, 163, 13],
  
  // 재즈/블루스
  'Jazz': [59, 130, 246],           // 파랑
  'Blues': [37, 99, 235],
  'Funk': [29, 78, 216],
  
  // 클래식/포크
  'Classical': [156, 163, 175],     // 회색
  'Folk': [134, 239, 172],          // 민트
  'Country': [74, 222, 128],        // 초록
  
  // 월드/기타
  'World': [251, 191, 36],          // 노랑
  'Latin': [245, 158, 11],
  'Reggae': [20, 184, 166],         // 청록
  'K-Pop': [244, 114, 182],         // 핑크
  'J-Pop': [217, 70, 239],          // 자주색
  
  // 기본값
  'Other': [148, 163, 184],         // 회색
};

export const MapCanvas: React.FC = () => {
  const { 
    filteredAlbums, 
    selectedAlbumId, 
    selectAlbum,
    brushedAlbumIds,
    viewport,
    setViewportYearRange,
    viewportYearRange,
    albums,
  } = useStore();

  const [hoverInfo, setHoverInfo] = useState<{x: number, y: number, object: Album} | null>(null);
  const [clickedAlbum, setClickedAlbum] = useState<{x: number, y: number, album: Album} | null>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  
  const [viewState, setViewState] = useState({
    target: [WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0] as [number, number, number],
    zoom: -0.5,  // 더 줌아웃 (넓은 영역 대응)
    transitionDuration: 0,
    transitionInterpolator: null as any
  });

  // 외부 클릭 감지 - 팝업 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setClickedAlbum(null);
      }
    };
    if (clickedAlbum) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [clickedAlbum]);

  // scales를 먼저 정의
  const scales = useMemo(() => {
    // X축: 년도+날짜 (소수점 포함)
    const xScale = scaleLinear().domain([MIN_YEAR, MAX_YEAR + 1]).range([0, WORLD_WIDTH]);
    // Y축: 0-1 범위 (국가별 Y 좌표)
    const yScale = scaleLinear().domain([0, 1]).range([WORLD_HEIGHT, 0]); 
    return { xScale, yScale };
  }, []);

  // 경계 설정 (연도 범위 밖으로 못 나감)
  const bounds = useMemo(() => {
    return {
      minX: 0,
      maxX: WORLD_WIDTH,
      minY: 0,
      maxY: WORLD_HEIGHT
    };
  }, []);

  // 디버깅: 데이터 확인 (scales 정의 후)
  useEffect(() => {
    console.log('🗺️ MapCanvas Debug:');
    console.log('  - Total albums:', filteredAlbums.length);
    console.log('  - ViewState zoom:', viewState.zoom.toFixed(2));
    if (filteredAlbums.length > 0 && scales) {
      const sample = filteredAlbums[0];
      const xValue = getX(sample.year, sample.id);
      const yValue = getY(sample.region as string, sample.id, sample.vibe);
      console.log('  - Sample album:', sample.title);
      console.log('  - X:', xValue.toFixed(3), '| Y:', yValue.toFixed(3));
      console.log('  - Region:', sample.region, '| Genre:', sample.genres[0]);
    }
  }, [filteredAlbums.length, viewState.zoom, scales]);

  // viewport 변경 감지 (검색 시 부드러운 이동)
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [showRegionLabels, setShowRegionLabels] = React.useState(false);
  const regionLabelTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    console.log('📍 Viewport update:', viewport);
    
    if (viewport.k > 1) {
       // 앨범 좌표를 픽셀 좌표로 변환
       const targetX = scales.xScale(viewport.x);
       const targetY = scales.yScale(viewport.y);
       const targetZoom = Math.log2(viewport.k);
       
       // 선택된 앨범의 실제 렌더링 위치 계산 (디버그용)
       if (selectedAlbumId) {
         const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
         if (selectedAlbum) {
           const albumXValue = getX(selectedAlbum.year, selectedAlbum.id);
           const albumYValue = getY(selectedAlbum.region as string, selectedAlbum.id, selectedAlbum.vibe);
           const albumPixelX = scales.xScale(albumXValue);
           const albumPixelY = scales.yScale(albumYValue);
           
           console.log('🎯 Selected album actual position:', {
             'albumXValue (year+offset)': albumXValue,
             'albumYValue (region+vibe)': albumYValue,
             'albumPixelX': albumPixelX,
             'albumPixelY': albumPixelY,
             'targetX (목표)': targetX,
             'targetY (목표)': targetY,
             'diff': {
               x: Math.abs(albumPixelX - targetX),
               y: Math.abs(albumPixelY - targetY)
             }
           });
         }
       }
       
       console.log('🚀 Animation details:', { 
         'viewport.x (year)': viewport.x,
         'viewport.y (vibe)': viewport.y,
         'viewport.k (zoom)': viewport.k,
         'targetX (pixel)': targetX,
         'targetY (pixel)': targetY,
         'targetZoom (log2)': targetZoom,
         'WORLD_WIDTH': WORLD_WIDTH,
         'WORLD_HEIGHT': WORLD_HEIGHT,
         'currentTarget': viewState.target,
         'currentZoom': viewState.zoom 
       });
       
       setIsAnimating(true);
       
       // 부드러운 애니메이션
       const newViewState = {
         target: [targetX, targetY, 0] as [number, number, number],
         zoom: targetZoom,
         transitionDuration: 2000,
         transitionEasing: easeInOutCubic,
         transitionInterpolator: new LinearInterpolator(['target', 'zoom']) as any
       };
       
       console.log('✅ Setting viewState:', newViewState);
       setViewState(newViewState);
       
       // 애니메이션 종료 후 플래그 리셋
       setTimeout(() => {
         console.log('✅ Animation complete');
         setIsAnimating(false);
       }, 2000);
    }
  }, [viewport.x, viewport.y, viewport.k, scales, selectedAlbumId, albums]);

  const layers = useMemo(() => {
    console.log('🎨 Creating layers with', filteredAlbums.length, 'albums');
    
    // 부드러운 페이드를 위해 0-1 범위로 계산
    const gridVisible = (isAnimating || showRegionLabels) ? 1.0 : 0.0;
    
    return [
      // 지역 구분선 (가로선) - 부드러운 transition
      new LineLayer({
        id: 'region-lines',
        data: [
          { id: 'asia-line', y: 0.15 },
          { id: 'north-line', y: 0.50 },
          { id: 'euro-line', y: 0.85 },
        ],
        getSourcePosition: (d: any) => [0, scales.yScale(d.y), 0],
        getTargetPosition: (d: any) => [WORLD_WIDTH, scales.yScale(d.y), 0],
        getColor: [148, 163, 184],
        getWidth: 1.5,
        opacity: gridVisible,
        transitions: {
          opacity: {
            duration: 800,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
          }
        },
        updateTriggers: {
          opacity: [gridVisible]
        }
      }),
      
      // 연도 구분선 (세로선, 10년 단위) - 부드러운 transition
      new LineLayer({
        id: 'year-lines',
        data: [
          { year: 1960, is2000: false },
          { year: 1970, is2000: false },
          { year: 1980, is2000: false },
          { year: 1990, is2000: false },
          { year: 2000, is2000: true },
          { year: 2010, is2000: false },
          { year: 2020, is2000: false },
        ],
        getSourcePosition: (d: any) => [scales.xScale(d.year), 0, 0],
        getTargetPosition: (d: any) => [scales.xScale(d.year), WORLD_HEIGHT, 0],
        getColor: (d: any) => d.is2000 
          ? [129, 140, 248]
          : [148, 163, 184],
        getWidth: (d: any) => d.is2000 ? 2.5 : 1.5,
        opacity: gridVisible,
        transitions: {
          opacity: {
            duration: 800,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
          }
        },
        updateTriggers: {
          opacity: [gridVisible]
        }
      }),
      
      // 연도 레이블 (연도선 옆에 위치) - billboard로 항상 보이게
      new TextLayer({
        id: 'year-labels',
        data: [
          { year: 1960, is2000: false },
          { year: 1970, is2000: false },
          { year: 1980, is2000: false },
          { year: 1990, is2000: false },
          { year: 2000, is2000: true },
          { year: 2010, is2000: false },
          { year: 2020, is2000: false },
        ],
        getPosition: (d: any) => [scales.xScale(d.year) + 10, WORLD_HEIGHT / 2, 0],  // 선 옆(오른쪽), 화면 중앙
        getText: (d: any) => String(d.year),
        getColor: (d: any) => {
          return d.is2000 
            ? [167, 139, 250, 255]  // indigo-400
            : [203, 213, 225, 255];  // slate-300
        },
        getSize: 14,
        getAngle: 0,
        getTextAnchor: 'start' as any,  // 선의 오른쪽에 텍스트
        getAlignmentBaseline: 'center' as any,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 700,
        outlineWidth: 3,
        outlineColor: [0, 0, 0, 255],
        opacity: gridVisible,
        billboard: true,
        transitions: {
          opacity: {
            duration: 800,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
          }
        },
        updateTriggers: {
          opacity: [gridVisible]
        }
      }),
      
      // 지역 레이블 (지역선 좌측, 화면을 따라가도록) - billboard로 항상 보이게
      new TextLayer({
        id: 'region-labels',
        data: [
          { id: 'asia', name: 'ASIA / OCEANIA', nameKo: '아시아·오세아니아', y: 0.15, center: 0.15 },
          { id: 'north', name: 'NORTH AMERICA', nameKo: '영미권', y: 0.50, center: 0.50 },
          { id: 'euro', name: 'EUROPE / LATIN / AFRICA', nameKo: '유럽·라틴·아프리카', y: 0.85, center: 0.85 },
        ],
        getPosition: (d: any) => {
          // 화면 왼쪽 가장자리에 고정 (viewport 따라 이동)
          const zoomScale = Math.pow(2, viewState.zoom);
          const visibleWorldWidth = WORLD_WIDTH / zoomScale;
          const leftEdgeX = viewState.target[0] - visibleWorldWidth / 2;
          return [leftEdgeX + 50, scales.yScale(d.y), 0];  // 선 위에 위치, 좌측 50px 여백
        },
        getText: (d: any) => {
          const zoomLevel = Math.pow(2, viewState.zoom);
          if (zoomLevel > 2) {
            const centerYNorm = viewState.target[1] / WORLD_HEIGHT;
            const distance = Math.abs(centerYNorm - d.center);
            if (distance > 0.25) return '';
          }
          return `${d.name}\n${d.nameKo}`;
        },
        getColor: [203, 213, 225, 255],
        getSize: 11,
        getAngle: 0,
        getTextAnchor: 'start' as any,
        getAlignmentBaseline: 'center' as any,  // 선 위에 중앙 정렬
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 700,
        outlineWidth: 3,
        outlineColor: [0, 0, 0, 255],
        opacity: gridVisible,
        billboard: true,
        maxWidth: 200,
        transitions: {
          opacity: {
            duration: 800,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
          }
        },
        updateTriggers: {
          opacity: [gridVisible],
          getText: [viewState.zoom, viewState.target],
          getPosition: [viewState.zoom, viewState.target]  // viewport 변경 시 위치 업데이트
        }
      }),
      
      new ScatterplotLayer({
        id: 'albums-layer',
        data: filteredAlbums,
        getPosition: (d: Album) => {
          // X축: 연도 + 분산 (전체 활용)
          const xValue = getX(d.year, d.id);
          const x = scales.xScale(xValue);
          
          // Y축: 지역 중심 + 넓은 분산 (전체 활용)
          const yValue = getY(d.region as string, d.id, d.vibe);
          const y = scales.yScale(yValue);
          
          return [x, y, 0];
        },
        getFillColor: (d: Album): [number, number, number, number] => {
          const isBrushed = brushedAlbumIds.includes(d.id);
          const isSelected = selectedAlbumId === d.id;
          
          // 장르 기반 색상
          const genre = d.genres[0] || 'Other';
          const baseColor = GENRE_RGB[genre] || GENRE_RGB['Other'];
          
          // 선택된 앨범: 가장 밝게 + 강조
          if (isSelected) {
            return [...baseColor, 255] as [number, number, number, number];
          }
          
          // 브러시된 앨범: 매우 밝게 (아티스트 검색 시)
          if (isBrushed) {
            return [...baseColor, 240] as [number, number, number, number];
          }
          
          // 뷰포트 밖의 앨범: 투명하게
          const inViewport = d.year >= viewportYearRange[0] && d.year <= viewportYearRange[1];
          if (!inViewport) {
            return [...baseColor, 40] as [number, number, number, number];
          }
          
          // 다른 앨범이 선택/브러시된 경우: 살짝만 어둡게 (배경화, 하지만 여전히 보임)
          if (selectedAlbumId || brushedAlbumIds.length > 0) {
            return [...baseColor, 180] as [number, number, number, number];
          }
          
          // 기본 상태: 밝게 표시
          return [...baseColor, 220] as [number, number, number, number];
        },
        getLineColor: [255, 255, 255],
        getLineWidth: (d: Album) => d.id === selectedAlbumId ? 2 : 0,
        getRadius: (d: Album) => {
          const base = (d.popularity || 0.5) * 2.5 + 2; // 약간 작게
          return d.id === selectedAlbumId ? base * 2 : base;
        },
        pickable: true,
        stroked: true,
        radiusScale: 1,
        radiusMinPixels: 3,  // 최소 크기 더 작게 (더 많이 보임)
        radiusMaxPixels: 25, // 최대 크기도 줄임
        opacity: 0.85,
      onHover: (info: PickingInfo) => {
        if (info.object) {
          setHoverInfo({ x: info.x, y: info.y, object: info.object as Album });
        } else {
          setHoverInfo(null);
        }
      },
      onClick: (info: PickingInfo) => {
        if (info.object) {
          const album = info.object as Album;
          // 작은 팝업만 표시 (selectAlbum 호출 안함)
          setClickedAlbum({ x: info.x, y: info.y, album });
        } else {
          setClickedAlbum(null);
        }
      },
      updateTriggers: {
        getFillColor: [selectedAlbumId, brushedAlbumIds, viewportYearRange],
        getLineWidth: [selectedAlbumId],
        getRadius: [selectedAlbumId],
        getPosition: [scales]
      }
    })];
  }, [filteredAlbums, selectedAlbumId, brushedAlbumIds, viewportYearRange, scales, selectAlbum, isAnimating, showRegionLabels]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* 구(Sphere) 형태 블러 - 입체감 */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {/* Radial gradient로 구형 블러 */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.7) 85%, black 100%)'
          }}
        />
        {/* 추가 좌우 블러 (강화) */}
        <div className="absolute top-0 left-0 bottom-0 w-64 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute top-0 right-0 bottom-0 w-64 bg-gradient-to-l from-black via-black/70 to-transparent" />
        {/* 추가 상하 블러 (깊이감) */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      <div className="w-full h-full relative">
        <DeckGL
          width="100%"
          height="100%"
          viewState={viewState}
          onViewStateChange={({ viewState: newViewState }: any) => {
            // 지역 레이블 표시 (줌/팬 중)
            setShowRegionLabels(true);
            if (regionLabelTimerRef.current) {
              clearTimeout(regionLabelTimerRef.current);
            }
            regionLabelTimerRef.current = setTimeout(() => {
              setShowRegionLabels(false);
            }, 1500);
            
            // 애니메이션 중이면 업데이트 무시
            if (isAnimating) {
              console.log('⏸️ Skipping update during animation');
              return;
            }
            
            // Zoom 제한 적용
            let zoom = newViewState.zoom;
            zoom = Math.max(0.2, Math.min(4, zoom));
            
            // 경계 제한 (드래그만 제한, 줌은 자유롭게)
            const zoomScale = Math.pow(2, zoom);
            const visibleWorldWidth = WORLD_WIDTH / zoomScale;
            const visibleWorldHeight = WORLD_HEIGHT / zoomScale;
            
            // X축 경계 제한 (부드럽게)
            let targetX = newViewState.target[0];
            const halfVisibleX = visibleWorldWidth / 2;
            if (halfVisibleX < WORLD_WIDTH / 2) {
              // 줌인 상태: 범위 내로 제한
              targetX = Math.max(halfVisibleX, Math.min(WORLD_WIDTH - halfVisibleX, targetX));
            } else {
              // 줌아웃 상태: 중앙 고정
              targetX = WORLD_WIDTH / 2;
            }
            
            // Y축 경계 제한 (부드럽게)
            let targetY = newViewState.target[1];
            const halfVisibleY = visibleWorldHeight / 2;
            if (halfVisibleY < WORLD_HEIGHT / 2) {
              targetY = Math.max(halfVisibleY, Math.min(WORLD_HEIGHT - halfVisibleY, targetY));
            } else {
              targetY = WORLD_HEIGHT / 2;
            }
            
            // 일반 줌/팬: 즉시 반응
            setViewState({
              target: [targetX, targetY, 0] as [number, number, number],
              zoom: zoom,
              transitionDuration: 0,
              transitionEasing: undefined,
              transitionInterpolator: undefined as any
            });
              
            // 뷰포트에서 보이는 연도 범위 계산
            const leftX = Math.max(0, targetX - halfVisibleX);
            const rightX = Math.min(WORLD_WIDTH, targetX + halfVisibleX);
            
            const yearScale = (x: number) => MIN_YEAR + (x / WORLD_WIDTH) * (MAX_YEAR - MIN_YEAR);
            const minVisibleYear = Math.max(MIN_YEAR, Math.floor(yearScale(leftX)));
            const maxVisibleYear = Math.min(MAX_YEAR, Math.ceil(yearScale(rightX)));
            
            setViewportYearRange([minVisibleYear, maxVisibleYear]);
          }}
          controller={{
            scrollZoom: { speed: 0.005, smooth: true },
            inertia: 600,
            dragPan: true,
            dragRotate: false,
            doubleClickZoom: false,
            keyboard: false,
            touchRotate: false
          }}
          layers={layers}
          views={new OrthographicView({ 
            id: 'ortho',
            controller: {
              scrollZoom: { speed: 0.005, smooth: true }
            }
          })}
          getCursor={() => 'grab'}
          parameters={{
            clearColor: [0, 0, 0, 0]
          }}
        >
          {hoverInfo && !clickedAlbum && (
            <div className="absolute z-50 bg-panel border border-slate-600 p-2 rounded shadow-lg pointer-events-none text-xs" style={{ left: hoverInfo.x + 10, top: hoverInfo.y + 10 }}>
              <div className="font-bold text-white">{hoverInfo.object.title}</div>
              <div className="text-slate-400">{hoverInfo.object.artist} ({hoverInfo.object.year})</div>
            </div>
          )}
          
          {/* Clicked Album Popup (SearchBar와 동일한 스타일) */}
          {clickedAlbum && (
            <div 
              ref={popupRef}
              className="absolute z-50 w-[280px] bg-[#12131D]/98 backdrop-blur-3xl border border-accent/40 rounded-xl shadow-[0_20px_60px_-10px_rgba(99,102,241,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
              style={{ 
                left: Math.min(clickedAlbum.x + 20, window.innerWidth - 300), 
                top: Math.min(clickedAlbum.y, window.innerHeight - 250) 
              }}
            >
              <div className="p-4">
                <div className="flex items-start gap-4 mb-4">
                  <img 
                    src={clickedAlbum.album.coverUrl} 
                    className="w-20 h-20 rounded-lg border border-white/20 shadow-lg" 
                    alt={clickedAlbum.album.title} 
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white mb-1 truncate">{clickedAlbum.album.title}</h3>
                    <p className="text-xs text-slate-400 truncate">{clickedAlbum.album.artist}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                      <span>{clickedAlbum.album.year}</span>
                      <span>•</span>
                      <span>{clickedAlbum.album.region}</span>
                      <span>•</span>
                      <span>{clickedAlbum.album.genres.slice(0, 2).join(', ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // View Detail 클릭: selectAlbum 호출하고 팝업 닫기
                      selectAlbum(clickedAlbum.album.id);
                      setClickedAlbum(null);
                    }}
                    className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    View Detail
                  </button>
                  <button
                    onClick={() => {
                      setClickedAlbum(null);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </DeckGL>
      </div>
    </div>
  );
};