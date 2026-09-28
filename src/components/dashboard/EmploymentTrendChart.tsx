import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { fetchMonthlyTrend, MonthlyTrendPoint } from '../../api/adminApi';

export const EmploymentTrendChart: React.FC = () => {
  const { 
    isLoadingMonthlyTrend, 
    selectedBarangay, 
    barangays,
    userBarangays,
  } = useAdmin();

  // Selected barangay for the chart; defaults to Pagatpat as requested
  const [activeBarangay, setActiveBarangay] = useState<string>(() => {
    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      return selectedBarangay;
    }
    return 'Pagatpat';
  });

  const [chartData, setChartData] = useState<MonthlyTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Synchronize when parent selectedBarangay changes (e.g. from navbar selector)
  useEffect(() => {
    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      setActiveBarangay(selectedBarangay);
    }
  }, [selectedBarangay]);

  // Fetch trend data whenever activeBarangay changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const bgyToFetch = activeBarangay === 'All Barangays' ? undefined : activeBarangay;
    fetchMonthlyTrend(bgyToFetch)
      .then((res) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.trend) && res.trend.length > 0) {
          setChartData(res.trend);
          // Do NOT pre-select any month — tooltip should only appear on hover
        }
      })
      .catch((err) => {
        console.warn('[EmploymentTrendChart] Error fetching trend for', activeBarangay, err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeBarangay]);

  // Fallback data if still empty
  const DISPLAY_DATA: MonthlyTrendPoint[] = useMemo(() => {
    if (chartData.length > 0) return chartData;
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    return months.map((m) => ({
      month: m,
      year: 2026,
      employed: 0,
      on_the_job: 0,
      available: 0,
      total: 0,
    }));
  }, [chartData]);


  // Chart dimensions
  const width = 560;
  const height = 230;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 32;
  const paddingBottom = 34;

  const chartAreaWidth = width - paddingLeft - paddingRight;
  const chartAreaHeight = height - paddingTop - paddingBottom;

  // Dynamic maximum calculation
  const rawMax = Math.max(
    1,
    ...DISPLAY_DATA.map((d) => d.employed || 0),
    ...DISPLAY_DATA.map((d) => d.available || 0)
  );

  // Clean discrete integer grid scaling for realistic workforce numbers
  const maxVal = rawMax <= 5 ? 6 : rawMax <= 10 ? 12 : Math.ceil(rawMax * 1.25);

  const gridTicks = [
    Math.round(maxVal * 0.25),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.75),
    maxVal,
  ];

  // Bar slot measurements
  const slotWidth = chartAreaWidth / DISPLAY_DATA.length;
  const barWidth = 10;
  const barSpacing = 3;

  const activeHoverIdx = hoveredIdx;
  const activeHoverPoint = hoveredIdx !== null ? DISPLAY_DATA[hoveredIdx] : null;

  // Helper to normalize barangay strings
  const cleanBarangayName = (name?: string) => {
    return (name || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim();
  };

  // Complete, alphabetically sorted list of all barangays found in DB
  const barangayOptions = useMemo(() => {
    const map = new Map<string, string>();

    // Add active LGUs from context
    (barangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b.name);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          map.set(key, cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
        }
      }
    });

    // Add all registered user barangays from backend DB (e.g. Macasandig, Carmen, Agusan, etc.)
    (userBarangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          map.set(key, cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
        }
      }
    });

    // Priority focus barangays
    ['Pagatpat', 'Canitoan'].forEach((priority) => {
      const key = priority.toLowerCase();
      if (!map.has(key)) {
        map.set(key, priority);
      }
    });

    // Sort all individual barangays alphabetically
    const sorted = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    const otherBarangays = sorted.filter((b) => b !== 'Pagatpat' && b !== 'Canitoan');

    return ['All Barangays', 'Pagatpat', 'Canitoan', ...otherBarangays];
  }, [barangays, userBarangays]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between h-full relative shadow-sm border border-zinc-100">
      {/* Minimal Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-lg font-black font-display text-[#0D0D11] tracking-tight">
            Employment Trends
          </h3>
          {(isLoading || isLoadingMonthlyTrend) && (
            <div 
              className="w-3.5 h-3.5 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" 
              title="Updating live metrics..." 
            />
          )}
        </div>

        {/* Legend & Barangay Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Barangay Selector */}
          <div className="relative">
            <select
              value={activeBarangay}
              onChange={(e) => setActiveBarangay(e.target.value)}
              className="appearance-none bg-[#F4F4F0] hover:bg-[#EAEAE5] text-zinc-800 text-xs font-black font-display py-1.5 pl-3 pr-7 rounded-full border border-zinc-200/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-colors"
            >
              {barangayOptions.map((bgy) => (
                <option key={bgy} value={bgy}>
                  {bgy === 'All Barangays' ? 'All CDO Barangays' : `Brgy. ${bgy}`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Interactive Legend Pills */}
          <div className="flex items-center gap-3 text-xs font-bold text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-200/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F97316]" />
              <span>On the Job</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0D0D11]" />
              <span>Available</span>
            </div>
          </div>
        </div>
      </div>



      {/* SVG Bar Graph */}
      <div className="relative w-full overflow-hidden mt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Orange Gradient for On the Job bars */}
            <linearGradient id="onJobBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>

            {/* Dark Gradient for Available bars */}
            <linearGradient id="availableBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>

            {/* Subtle glow filter on hover */}
            <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F97316" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
          {gridTicks.map((val) => {
            const y = paddingTop + chartAreaHeight - (val / maxVal) * chartAreaHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#F0F0EC"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-zinc-400 font-semibold"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bottom baseline */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartAreaHeight}
            x2={width - paddingRight}
            y2={paddingTop + chartAreaHeight}
            stroke="#E4E4E0"
            strokeWidth="1.5"
          />

          {/* Render Bars per Month */}
          {DISPLAY_DATA.map((d, idx) => {
            const xCenter = paddingLeft + (idx + 0.5) * slotWidth;
            const isHovered = idx === activeHoverIdx;
            const isCurrentMonth = idx === DISPLAY_DATA.length - 1;

            // Bar heights
            const onJobHeight = Math.max(0, (d.employed / maxVal) * chartAreaHeight);
            const availableHeight = Math.max(0, (d.available / maxVal) * chartAreaHeight);

            const onJobY = paddingTop + chartAreaHeight - onJobHeight;
            const availableY = paddingTop + chartAreaHeight - availableHeight;

            const onJobX = xCenter - barWidth - barSpacing / 2;
            const availableX = xCenter + barSpacing / 2;

            return (
              <g
                key={`${d.month}-${d.year}`}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIdx(idx)}
              >
                {/* Hover Backdrop Column */}
                <rect
                  x={xCenter - slotWidth / 2 + 2}
                  y={paddingTop - 6}
                  width={slotWidth - 4}
                  height={chartAreaHeight + 8}
                  fill={isHovered ? '#F8F8F5' : 'transparent'}
                  rx="8"
                  className="transition-colors duration-150"
                />

                {/* On the Job Bar (Orange) */}
                <rect
                  x={onJobX}
                  y={onJobHeight > 0 ? onJobY : paddingTop + chartAreaHeight - 2}
                  width={barWidth}
                  height={Math.max(3, onJobHeight)}
                  fill="url(#onJobBarGradient)"
                  rx="3"
                  className={`transition-all duration-300 ${isHovered ? 'filter drop-shadow(0 2px 4px rgba(249,115,22,0.35))' : ''}`}
                />

                {/* Available Bar (Dark Zinc) */}
                <rect
                  x={availableX}
                  y={availableHeight > 0 ? availableY : paddingTop + chartAreaHeight - 2}
                  width={barWidth}
                  height={Math.max(3, availableHeight)}
                  fill="url(#availableBarGradient)"
                  rx="3"
                  className={`transition-all duration-300 ${isHovered ? 'filter drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : ''}`}
                />

                {/* Numeric label above bars when hovered or active */}
                {isHovered && (
                  <>
                    {d.employed > 0 && (
                      <text
                        x={onJobX + barWidth / 2}
                        y={Math.max(paddingTop + 8, onJobY - 4)}
                        textAnchor="middle"
                        className="text-[9px] fill-orange-600 font-black"
                      >
                        {d.employed}
                      </text>
                    )}
                    {d.available > 0 && (
                      <text
                        x={availableX + barWidth / 2}
                        y={Math.max(paddingTop + 8, availableY - 4)}
                        textAnchor="middle"
                        className="text-[9px] fill-zinc-800 font-black"
                      >
                        {d.available}
                      </text>
                    )}
                  </>
                )}

                {/* Month Label */}
                <text
                  x={xCenter}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-display transition-all ${
                    isHovered
                      ? 'fill-[#0D0D11] font-black text-[11px]'
                      : isCurrentMonth
                      ? 'fill-orange-600 font-extrabold'
                      : 'fill-zinc-400 font-semibold'
                  }`}
                >
                  {d.month}
                </text>

                {/* Small indicator dot for Current Month */}
                {isCurrentMonth && (
                  <circle
                    cx={xCenter}
                    cy={height - 2}
                    r="2"
                    fill="#F97316"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && activeHoverIdx !== null && activeHoverPoint && (
          <div
            className="absolute z-20 pointer-events-none transition-all duration-150 bg-[#0D0D11] text-white p-3 rounded-2xl text-xs w-44 ring-1 ring-white/10 shadow-xl"
            style={{
              left: `${Math.min(
                72,
                Math.max(
                  8,
                  ((paddingLeft + (activeHoverIdx + 0.5) * slotWidth) / width) * 100 - 18
                )
              )}%`,
              top: '12%',
            }}
          >
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
              <span className="font-black font-display text-[#FFB380] uppercase tracking-wider text-[10px]">
                {activeHoverPoint.month} {activeHoverPoint.year || 2026}
              </span>
              <span className="text-[9px] text-zinc-400 font-semibold px-1.5 py-0.5 bg-zinc-800 rounded">
                {activeBarangay === 'All Barangays' ? 'All CDO' : `Brgy. ${activeBarangay}`}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[11px] flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-[#F97316]" /> On the Job
                </span>
                <span className="font-black text-orange-400">{activeHoverPoint.employed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[11px] flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-zinc-300" /> Available
                </span>
                <span className="font-black text-white">{activeHoverPoint.available}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-400">
                <span>Total Workforce</span>
                <span className="font-bold text-zinc-200">
                  {activeHoverPoint.total || activeHoverPoint.employed + activeHoverPoint.available}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
