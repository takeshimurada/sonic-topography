import React, { useEffect, useState } from 'react';
import { Heart, Music, Sparkles, RefreshCw } from 'lucide-react';
import { useStore, BACKEND_URL, getAuthHeaders } from '../../state/store';
import { LikeItem } from '../../types';

export const ForYouPanel: React.FC = () => {
  const { albums, selectAlbum } = useStore();
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLikes = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/me/likes?entity_type=album`, {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        setLikes(data.items || []);
        console.log('❤️ Loaded likes:', data.items?.length || 0);
      } else {
        console.warn('⚠️ Failed to load likes:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading likes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLikes();
  }, []);

  const handleAlbumClick = (entityId: string) => {
    const album = albums.find(a => a.id === entityId);
    if (album) {
      selectAlbum(album.id);
      console.log('📀 Selected liked album:', album.title);
    } else {
      console.warn('⚠️ Album not found in store:', entityId);
    }
  };

  return (
    <div className="bg-white border border-pink-200 rounded-lg shadow-md p-4 h-full flex flex-col">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-pink-500 fill-pink-500" />
          <h2 className="text-sm font-bold text-black">For You</h2>
        </div>
        <button
          onClick={loadLikes}
          disabled={loading}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {likes.length > 0 && (
        <div className="mb-4 p-3 bg-pink-50 rounded-lg border border-pink-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
              <Sparkles size={18} className="text-pink-500" />
            </div>
            <div>
              <div className="text-xs text-gray-600">You liked</div>
              <div className="text-lg font-bold text-black">{likes.length} albums</div>
            </div>
          </div>
        </div>
      )}

      {/* Likes List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="text-gray-400 animate-spin" />
          </div>
        ) : likes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Heart size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">No liked albums yet</p>
            <p className="text-gray-500 text-xs">Start liking albums to build your collection!</p>
          </div>
        ) : (
          likes.slice(0, 10).map((like) => {
            const album = albums.find(a => a.id === like.entity_id);
            
            if (!album) {
              return (
                <div
                  key={like.entity_id}
                  className="p-3 bg-white/5 rounded-lg border border-white/10 opacity-50"
                >
                  <div className="text-xs text-slate-600">Album not loaded</div>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">
                    {like.entity_id.slice(0, 8)}...
                  </div>
                </div>
              );
            }

            return (
              <button
                key={like.entity_id}
                onClick={() => handleAlbumClick(like.entity_id)}
                className="w-full text-left p-3 bg-gray-50 hover:bg-pink-50 rounded-lg border border-gray-200 hover:border-pink-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-gray-200 group-hover:border-pink-300 transition-all">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Music size={16} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-black truncate group-hover:text-pink-600 transition-colors">
                      {album.title}
                    </div>
                    <div className="text-[10px] text-gray-600 truncate mt-0.5">
                      {album.artist}
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">
                      {album.year} • {album.region}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Show more indicator */}
      {likes.length > 10 && (
        <div className="mt-3 pt-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-500">
            Showing 10 of {likes.length} liked albums
          </p>
        </div>
      )}
    </div>
  );
};
