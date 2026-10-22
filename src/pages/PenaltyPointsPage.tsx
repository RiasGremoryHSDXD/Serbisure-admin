import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCw, Search } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { usePenaltyRecords } from '../hooks/usePenaltyRecords';
import { exportPenaltyHistory } from '../api/penaltyApi';
import { penaltyError, type PenaltyFilters, type PenaltyRecord, type PenaltyRole, type PenaltyScoreFilter, type PenaltyUser } from '../data/penalties';
import { PenaltyReviewDialog } from '../components/penalties/PenaltyReviewDialog';
import { PenaltyHistoryList } from '../components/penalties/PenaltyHistoryList';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40';
export function PenaltyPointsPage(): React.ReactElement | null {
  const { currentUser, currentRole, selectedBarangay } = useAdmin();
  if (!currentUser?.id) return null;
  // Remount on account/scope changes so no previous records, dialog or late export can leak across sessions.
  return <PenaltyWorkspace key={JSON.stringify([currentUser.id, currentRole, selectedBarangay])} barangay={selectedBarangay} />;
}

function PenaltyWorkspace({ barangay }: { barangay: string }): React.ReactElement {
  const [view, setView] = useState<'users' | 'history'>('users');
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [role, setRole] = useState<PenaltyRole>('');
  const [points, setPoints] = useState<PenaltyScoreFilter>('');
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null), [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const live = useRef(true), exportingRef = useRef(false);
  const filters: PenaltyFilters = { search: query, role, barangay, points: view === 'users' ? points : '' };
  const filterKey = JSON.stringify(filters), latestFilters = useRef(filterKey); latestFilters.current = filterKey;
  const records = usePenaltyRecords(view, filters, page);
  const loading = records.loading || search !== query;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (records.pageMissing && page > 1) setPage(1); }, [records.pageMissing, page]);
  const exported = async () => {
    if (exportingRef.current || loading) return;
    exportingRef.current = true; setExporting(true); setExportError(null);
    const scope = filterKey;
    try {
      const report = await exportPenaltyHistory(filters);
      if (!live.current || latestFilters.current !== scope) return;
      const url = URL.createObjectURL(report);
      const link = document.createElement('a'); link.href = url; link.download = 'penalty-adjustments.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (live.current) setExportError(penaltyError(error, 'PDF could not be exported. Please retry.')); }
    finally { exportingRef.current = false; if (live.current) setExporting(false); }
  };
  const saved = (user: PenaltyUser) => {
    setSelected(null); setNotice(`Points updated for ${user.name}: ${user.penalty_points}/3.`); records.refresh();
  };
  const count = records.data?.count || 0;
  return <section aria-labelledby="penalty-points-title" className="min-w-0 space-y-5 sm:space-y-6">
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0"><h1 id="penalty-points-title" className="text-2xl font-black font-display text-[#0D0D11]">Penalty Points</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Review cancellations and adjust monthly booking penalties.</p>
        <p className="mt-1 text-xs text-zinc-500">{barangay === 'All Barangays' ? 'All barangays' : barangay} · Points reset on the 1st of each month.</p></div>
      <button type="button" aria-label="Refresh penalty records" className={`${button} shrink-0 px-3`} disabled={loading} onClick={records.refresh}><RotateCw size={18} className={loading ? 'animate-spin' : ''} /></button>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Penalty views" className="grid w-full grid-cols-2 gap-1 rounded-full bg-zinc-200/60 p-1 sm:w-auto">
        {(['users', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={view === value}
          onClick={() => { setView(value); setPage(1); setNotice(null); setExportError(null); }}
          className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${view === value ? 'bg-[#0D0D11] text-white' : 'text-zinc-600'}`}>{value === 'users' ? 'User points' : 'Adjustment history'}</button>)}
      </nav>
      {view === 'history' && <button type="button" className={button} onClick={() => void exported()} disabled={loading || exporting || !count}><Download size={16} />{exporting ? 'Exporting…' : 'Export PDF'}</button>}
    </div>
    <div className={`grid grid-cols-2 gap-3 ${view === 'users' ? 'lg:grid-cols-[minmax(0,1fr)_auto_auto]' : 'sm:grid-cols-[minmax(0,1fr)_auto]'}`}>
      <label className={`relative col-span-2 ${view === 'users' ? 'lg:col-span-1' : 'sm:col-span-1'}`}><span className="sr-only">Search penalty records</span><Search aria-hidden size={18} className="absolute left-4 top-3.5 text-zinc-400" />
        <input className="min-h-11 w-full min-w-0 rounded-2xl bg-white py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FFB380]" maxLength={200} placeholder="Search name or barangay" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <label className={view === 'history' ? 'col-span-2 sm:col-span-1' : 'min-w-0'}><span className="sr-only">Penalty user role</span><select className="min-h-11 w-full min-w-0 rounded-2xl bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FFB380]" value={role} onChange={event => { setRole(event.target.value as PenaltyRole); setPage(1); }}>
        <option value="">All users</option><option value="Homeowner">Homeowners</option><option value="Kasambahay">Kasambahays</option>
      </select></label>
      {view === 'users' && <label className="min-w-0"><span className="sr-only">Penalty score</span><select aria-label="Penalty score" className="min-h-11 w-full min-w-0 rounded-2xl bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FFB380]" value={points} onChange={event => { setPoints(event.target.value as PenaltyScoreFilter); setPage(1); }}>
        <option value="">All scores</option><option value="with_penalties">With penalties</option><option value="0">No penalty (0)</option><option value="1">1 point</option><option value="2">2 points</option><option value="3">3 points</option>
      </select></label>}
    </div>
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
    <div className="overflow-hidden rounded-3xl bg-white" aria-busy={loading}>
      {loading ? <p role="status" className="p-6 text-sm text-zinc-500">Loading penalty records…</p> : records.error ? <div role="alert" className="space-y-3 p-6"><p className="text-sm text-red-700">{records.error}</p><button type="button" className={`${button} bg-zinc-100`} onClick={records.refresh}>Retry</button></div> : !count ? <div className="p-6 sm:p-8"><h2 className="font-bold">{view === 'users' ? 'No matching users' : 'No adjustments found'}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{view === 'users' ? 'Try another search or barangay. Only residents within your authority appear here.' : 'Manual penalty adjustments will appear here. Try clearing your filters.'}</p></div> : <>
        {view === 'history' ? <PenaltyHistoryList records={records.data!.results as PenaltyRecord[]} /> : <ul className="divide-y divide-zinc-100">{(records.data!.results as PenaltyUser[]).map(user => <li key={user.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1E7] text-sm font-bold text-orange-800 sm:h-9 sm:w-9" aria-hidden>{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><p className="text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{user.name}</p><p className="mt-0.5 text-xs leading-4 text-zinc-500">{user.account_type} · {user.barangay || 'No barangay'}</p>{user.is_restricted && <p className="mt-0.5 text-xs font-semibold leading-4 text-orange-800">Booking / posting restricted</p>}</div>
          <span className="rounded-full bg-zinc-100 px-2 py-1.5 text-xs font-bold sm:text-sm" aria-label={`${user.name}: ${user.penalty_points} of 3 penalty points`}>{user.penalty_points}/3</span>
          <button type="button" onClick={() => setSelected(user.id)} aria-label={`Review points for ${user.name}`} className="min-h-11 rounded-full bg-[#0D0D11] px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">Review</button>
        </li>)}</ul>}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 p-4 sm:px-5">
          <p className="text-xs text-zinc-500">Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, count)} of {count}</p>
          {count > 10 && <nav aria-label="Penalty pages" className="flex items-center gap-3 text-xs"><button type="button" className={`${button} bg-zinc-100 text-xs`} disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page} / {Math.ceil(count / 10)}</span><button type="button" className={`${button} bg-zinc-100 text-xs`} disabled={page * 10 >= count} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
        </footer>
      </>}
    </div>
    {selected && <PenaltyReviewDialog key={selected} userId={selected} onClose={() => setSelected(null)} onSaved={saved} />}
  </section>;
}
