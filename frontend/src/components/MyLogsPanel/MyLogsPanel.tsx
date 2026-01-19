import React, { useState, useEffect } from 'react';
import { Star, Calendar, Trash2, Music2, Search } from 'lucide-react';
import { useStore } from '../../state/store';

interface SavedLog {
  albumId: string;
  albumTitle: string;
  albumArtist: string;
  albumYear: number;
  albumCover: string;
  rating: number;
  memo: string;
  updatedAt: string;
}

export const MyLogsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<SavedLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
  const { albums, selectAlbum } = useStore();

  useEffect(() => {
    loadAllLogs();
  }, [albums]);

  const loadAllLogs = () => {
    const allLogs: SavedLog[] = [];
    
    // LocalStorage에서 모든 log- 로 시작하는 항목 찾기
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('log-')) {
        const albumId = key.replace('log-', '');
        const logData = JSON.parse(localStorage.getItem(key) || '{}');
        
        // 앨범 정보 찾기
        const album = albums.find(a => a.id === albumId);
        if (album && logData.rating > 0) {
          allLogs.push({
            albumId,
            albumTitle: album.title,
            albumArtist: album.artist,
            albumYear: album.year,
            albumCover: album.coverUrl || '',
            rating: logData.rating,
            memo: logData.memo || '',
            updatedAt: logData.updatedAt
          });
        }
      }
    }

    // 정렬
    if (sortBy === 'date') {
      allLogs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else {
      allLogs.sort((a, b) => b.rating - a.rating);
    }

    setLogs(allLogs);
  };

  const deleteLog = (albumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 로그를 삭제하시겠습니까?')) {
      localStorage.removeItem(`log-${albumId}`);
      loadAllLogs();
    }
  };

  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
    onClose();
  };

  const filteredLogs = logs.filter(log => 
    log.albumTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.albumArtist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">My Music Logs</h2>
              <p className="text-slate-400 text-sm">당신의 음악 여정을 기록하세요</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <Music2 size={24} className="text-slate-400" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                id="logs-search"
                name="logs-search"
                type="text"
                placeholder="앨범이나 아티스트 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/20 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
            <select
              id="logs-sort"
              name="sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as 'date' | 'rating');
                loadAllLogs();
              }}
              className="px-4 py-3 bg-black/20 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-accent"
            >
              <option value="date">최근 순</option>
              <option value="rating">평점 순</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Music2 size={40} className="text-slate-700" />
              </div>
              <p className="text-slate-400 text-lg mb-2">아직 로그가 없습니다</p>
              <p className="text-slate-600 text-sm">앨범을 선택하고 평점과 메모를 남겨보세요!</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div 
                key={log.albumId}
                onClick={() => handleAlbumClick(log.albumId)}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:bg-slate-900/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex gap-6">
                  {/* Album Cover */}
                  <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    <img src={log.albumCover} alt={log.albumTitle} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white truncate group-hover:text-accent transition-colors">
                          {log.albumTitle}
                        </h3>
                        <p className="text-slate-400 text-sm truncate">
                          {log.albumArtist} • {log.albumYear}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => deleteLog(log.albumId, e)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star}
                          size={16} 
                          fill={star <= log.rating ? "#FBBF24" : "none"}
                          className={star <= log.rating ? "text-yellow-400" : "text-slate-700"}
                        />
                      ))}
                      <span className="ml-2 text-xs text-slate-500">
                        ({log.rating}/5)
                      </span>
                    </div>

                    {/* Memo */}
                    {log.memo && (
                      <p className="text-slate-300 text-sm line-clamp-2 mb-2">
                        "{log.memo}"
                      </p>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar size={12} />
                      {new Date(log.updatedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-6 border-t border-slate-800 bg-black/20">
          <div className="flex justify-around text-center">
            <div>
              <div className="text-2xl font-bold text-accent">{logs.length}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Logs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {logs.length > 0 ? (logs.reduce((sum, log) => sum + log.rating, 0) / logs.length).toFixed(1) : '0.0'}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Avg Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                {logs.filter(l => l.rating >= 4).length}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Favorites</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
