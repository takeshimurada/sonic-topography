import { create } from 'zustand';
import { Album, Region, Viewport } from '../types';

interface AppState {
  albums: Album[];
  filteredAlbums: Album[];
  selectedAlbumId: string | null;
  selectedArtist: string | null;
  artistConnections: { creator_id: string; display_name: string; weight: number; image_url?: string | null }[];
  brushedAlbumIds: string[]; // IDs selected via brush tool
  searchMatchedAlbumIds: string[]; // IDs matched by search (for highlighting)

  // Filters
  yearRange: [number, number];
  activeRegions: Region[];
  selectedGenre: string | null;
  searchQuery: string;

  // Map View
  viewport: Viewport;
  viewportYearRange: [number, number]; // 현재 뷰포트에서 보이는 연도 범위

  // Loading state
  loading: boolean;
  loadError: string | null;
  
  // Actions
  loadAlbums: () => Promise<void>;
  setYearRange: (range: [number, number]) => void;
  setViewportYearRange: (range: [number, number]) => void;
  toggleRegion: (region: Region) => void;
  setSelectedGenre: (genre: string | null) => void;
  selectAlbum: (id: string | null) => void;
  selectAlbumKeepArtist: (id: string | null) => void;
  selectArtist: (name: string | null) => void;
  setArtistConnections: (
    items: { creator_id: string; display_name: string; weight: number; image_url?: string | null }[]
  ) => void;
  setBrushedAlbums: (ids: string[]) => void;
  setSearchQuery: (query: string) => void;
  setViewport: (viewport: Viewport | ((prev: Viewport) => Viewport)) => void;
}

const MIN_YEAR = 1950;
const MAX_YEAR = 2026;

const ALL_REGIONS: Region[] = ['North America', 'Europe', 'Asia', 'South America', 'Caribbean', 'Oceania', 'Africa'];

const applyFilters = (state: AppState): Album[] => {
  return state.albums.filter(album => {
    // 지역 + 장르 필터 적용 (연도 필터는 투명도로만 처리)
    const inRegion = state.activeRegions.includes(album.region);
    const albumGenre = album.genres?.[0] || 'Unknown';
    const inGenre = !state.selectedGenre || albumGenre === state.selectedGenre;
    return inRegion && inGenre;
  });
};

const getSearchMatchedIds = (state: AppState): string[] => {
  if (state.searchQuery === '') return [];
  
  return state.albums
    .filter(album => 
      album.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
      album.artist.toLowerCase().includes(state.searchQuery.toLowerCase())
    )
    .map(album => album.id);
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ========================================
// Step 1: 개발용 User ID 관리
// ========================================
const DEV_USER_ID_KEY = 'devUserId';
let cachedDevUserId: string | null = null;

/**
 * 개발용 유저 ID를 확보합니다 (localStorage + 캐시)
 * - localStorage에 없으면 백엔드에 생성 요청
 * - 실패 시 경고만 출력하고 빈 문자열 반환 (앱 실행 중단 방지)
 */
async function ensureDevUserId(): Promise<string> {
  // 1. 캐시 확인
  if (cachedDevUserId) return cachedDevUserId;
  
  // 2. localStorage 확인
  const stored = localStorage.getItem(DEV_USER_ID_KEY);
  if (stored) {
    cachedDevUserId = stored;
    return stored;
  }
  
  // 3. 백엔드에 새 유저 생성 요청
  try {
    console.log('🔐 Creating dev user...');
    const response = await fetch(`${BACKEND_URL}/dev/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create dev user: ${response.status}`);
    }
    
    const data = await response.json();
    const userId = data.user_id;
    
    localStorage.setItem(DEV_USER_ID_KEY, userId);
    cachedDevUserId = userId;
    console.log('✅ Dev user created:', userId);
    
    return userId;
  } catch (error) {
    console.error('❌ Failed to create dev user:', error);
    console.warn('⚠️ Continuing without authentication (Like/Event features may not work)');
    return '';
  }
}

