import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, RotateCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import {
  fetchVerificationStatusStats,
  VerificationStatusStats,
} from '../../api/adminApi';

interface StatusItemConfig {
  key: keyof VerificationStatusStats;
  label: string;
  dotColor: string;
  barGradient: string;
  badgeBase: string;
  badgeActive: string;
  footerBadge: string;
  description: string;
}

// Brand-aligned status configuration: emerald, brand-orange, slate, rose
const STATUS_CONFIG: StatusItemConfig[] = [
  {
    key: 'verified',
    label: 'Verified',
    dotColor: '#10B981',
    barGradient: 'from-emerald-400 to-emerald-600',
    badgeBase: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    badgeActive: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
    footerBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    description: 'Government ID and documents fully verified',
  },
  {
    key: 'pending',
    label: 'Pending',
    dotColor: '#F5A066',
    barGradient: 'from-[#FFB380] to-[#EA580C]',
    badgeBase: 'bg-orange-50 text-orange-700 border-orange-200/60',
    badgeActive: 'bg-[#F5A066] text-white shadow-sm shadow-orange-500/20',
    footerBadge: 'bg-orange-50 text-orange-700 border-orange-200/50',
    description: 'Submitted documents awaiting admin review',
  },
  {
    key: 'unverified',
    label: 'Unverified',
    dotColor: '#94A3B8',
    barGradient: 'from-slate-300 to-slate-500',
    badgeBase: 'bg-slate-100 text-slate-700 border-slate-200/60',
    badgeActive: 'bg-slate-600 text-white shadow-sm shadow-slate-500/20',
    footerBadge: 'bg-slate-50 text-slate-600 border-slate-200/50',
    description: 'Account created but no documents uploaded yet',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    dotColor: '#F43F5E',
    barGradient: 'from-rose-400 to-rose-600',
    badgeBase: 'bg-rose-50 text-rose-700 border-rose-200/60',
    badgeActive: 'bg-rose-500 text-white shadow-sm shadow-rose-500/20',
    footerBadge: 'bg-rose-50 text-rose-700 border-rose-200/50',
    description: 'Document invalid, expired, or rejected',
  },
];

