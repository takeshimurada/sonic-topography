import React from 'react';
import { useStore } from '../../state/store';

export const DebugPanel: React.FC = () => {
  const { albums, filteredAlbums, loading } = useStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 border border-accent p-4 rounded-lg text-xs font-mono text-white max-w-md max-h-96 overflow-y-auto">
      <div className="font-bold text-accent mb-2">🔍 DEBUG INFO</div>
      <div>Loading: {loading ? 'YES' : 'NO'}</div>
      <div>Total Albums: {albums.length}</div>
      <div>Filtered Albums: {filteredAlbums.length}</div>
      <div className="mt-2">Backend URL: {import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}</div>
      <div>API Key: {import.meta.env.VITE_API_KEY ? '✅ Set' : '❌ Missing'}</div>
      
      {albums.length > 0 && (
        <div className="mt-2 border-t border-accent/30 pt-2">
          <div className="font-bold text-yellow-400">Sample Album (First 3):</div>
          {albums.slice(0, 3).map((album, i) => (
            <div key={i} className="mt-1 text-[10px] bg-black/50 p-1 rounded">
              <div>#{i+1}: {album.title}</div>
              <div>Year: {album.year} | Vibe: {album.vibe.toFixed(2)}</div>
              <div>Region: {album.region} | Artist: {album.artist}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-2 text-yellow-300 text-[10px]">
        ⚠️ 점이 안 보이면 F12 콘솔 확인!
      </div>
    </div>
  );
};