/**
 * X-User-Id 헤더를 포함한 fetch 옵션 반환
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const userId = await ensureDevUserId();
  return userId ? { 'X-User-Id': userId } : {};
}

// 백엔드 응답을 프론트엔드 타입으로 변환
const transformAlbumData = (backendAlbum: any): Album => {
  return {
    id: backendAlbum.id,
    title: backendAlbum.title,
    artist: backendAlbum.artist_name,
    year: backendAlbum.year,
    releaseDate: backendAlbum.release_date || undefined, // 실제 발매일 (YYYY-MM-DD)
    vibe: backendAlbum.genre_vibe,
    popularity: backendAlbum.popularity,
    region: backendAlbum.region_bucket as Region,
    country: backendAlbum.country || undefined, // 국가 정보 (없으면 undefined)
    coverUrl: backendAlbum.cover_url,
    genres: [backendAlbum.genre],
  };
};

export const useStore = create<AppState>((set, get) => ({
  albums: [],
  filteredAlbums: [],
  selectedAlbumId: null,
  selectedArtist: null,
  artistConnections: [],
  brushedAlbumIds: [],
  searchMatchedAlbumIds: [],
  yearRange: [MIN_YEAR, MAX_YEAR],
  activeRegions: ALL_REGIONS,
  selectedGenre: null,
  searchQuery: '',
  viewport: { x: (MIN_YEAR + MAX_YEAR) / 2, y: 0.5, k: 1 },
  viewportYearRange: [MIN_YEAR, MAX_YEAR],
  loading: true,
  loadError: null,

  loadAlbums: async () => {
    try {
      set({ loading: true, loadError: null });

      await ensureDevUserId().catch(err => {
        console.warn('⚠️ Dev user initialization failed, but continuing:', err);
      });

      console.log('🔄 Loading albums from:', `${BACKEND_URL}/albums?limit=50000`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let response: Response;
      try {
        response = await fetch(`${BACKEND_URL}/albums?limit=50000`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data || !data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid API response format');
      }

      const albums: Album[] = data.data.map(transformAlbumData);
      console.log(`✅ Loaded ${albums.length} albums`);

      const state = get();
      const newState = { ...state, albums, loading: false };
      const filtered = applyFilters(newState as AppState);

      set({
        ...newState,
        filteredAlbums: filtered,
        loading: false,
        loadError: null,
      });
    } catch (error) {
      const msg = error instanceof Error
        ? (error.name === 'AbortError' ? 'Connection timed out — backend unreachable.' : error.message)
        : String(error);
      console.error('❌ Failed to load albums:', msg);
      set({ loading: false, albums: [], filteredAlbums: [], loadError: msg });
    }
  },

  setYearRange: (range) => set((state) => {
    const newState = { ...state, yearRange: range };
    return { ...newState, filteredAlbums: applyFilters(newState as AppState) };
  }),

  setViewportYearRange: (range) => set((state) => {
    const newState = { ...state, viewportYearRange: range };
    return { ...newState, filteredAlbums: applyFilters(newState as AppState) };
  }),

  toggleRegion: (region) => set((state) => {
    const newRegions = state.activeRegions.includes(region)
      ? state.activeRegions.filter(r => r !== region)
      : [...state.activeRegions, region];
    const newState = { ...state, activeRegions: newRegions };
    return { ...newState, filteredAlbums: applyFilters(newState as AppState) };
  }),

  setSelectedGenre: (genre) => set((state) => {
    const newState = { ...state, selectedGenre: genre };
    return { ...newState, filteredAlbums: applyFilters(newState as AppState) };
  }),

  setSearchQuery: (query) => set((state) => {
    const newState = { ...state, searchQuery: query };
    const filtered = applyFilters(newState as AppState);
    const searchMatched = getSearchMatchedIds(newState as AppState);
    return { 
      ...newState, 
      filteredAlbums: filtered,
      searchMatchedAlbumIds: searchMatched,
    };
  }),

  selectAlbum: (id) => set((state) => ({ selectedAlbumId: id, selectedArtist: id ? null : state.selectedArtist })),
  selectAlbumKeepArtist: (id) => set({ selectedAlbumId: id }),
  selectArtist: (name) =>
    set({
      selectedArtist: name,
      selectedAlbumId: name ? null : get().selectedAlbumId,
      artistConnections: name ? get().artistConnections : [],
    }),
  setArtistConnections: (items) => set({ artistConnections: items }),
  setBrushedAlbums: (ids) => set({ brushedAlbumIds: ids }),
  
  setViewport: (vp) => set((state) => ({
    viewport: typeof vp === 'function' ? vp(state.viewport) : vp
  })),
}));

// ========================================
// Step 1: Export 헬퍼 함수 (DetailPanel 등에서 사용)
// ========================================
export { BACKEND_URL, ensureDevUserId, getAuthHeaders };