export const VerificationStatusChart: React.FC = () => {
  const { selectedBarangay, barangays, userBarangays } = useAdmin();

  // Idiot-proof default: Default to 'All Barangays' for superadmin context or fallback
  const [activeBarangay, setActiveBarangay] = useState<string>(() => {
    if (!selectedBarangay || selectedBarangay === 'All Barangays') return 'All Barangays';
    return selectedBarangay;
  });

  const [stats, setStats] = useState<VerificationStatusStats>({
    verified: 0,
    pending: 0,
    unverified: 0,
    rejected: 0,
  });
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitialLoaded, setHasInitialLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Sync state whenever AdminContext changes
  useEffect(() => {
    if (selectedBarangay) {
      setActiveBarangay(selectedBarangay);
    }
  }, [selectedBarangay]);

  // Robust data loader with retry capability
  const loadStats = useCallback((bgy: string) => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const bgyParam = bgy === 'All Barangays' ? undefined : bgy;

    fetchVerificationStatusStats(bgyParam)
      .then((res) => {
        if (!isMounted) return;
        setStats(res.stats || { verified: 0, pending: 0, unverified: 0, rejected: 0 });
        setTotal(res.total ?? 0);
        setError(null);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.warn('[VerificationStatusChart] Error fetching stats for', bgy, err);
        setError(err?.message || 'Unable to connect to verification server. Please retry.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          setHasInitialLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadStats(activeBarangay);
    return cleanup;
  }, [activeBarangay, loadStats]);

  const cleanBarangayName = (name?: string) => (name || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim();

  const barangayOptions = useMemo(() => {
    const map = new Map<string, string>();
    (barangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b.name);
      if (cleaned && !['all', 'all barangays', 'unassigned'].includes(cleaned.toLowerCase())) {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) map.set(key, cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    });
    (userBarangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b);
      if (cleaned && !['all', 'all barangays', 'unassigned'].includes(cleaned.toLowerCase())) {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) map.set(key, cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    });
    ['Pagatpat', 'Canitoan'].forEach((p) => {
      if (!map.has(p.toLowerCase())) map.set(p.toLowerCase(), p);
    });

    // Ensure activeBarangay is always selectable even if custom
    if (activeBarangay && activeBarangay !== 'All Barangays') {
      const cleaned = cleanBarangayName(activeBarangay);
      if (cleaned && !map.has(cleaned.toLowerCase())) {
        map.set(cleaned.toLowerCase(), cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    const others = sorted.filter((b) => b !== 'Pagatpat' && b !== 'Canitoan');
    return ['All Barangays', 'Pagatpat', 'Canitoan', ...others];
  }, [barangays, userBarangays, activeBarangay]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between h-full relative shadow-sm border border-zinc-100">
      {/* Header: Title, Loading Indicator & Barangay Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-lg font-black font-display text-[#0D0D11] tracking-tight">
            Verification Status
          </h3>
          {isLoading && (
            <div
              className="w-3.5 h-3.5 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"
              title="Updating metrics..."
            />
          )}
        </div>

        {/* Barangay Selector */}
        <div className="relative">
          <select
            value={activeBarangay}
            onChange={(e) => setActiveBarangay(e.target.value)}
            disabled={barangayOptions.length === 0}
            className="appearance-none bg-[#F4F4F0] hover:bg-[#EAEAE5] text-zinc-800 text-xs font-black font-display py-1.5 pl-3 pr-7 rounded-full border border-zinc-200/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {barangayOptions.map((bgy) => (
              <option key={bgy} value={bgy}>
                {bgy === 'All Barangays' ? 'All CDO Barangays' : `Brgy. ${bgy}`}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 flex flex-col justify-center min-h-[210px]">
        {/* Error State with Retry Button */}
        {error ? (
          <div className="flex flex-col items-center justify-center p-6 text-center my-auto min-h-[190px] bg-red-50/50 rounded-2xl border border-red-100">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-xs font-bold text-zinc-800 mb-1">Failed to Load Verification Stats</p>
            <p className="text-[11px] text-zinc-500 max-w-xs mb-3">{error}</p>
            <button
              onClick={() => loadStats(activeBarangay)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold rounded-full transition-all shadow-sm shadow-orange-500/20 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !hasInitialLoaded && isLoading ? (
          /* Shimmer Loading Skeleton matching horizontal row layout */
          <div className="my-auto space-y-3 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl animate-pulse">
                <div className="flex items-center gap-2.5 w-28 sm:w-32 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-200 shrink-0" />
                  <div className="w-20 h-4 bg-zinc-200 rounded-md" />
                </div>
                <div className="w-8 h-5 bg-zinc-200 rounded-full shrink-0" />
                <div className="flex-1 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-200/60 rounded-full w-1/3" />
                </div>
                <div className="w-9 h-4 bg-zinc-200 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-6 text-center my-auto min-h-[190px] bg-zinc-50/60 rounded-2xl border border-dashed border-zinc-200">
            <ShieldCheck className="w-8 h-8 text-zinc-400 mb-2" />
            <p className="text-xs font-bold text-zinc-700">No registered accounts found</p>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
              {activeBarangay === 'All Barangays'
                ? 'No homeowner or kasambahay accounts have registered yet.'
                : `No user accounts registered under Brgy. ${activeBarangay} yet.`}
            </p>
          </div>
        ) : (
          /* Horizontal Progress Bars Layout */
          <div
            className="my-auto py-1 space-y-2.5"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {STATUS_CONFIG.map((s, idx) => {
              const value = stats[s.key] || 0;
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={s.key}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  className={`group relative flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl transition-all duration-150 cursor-pointer ${
                    isHovered ? 'bg-[#F6F5F2]' : 'hover:bg-[#F6F5F2]/50'
                  }`}
                >
                  {/* Status Indicator & Label */}
                  <div className="flex items-center gap-2.5 w-28 sm:w-32 shrink-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full transition-transform duration-200 shrink-0"
                      style={{
                        backgroundColor: s.dotColor,
                        transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      }}
                    />
                    <span className="text-xs sm:text-sm font-bold font-display text-zinc-700 group-hover:text-[#0D0D11] transition-colors truncate">
                      {s.label}
                    </span>
                  </div>

                  {/* Count Pill Badge */}
                  <span
                    className={`text-xs font-black font-display px-2.5 py-0.5 rounded-full border transition-all duration-200 tabular-nums shrink-0 ${
                      isHovered ? s.badgeActive : s.badgeBase
                    }`}
                  >
                    {value}
                  </span>

                  {/* Horizontal Bar Track */}
                  <div className="flex-1 h-2.5 bg-[#F0F0EC] rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.barGradient} transition-all duration-500 ease-out`}
                      style={{
                        width: total > 0 ? `${Math.max(value > 0 ? 3 : 0, (value / total) * 100)}%` : '0%',
                        opacity: isHovered ? 1 : 0.85,
                      }}
                    />
                  </div>

                  {/* Percentage */}
                  <span className="text-xs font-bold font-display text-zinc-400 group-hover:text-zinc-800 transition-colors w-10 text-right tabular-nums shrink-0">
                    {pct}%
                  </span>

                  {/* Contextual Tooltip Popover on Hover */}
                  {isHovered && (
                    <div
                      className={`absolute right-2 z-30 pointer-events-none bg-[#0D0D11] text-white p-3 rounded-2xl text-xs w-52 ring-1 ring-white/10 shadow-xl transition-all duration-150 ${
                        idx >= 2 ? 'bottom-full mb-2' : 'top-full mt-2'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
                        <span
                          className="font-black font-display uppercase tracking-wider text-[10px]"
                          style={{ color: s.dotColor }}
                        >
                          {s.label}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-semibold px-1.5 py-0.5 bg-zinc-800 rounded">
                          {activeBarangay === 'All Barangays' ? 'All CDO' : `Brgy. ${activeBarangay}`}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px] flex items-center gap-1.5 font-medium">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: s.dotColor }}
                            />
                            Accounts
                          </span>
                          <span className="font-black" style={{ color: s.dotColor }}>
                            {value}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px] font-medium">Share</span>
                          <span className="font-black text-white">{pct}%</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80 leading-tight">
                          {s.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Summary with Total Registered and 4 Complete Status Badges */}
      <div className="mt-4 pt-3.5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
          <span>Total Registered:</span>
          <span className="font-black text-[#0D0D11]">{total} accounts</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {STATUS_CONFIG.map((s) => (
            <span
              key={s.key}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${s.footerBadge}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: s.dotColor }}
              />
              {stats[s.key] || 0} {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
