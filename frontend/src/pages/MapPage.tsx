import React from 'react';
import { MapCanvas } from '../components/MapCanvas/MapCanvas';
import { TimelineBar } from '../components/TimelineBar/TimelineBar';
import { GenreFilter } from '../components/GenreFilter/GenreFilter';
import { DetailPanel } from '../components/DetailPanel/DetailPanel';
import { useStore } from '../state/store';

export const MapPage: React.FC = () => {
  const { selectedAlbumId, selectAlbum } = useStore();
  const [panelAlbumId, setPanelAlbumId] = React.useState<string | null>(null);
  const [panelVisible, setPanelVisible] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (selectedAlbumId) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setPanelAlbumId(selectedAlbumId);
      setPanelVisible(true);
      return;
    }

    if (panelAlbumId) {
      setPanelVisible(false);
      closeTimerRef.current = window.setTimeout(() => {
        setPanelAlbumId(null);
        closeTimerRef.current = null;
      }, 260);
    }
  }, [selectedAlbumId, panelAlbumId]);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden flex flex-row">
      
      {/* 1. Main Interaction Area (Left/Center) */}
      <main className="relative flex-1 flex flex-col h-full overflow-hidden min-w-0">
        
        {/* Map Canvas */}
        <div className="absolute inset-0 z-10">
          <MapCanvas />
        </div>

        {/* Floating Timeline Island (Glass Material - 반응형) */}
        <footer className="absolute bottom-0 left-0 right-0 z-30 p-2 sm:p-4 md:p-6 lg:p-8 pointer-events-none">
          <div className="pointer-events-auto flex items-end gap-4">
            <div className="fixed left-4 top-1/2 -translate-y-1/2 w-[90px] sm:w-[110px] md:w-[130px]">
              <GenreFilter />
            </div>
            <div className="flex-1 flex justify-center px-4 sm:px-6 md:px-8">
              <div className="w-full max-w-full sm:max-w-sm md:max-w-md lg:max-w-lg bg-white border border-gray-200 rounded-xl sm:rounded-2xl md:rounded-[2rem] p-2 sm:p-2.5 md:p-3 shadow-lg transition-all">
                <TimelineBar />
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* DetailPanel - Search/My 아래에 충분한 간격 (큰 폭) */}
      {panelAlbumId && (
        <>
          {/* 배경 오버레이 - 클릭하면 패널 닫기 */}
          <div 
            className={`absolute inset-0 bg-black/20 backdrop-blur-sm z-35 transition-opacity duration-300 ${panelVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => selectAlbum(null)}
          />
          <div className={`absolute top-14 sm:top-16 right-3 sm:right-4 md:right-6 z-40 w-[300px] sm:w-[340px] md:w-[400px] lg:w-[440px] xl:w-[480px] max-h-[calc(100vh-4.5rem)] sm:max-h-[calc(100vh-5rem)] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 ${panelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <DetailPanel albumId={panelAlbumId} />
          </div>
        </>
      )}

    </div>
  );
};
