import React from 'react';
import { useStore } from '../../state/store';

export const SimpleTest: React.FC = () => {
  const { filteredAlbums } = useStore();
  
  if (filteredAlbums.length === 0) return null;

  // 간단한 SVG로 테스트
  const sample = filteredAlbums[0];
  
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
      <svg width="800" height="600" className="border-2 border-red-500">
        <rect width="800" height="600" fill="rgba(0,0,0,0.5)" />
        {filteredAlbums.slice(0, 100).map((album, i) => {
          // 간단한 스케일링
          const x = ((album.year - 1960) / (2024 - 1960)) * 800;
          const y = (1 - album.vibe) * 600;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              fill="#60A5FA"
              opacity={0.8}
            />
          );
        })}
        <text x="10" y="30" fill="white" fontSize="16">
          Simple SVG Test - {filteredAlbums.length} albums
        </text>
        <text x="10" y="50" fill="yellow" fontSize="12">
          First album: {sample.title} ({sample.year})
        </text>
      </svg>
    </div>
  );
};
