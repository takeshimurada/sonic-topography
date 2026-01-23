import React, { useRef, useEffect } from 'react';
import { select, rollup, scaleLinear, max } from 'd3';
import { useStore } from '../../state/store';
import { Album } from '../../types';

// 장르별 색상 (주요 장르만 표시)
const GENRE_COLORS: Record<string, string> = {
  'Rock': '#EF4444',
  'Alternative': '#FB923C', 
  'Pop': '#EC4899',
  'Electronic': '#A855F7',
  'Hip Hop': '#EAB308',
  'R&B': '#84CC16',
  'Jazz': '#3B82F6',
  'Folk': '#86EFAC',
  'K-Pop': '#F472B6',
  'Other': '#94A3B8'
};

const MAIN_GENRES = ['Rock', 'Alternative', 'Pop', 'Electronic', 'Hip Hop', 'R&B', 'Jazz', 'Folk', 'K-Pop'];

export const TimelineBar: React.FC = () => {
  const { albums, viewportYearRange, setViewport } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedYears, setSelectedYears] = React.useState({ 
    start: viewportYearRange[0], 
    end: viewportYearRange[1] 
  });

  const minYear = 1950;
  const maxYear = 2024;
  
  // 왼쪽 드롭박스 옵션: 1950 ~ 선택된 끝 연도
  const startYearOptions = React.useMemo(() => {
    const years = [];
    for (let year = minYear; year <= selectedYears.end; year++) {
      years.push(year);
    }
    return years;
  }, [selectedYears.end]);

  // 오른쪽 드롭박스 옵션: 선택된 시작 연도 ~ 2024
  const endYearOptions = React.useMemo(() => {
    const years = [];
    for (let year = selectedYears.start; year <= maxYear; year++) {
      years.push(year);
    }
    return years;
  }, [selectedYears.start]);

  // 뷰포트 연도 범위가 변경되면 드롭박스도 업데이트
  React.useEffect(() => {
    setSelectedYears({
      start: viewportYearRange[0],
      end: viewportYearRange[1]
    });
  }, [viewportYearRange[0], viewportYearRange[1]]);

  // 시작 연도 변경 (왼쪽 박스)
  const handleStartYearChange = (year: number) => {
    // 옵션에 이미 제한되어 있으므로 유효성 검사 불필요
    setSelectedYears({ start: year, end: selectedYears.end });
    
    // 화면 이동 (범위에 따라 줌 레벨 자동 조정)
    const centerYear = (year + selectedYears.end) / 2;
    const yearSpan = selectedYears.end - year;
    const zoomLevel = yearSpan > 30 ? 1.5 : yearSpan > 10 ? 2.5 : 3.5;
    
    console.log('📅 Start year changed:', { start: year, end: selectedYears.end, centerYear, zoomLevel, yearSpan });
    setViewport({ x: centerYear, y: 0.5, k: zoomLevel });
  };

  // 끝 연도 변경 (오른쪽 박스)
  const handleEndYearChange = (year: number) => {
    // 옵션에 이미 제한되어 있으므로 유효성 검사 불필요
    setSelectedYears({ start: selectedYears.start, end: year });
    
    // 화면 이동 (범위에 따라 줌 레벨 자동 조정)
    const centerYear = (selectedYears.start + year) / 2;
    const yearSpan = year - selectedYears.start;
    const zoomLevel = yearSpan > 30 ? 1.5 : yearSpan > 10 ? 2.5 : 3.5;
    
    console.log('📅 End year changed:', { start: selectedYears.start, end: year, centerYear, zoomLevel, yearSpan });
    setViewport({ x: centerYear, y: 0.5, k: zoomLevel });
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;
    
    const { width } = container.getBoundingClientRect();
    const height = 32;  // 축소: 40 → 32
    svg.selectAll("*").remove();

    const padding = 10;
    const chartWidth = width - padding * 2;

    const yearCounts = rollup(albums, v => v.length, (d: Album) => d.year);
    const data = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
      const year = minYear + i;
      return { year, count: yearCounts.get(year) || 0 };
    });

    const xScale = scaleLinear().domain([minYear, maxYear]).range([0, chartWidth]);
    const yScale = scaleLinear()
      .domain([0, max(data, d => d.count) || 1])
      .range([height, 0]);

    const g = svg.append("g").attr("transform", `translate(${padding}, 0)`);

    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => xScale(d.year))
      .attr("y", d => yScale(d.count))
      .attr("width", Math.max(1, chartWidth / data.length - 1))
      .attr("height", d => height - yScale(d.count))
      .attr("fill", d => {
        const inViewport = d.year >= viewportYearRange[0] && d.year <= viewportYearRange[1];
        if (inViewport) return "#000000";  // 뷰포트(곧 필터)에 보이는 영역
        return "#D1D5DB";  // 보이지 않는 영역 (밝은 회색)
      })
      .attr("rx", 1)
      .style("transition", "fill 0.5s ease");  // 부드러운 색상 전환

    // 뷰포트 범위 시각화
    const viewportOverlay = g.append("g").attr("class", "viewport-indicator");
    
    // 왼쪽 어두운 영역
    viewportOverlay.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", xScale(viewportYearRange[0]))
      .attr("height", height)
      .attr("fill", "rgba(255, 255, 255, 0.7)")
      .attr("pointer-events", "none");
    
    // 오른쪽 어두운 영역
    viewportOverlay.append("rect")
      .attr("x", xScale(viewportYearRange[1]))
      .attr("y", 0)
      .attr("width", chartWidth - xScale(viewportYearRange[1]))
      .attr("height", height)
      .attr("fill", "rgba(255, 255, 255, 0.7)")
      .attr("pointer-events", "none");
    
    // 뷰포트 경계선 (왼쪽)
    viewportOverlay.append("line")
      .attr("x1", xScale(viewportYearRange[0]))
      .attr("y1", 0)
      .attr("x2", xScale(viewportYearRange[0]))
      .attr("y2", height)
      .attr("stroke", "#000000")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8);
    
    // 뷰포트 경계선 (오른쪽)
    viewportOverlay.append("line")
      .attr("x1", xScale(viewportYearRange[1]))
      .attr("y1", 0)
      .attr("x2", xScale(viewportYearRange[1]))
      .attr("y2", height)
      .attr("stroke", "#000000")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8);

  }, [albums, viewportYearRange]);

  return (
    <div className="w-full space-y-2">
      {/* 장르 색상 인덱스 (축소) */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mr-1">Genres:</span>
          {MAIN_GENRES.slice(0, 6).map(genre => (
            <div key={genre} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: GENRE_COLORS[genre] }}
              />
              <span className="text-[8px] text-gray-600 font-medium">{genre}</span>
            </div>
          ))}
        </div>
        
        {/* 연도 드롭박스 (동적 옵션) */}
        <div className="flex items-center gap-2">
          {/* 왼쪽: 1950 ~ 선택된 끝 연도 */}
          <select
            value={selectedYears.start}
            onChange={(e) => handleStartYearChange(parseInt(e.target.value))}
            className="w-20 px-2 py-1 text-xs font-mono font-semibold text-black bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-black/10 focus:border-black outline-none cursor-pointer hover:bg-gray-100 transition-colors"
            title="시작 연도"
          >
            {startYearOptions.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <span className="text-gray-400 text-xs font-bold">—</span>
          {/* 오른쪽: 선택된 시작 연도 ~ 2024 */}
          <select
            value={selectedYears.end}
            onChange={(e) => handleEndYearChange(parseInt(e.target.value))}
            className="w-20 px-2 py-1 text-xs font-mono font-semibold text-black bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-black/10 focus:border-black outline-none cursor-pointer hover:bg-gray-100 transition-colors"
            title="끝 연도"
          >
            {endYearOptions.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Histogram SVG (축소) */}
      <div className="h-8 w-full">
        <svg ref={svgRef} className="w-full h-full overflow-visible" />
      </div>
    </div>
  );
};