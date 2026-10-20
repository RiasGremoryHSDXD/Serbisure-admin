import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { fetchMonthlyTrend, MonthlyTrendPoint } from '../../api/adminApi';

export const EmploymentTrendChart: React.FC = () => {
  const { 
    isLoadingMonthlyTrend, 
    selectedBarangay,
    setSelectedBarangay,
    currentUser,
    dashboardMetrics,
    barangays,
    userBarangays,
  } = useAdmin();

  // Default to the authenticated jurisdiction; no seeded barangays.
  const [activeBarangay, setActiveBarangay] = useState<string>(() => {
    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      return selectedBarangay;
    }
    return 'All Barangays';
  });

  const [chartData, setChartData] = useState<MonthlyTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const phNow = new Date(Date.now() + 8 * 3600000);
  const currentMonth = phNow.getUTCFullYear() * 12 + phNow.getUTCMonth();

  // Synchronize when parent selectedBarangay changes (e.g. from navbar selector)
  useEffect(() => {
    setActiveBarangay(selectedBarangay || 'All Barangays');
  }, [selectedBarangay]);

  // Fetch trend data whenever activeBarangay changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true); setError(null); setChartData([]); setHoveredIdx(null);

    const bgyToFetch = activeBarangay === 'All Barangays' ? undefined : activeBarangay;
    fetchMonthlyTrend(bgyToFetch)
      .then((res) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.trend)) {
          setChartData(res.trend);
          // Do NOT pre-select any month — tooltip should only appear on hover
        }
      })
      .catch(() => {
        if (isMounted) { setChartData([]); setError('Could not load employment trends. Please retry.'); }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeBarangay, attempt, currentMonth]);

  // The existing dashboard refresh also keeps this month's bars in sync with the cards.
  const DISPLAY_DATA = chartData.map((point, index) => dashboardMetrics && activeBarangay === selectedBarangay && index === chartData.length - 1
    ? { ...point, employed: dashboardMetrics.totalEmployed, available: dashboardMetrics.totalAvailable, total: dashboardMetrics.totalWorkers }
    : point);

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
    ...DISPLAY_DATA.map((d) => (d.employed ?? 0) || 0),
    ...DISPLAY_DATA.map((d) => (d.available ?? 0) || 0)
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
  const slotWidth = DISPLAY_DATA.length ? chartAreaWidth / DISPLAY_DATA.length : 0;
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

    return ['All Barangays', ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];
  }, [barangays, userBarangays]);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 min-w-0 flex flex-col justify-start h-full relative shadow-sm border border-zinc-100">
      {error && <p role="alert" className="mb-3 text-xs text-amber-800">{error} <button className="underline" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}
      {!isLoading && !error && chartData.length === 0 && <p className="mb-3 text-xs text-zinc-500">No employment trend data yet.</p>}
      {/* Minimal Header & Controls */}
      <div className="flex flex-col gap-3 mb-4 min-w-0">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base sm:text-lg font-black font-display text-[#0D0D11] tracking-tight">
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 min-w-0">
          {/* Barangay Selector */}
          <div className="relative w-full sm:w-auto min-w-0 max-w-full">
            <select
              value={activeBarangay}
              onChange={(e) => { setActiveBarangay(e.target.value); setSelectedBarangay(e.target.value); }}
              disabled={currentUser?.role === 'ADMIN'}
              aria-label="Filter employment trends by barangay"
              title={activeBarangay === 'All Barangays' ? 'All CDO Barangays' : `Brgy. ${activeBarangay}`}
              className="appearance-none min-h-10 w-full sm:w-auto max-w-full truncate bg-[#F4F4F0] hover:bg-[#EAEAE5] text-zinc-800 text-xs font-bold font-display py-2 pl-3 pr-7 rounded-xl sm:rounded-full border border-zinc-200/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-colors"
            >
              {barangayOptions.map((bgy) => (
                <option key={bgy} value={bgy}>
                  {bgy === 'All Barangays' ? 'All CDO Barangays' : `Brgy. ${bgy}`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-zinc-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F97316]" />
              <span className="whitespace-nowrap">Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0D0D11]" />
              <span>Available</span>
            </div>
          </div>
        </div>
      </div>
      {chartData.some(point => point.has_history === false) && <p className="mb-3 rounded-xl bg-zinc-50 p-3 text-[11px] sm:text-xs leading-5 text-zinc-500">Earlier months have no recorded status history. Current month uses live verified-worker counts.</p>}
      {/* Keep phone labels at their actual font size instead of scaling down the SVG. */}
      <div className="sm:hidden" role="img" aria-label="Monthly occupied and available verified workers">
        <div className="relative flex h-48 gap-2 border-b border-zinc-200 px-1 pt-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map(line => <div key={line} className="border-t border-dashed border-zinc-100" />)}
          </div>
          {DISPLAY_DATA.map(point => <div key={`${point.month}-${point.year}`} className="relative flex min-w-0 flex-1 items-end justify-center gap-1.5">
            {point.has_history === false ? <span className="self-center text-xs text-zinc-400" aria-label={`${point.month}: no history`}>—</span> : <>
              <div className="relative w-2.5 rounded-t bg-[#F97316]" style={{ height: `${((point.employed ?? 0) / maxVal) * 100}%` }}>
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-orange-600">{point.employed}</span>
              </div>
              <div className="relative w-2.5 rounded-t bg-[#0D0D11]" style={{ height: `${((point.available ?? 0) / maxVal) * 100}%` }}>
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-zinc-700">{point.available}</span>
              </div>
            </>}
          </div>)}
        </div>
        <div className="mt-2 flex gap-2 px-1">{DISPLAY_DATA.map((point, index) => <span key={`${point.month}-${point.year}`} className={`min-w-0 flex-1 text-center text-[11px] ${index === DISPLAY_DATA.length - 1 ? 'font-bold text-orange-600' : 'text-zinc-500'}`}>{point.month}</span>)}</div>
      </div>
      {/* SVG Bar Graph */}
      <div className="hidden sm:block relative w-full min-w-0 min-h-[190px] overflow-hidden mt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-h-[190px] overflow-visible select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Orange Gradient for Occupied bars */}
            <linearGradient id="occupiedBarGradient" x1="0" y1="0" x2="0" y2="1">
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

            if (d.has_history === false) return <g key={`${d.month}-${d.year}`}>
              <text x={xCenter} y={height / 2} textAnchor="middle" className="text-[9px] fill-zinc-400">No history</text>
              <text x={xCenter} y={height - 10} textAnchor="middle" className="text-[10px] fill-zinc-400">{d.month}</text>
            </g>;

            // Bar heights
            const onJobHeight = Math.max(0, ((d.employed ?? 0) / maxVal) * chartAreaHeight);
            const availableHeight = Math.max(0, ((d.available ?? 0) / maxVal) * chartAreaHeight);

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

                {/* Occupied Bar (Orange) */}
                <rect
                  x={onJobX}
                  y={onJobHeight > 0 ? onJobY : paddingTop + chartAreaHeight - 2}
                  width={barWidth}
                  height={onJobHeight}
                  fill="url(#occupiedBarGradient)"
                  rx="3"
                  className={`transition-all duration-300 ${isHovered ? 'filter drop-shadow(0 2px 4px rgba(249,115,22,0.35))' : ''}`}
                />

                {/* Available Bar (Dark Zinc) */}
                <rect
                  x={availableX}
                  y={availableHeight > 0 ? availableY : paddingTop + chartAreaHeight - 2}
                  width={barWidth}
                  height={availableHeight}
                  fill="url(#availableBarGradient)"
                  rx="3"
                  className={`transition-all duration-300 ${isHovered ? 'filter drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : ''}`}
                />

                {/* Numeric label above bars when hovered or active */}
                {isHovered && (
                  <>
                    {(d.employed ?? 0) > 0 && (
                      <text
                        x={onJobX + barWidth / 2}
                        y={Math.max(paddingTop + 8, onJobY - 4)}
                        textAnchor="middle"
                        className="text-[9px] fill-orange-600 font-black"
                      >
                        {(d.employed ?? 0)}
                      </text>
                    )}
                    {(d.available ?? 0) > 0 && (
                      <text
                        x={availableX + barWidth / 2}
                        y={Math.max(paddingTop + 8, availableY - 4)}
                        textAnchor="middle"
                        className="text-[9px] fill-zinc-800 font-black"
                      >
                        {(d.available ?? 0)}
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
            className="absolute z-20 pointer-events-none transition-all duration-150 bg-[#0D0D11] text-white p-3 rounded-2xl text-xs ring-1 ring-white/10 shadow-xl"
            style={{
              width: 'min(11rem, calc(100% - 16px))',
              // Use the tooltip's actual width to keep both edges inside the chart.
              left: `clamp(8px, calc(${((paddingLeft + (activeHoverIdx + 0.5) * slotWidth) / width) * 100}% - 5.5rem), max(8px, calc(100% - 11rem - 8px)))`,
              top: '12%',
            }}
          >
            <div className="flex flex-col items-start gap-1 pb-1.5 mb-1.5 border-b border-zinc-800 min-w-0">
              <span className="font-black font-display text-[#FFB380] uppercase tracking-wider text-[10px]">
                {activeHoverPoint.month} {activeHoverPoint.year || 2026}
              </span>
              <span title={activeBarangay} className="max-w-full truncate text-[9px] text-zinc-400 font-medium">
                {activeBarangay === 'All Barangays' ? 'All CDO' : `Brgy. ${activeBarangay}`}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[11px] flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-[#F97316]" /> Occupied
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
                  {activeHoverPoint.total ?? ((activeHoverPoint.employed ?? 0) + (activeHoverPoint.available ?? 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
