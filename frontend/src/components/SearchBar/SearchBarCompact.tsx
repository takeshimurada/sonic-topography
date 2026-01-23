import React, { useState, useRef, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { Search } from 'lucide-react';

export const SearchBarCompact: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 배경 클릭으로 닫기
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  return (
    <div 
      ref={containerRef}
      className={`bg-white border border-gray-300 hover:border-black rounded transition-all duration-300 h-[40px] flex items-center ${
        isExpanded ? 'w-[320px] px-3' : 'w-auto px-3'
      }`}
    >
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-center gap-1.5 text-black whitespace-nowrap"
        >
          <Search size={14} strokeWidth={2} />
          <span className="text-[10px] font-semibold">Search</span>
        </button>
      ) : (
        <div className="w-full">
          <SearchBar />
        </div>
      )}
    </div>
  );
};
