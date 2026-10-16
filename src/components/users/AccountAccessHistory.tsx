import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import { ACCESS_HISTORY_PAGE_SIZE, accessActionLabels, historyBarangay, historyDate, type AccessAction, type AccessHistoryEntry, type AccessHistoryPage } from '../../data/accessHistory';
import { fetchAllAccessHistory } from '../../api/moderationApi';
import { useAccessHistory } from '../../hooks/useAccessHistory';

const secondary = 'rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 disabled:opacity-40';
const field = 'w-full rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-[#FFB380]';
const PAGE_SIZE = ACCESS_HISTORY_PAGE_SIZE;
const tones: Record<AccessAction, string> = {
  pause_chat: 'bg-amber-50 text-amber-800', resume_chat: 'bg-emerald-50 text-emerald-700',
  suspend_account: 'bg-rose-50 text-rose-700', restore_account: 'bg-emerald-50 text-emerald-700',
};

function transitionFor(entry: AccessHistoryEntry): [string, string] {
  if (entry.action === 'pause_chat') return ['Available', 'Messaging paused'];
  if (entry.action === 'resume_chat') return ['Messaging paused', 'Available'];
  if (entry.action === 'suspend_account') return ['Available', 'Account suspended'];
  return ['Account suspended', 'Available'];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function accessHistoryExportMarkup(entries: AccessHistoryEntry[], barangay: string): string {
  const rows = entries.map(entry => {
    const [from, to] = transitionFor(entry);
    const expiry = entry.action === 'pause_chat' && entry.new_state.chat_suspended_until
      ? `<div class="muted">Until ${escapeHtml(historyDate(entry.new_state.chat_suspended_until))}</div>` : '';
    return `<tr>
      <td><strong>${escapeHtml(entry.actor_name)}</strong><div class="muted">Official</div></td>
      <td><span class="action">${escapeHtml(accessActionLabels[entry.action])}</span></td>
      <td><strong>${escapeHtml(entry.target_name)}</strong><div class="muted">${escapeHtml(entry.target_role)} · ${escapeHtml(historyBarangay(entry.target_barangay))}</div></td>
      <td>${escapeHtml(from)} <span class="arrow">→</span> <strong>${escapeHtml(to)}</strong>${expiry}</td>
      <td class="timestamp">${escapeHtml(historyDate(entry.created_at))}<div class="muted">ID #${escapeHtml(entry.log_id.slice(-6))}</div></td>
    </tr>`;
  }).join('');
  const scope = barangay && barangay !== 'All Barangays' ? ` · ${escapeHtml(historyBarangay(barangay))}` : '';
  return `<style>
    .report { font-family: Arial, sans-serif; color: #18181b; padding: 48px; background: #fff; }
    .report h1 { margin: 0; font-size: 28px; }
    .report .subtitle { margin: 8px 0 4px; color: #71717a; font-size: 15px; }
    .report .generated { margin: 0 0 28px; color: #a1a1aa; font-size: 12px; }
    .report table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .report th { padding: 12px 14px; text-align: left; color: #71717a; border-bottom: 2px solid #e4e4e7; text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
    .report td { padding: 16px 14px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
    .report .muted { margin-top: 4px; color: #71717a; font-size: 11px; }
    .report .action { color: #047857; font-weight: 700; }
    .report .arrow { color: #a1a1aa; padding: 0 4px; }
    .report .timestamp { text-align: right; white-space: nowrap; }
    .report .footer { margin-top: 24px; color: #71717a; font-size: 12px; }
  </style><div class="report">
    <h1>SerbiSure Access History</h1>
    <p class="subtitle">Account access changes${scope}</p>
    <p class="generated">Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <table><thead><tr><th>Official / Actor</th><th>Action</th><th>User</th><th>Change</th><th>Timestamp</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="footer">${entries.length} access change${entries.length === 1 ? '' : 's'}</p>
  </div>`;
}

export function AccessHistoryTable({ entries }: { entries: AccessHistoryPage['results'] }): React.ReactElement {
  return <div className="px-4 pb-2 pt-6 sm:px-6">
    <h2 className="sr-only">Recent access changes</h2>
    <div className="overflow-x-hidden md:overflow-x-auto" role="region" aria-label="Recent access changes">
      <table className="block w-full text-left text-xs md:table">
        <thead className="hidden md:table-header-group">
          <tr className="hidden text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 md:table-row">
            <th className="px-3 pb-3">Official / Actor</th>
            <th className="px-3 pb-3">Action</th>
            <th className="px-3 pb-3">User</th>
            <th className="px-3 pb-3">Change</th>
            <th className="px-3 pb-3 text-right">Timestamp</th>
          </tr>
        </thead>
        <tbody className="block divide-y divide-zinc-100 font-medium text-zinc-700 md:table-row-group">
          {entries.map(entry => {
            const initials = entry.actor_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'OF';
            const [from, to] = transitionFor(entry);
            return <tr key={entry.log_id} className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 transition-colors hover:bg-[#F6F5F2] md:table-row md:p-0">
              <td className="col-span-2 block rounded-l-2xl px-0 py-0 align-top md:table-cell md:px-3 md:py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-black text-white" aria-hidden="true">{initials}</span>
                  <div className="min-w-0">
                    <span className="block truncate font-bold text-zinc-900">{entry.actor_name}</span>
                    <span className="mt-0.5 block text-[10px] uppercase text-zinc-400">Official</span>
                  </div>
                </div>
              </td>
              <td className="block px-0 py-0 align-top md:table-cell md:px-3 md:py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 md:hidden">Action</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[entry.action]}`}>{accessActionLabels[entry.action]}</span>
              </td>
              <td className="block px-0 py-0 align-top md:table-cell md:px-3 md:py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 md:hidden">User</p>
                <span className="block font-bold text-zinc-900">{entry.target_name}</span>
                <span className="mt-1 block text-[11px] text-zinc-500">{entry.target_role} · {historyBarangay(entry.target_barangay)}</span>
              </td>
              <td className="col-span-2 block px-0 py-0 align-top md:table-cell md:px-3 md:py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 md:hidden">Change</p>
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-zinc-400">{from}</span><span className="font-bold text-zinc-300">→</span><span className={`font-bold ${entry.action === 'suspend_account' ? 'text-rose-600' : entry.action === 'pause_chat' ? 'text-amber-700' : 'text-emerald-700'}`}>{to}</span>
                </div>
                {entry.action === 'pause_chat' && entry.new_state.chat_suspended_until && <p className="mt-1 text-[10px] text-zinc-400">Until {historyDate(entry.new_state.chat_suspended_until)}</p>}
              </td>
              <td className="col-span-2 block rounded-r-2xl border-t border-zinc-100 px-0 pt-3 text-left align-top md:table-cell md:border-0 md:px-3 md:py-4 md:text-right">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 md:hidden">Timestamp</p>
                <time dateTime={entry.created_at} className="block whitespace-nowrap text-[11px] font-semibold text-zinc-600">{historyDate(entry.created_at)}</time>
                <span className="mt-1 block text-[9px] text-zinc-400">ID #{entry.log_id.slice(-6)}</span>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

interface Props { accountId: string | undefined; role: string; barangay: string; revision: number }

export function AccountAccessHistory({ accountId, role, barangay, revision }: Props): React.ReactElement {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ search: string; action: AccessAction | ''; page: number }>({ search: '', action: '', page: 1 });
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setFilters(value => value.search === search.trim() ? value : { ...value, search: search.trim(), page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const history = useAccessHistory(accountId, role, barangay, filters, revision);
  const pages = Math.max(1, Math.ceil((history.data?.count || 0) / PAGE_SIZE));
  const rows = history.data?.results || [];
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(null);
    try {
      if (!accountId || !exportRef.current) throw new Error('Export is unavailable. Please try again.');
      const entries = await fetchAllAccessHistory({ search: filters.search, action: filters.action, barangay });
      if (!entries.length) {
        setExportMessage('No data to export for the current filters.');
        return;
      }
      exportRef.current.innerHTML = accessHistoryExportMarkup(entries, barangay);
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: 1400,
        scrollX: 0,
        scrollY: 0,
      });
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`serbisure-access-history-${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportMessage('Access history downloaded successfully.');
    } catch {
      setExportMessage('Export failed. Please try again.');
    } finally {
      if (exportRef.current) exportRef.current.innerHTML = '';
      setIsExporting(false);
      window.setTimeout(() => setExportMessage(null), 4000);
    }
  };
  return <div className="space-y-6" aria-label="Account access history">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="relative"><span className="sr-only">Search history by user, official or barangay</span><Search aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-3.5 text-zinc-400" /><input maxLength={200} className={`${field} pl-12`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search user, official or barangay" /></label>
      <label className="relative"><span className="sr-only">Filter history by action</span><select className={`${field} appearance-none pr-12`} value={filters.action} onChange={event => setFilters(value => ({ ...value, action: event.target.value as AccessAction | '', page: 1 }))}>
        <option value="">All changes</option>{(Object.entries(accessActionLabels) as [AccessAction, string][]).map(([action, label]) => <option key={action} value={action}>{label}</option>)}
      </select><ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" /></label>
      <button type="button" onClick={handleExport} disabled={isExporting} className={`${secondary} inline-flex items-center justify-center gap-2 whitespace-nowrap`} aria-label="Export access history">
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {isExporting ? 'Exporting…' : 'Export'}
      </button>
    </div>
    {exportMessage && <div role="status" className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium ${exportMessage.startsWith('Export failed') || exportMessage.startsWith('No data') ? 'border-amber-200/60 bg-amber-50 text-amber-800' : 'border-emerald-200/60 bg-emerald-50 text-emerald-700'}`}>
      {exportMessage.startsWith('Export failed') || exportMessage.startsWith('No data') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span>{exportMessage}</span>
    </div>}
    <div className="overflow-hidden rounded-3xl bg-white" aria-busy={history.loading}>
      {history.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-4 p-6"><p className="text-sm text-red-700">{history.error}</p><button type="button" className={secondary} onClick={history.refresh}>Retry</button></div>}
      {!history.data && !history.error && <p role="status" className="p-6 text-sm text-zinc-500">Loading access history…</p>}
      {history.data && !rows.length && <div className="space-y-2 p-6"><h2 className="font-semibold">{filters.search || filters.action ? 'No matching changes' : 'No access changes yet'}</h2><p className="text-sm text-zinc-500">{filters.search || filters.action ? 'Try another search or select all changes.' : 'Suspensions and restorations will appear here.'}</p></div>}
      {rows.length > 0 && <>
        <AccessHistoryTable entries={rows} />
        <footer className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <p className="text-xs text-zinc-500">Showing {(filters.page - 1) * PAGE_SIZE + 1}–{(filters.page - 1) * PAGE_SIZE + rows.length} of {history.data?.count} changes</p>
          {pages > 1 && <nav aria-label="Access history pages" className="flex items-center gap-3"><button type="button" className={secondary} disabled={history.loading || filters.page <= 1} onClick={() => setFilters(value => ({ ...value, page: value.page - 1 }))} aria-label="Previous history page"><ChevronLeft size={16} /></button><span className="text-xs text-zinc-500">{filters.page} / {pages}</span><button type="button" className={secondary} disabled={history.loading || filters.page >= pages} onClick={() => setFilters(value => ({ ...value, page: value.page + 1 }))} aria-label="Next history page"><ChevronRight size={16} /></button></nav>}
        </footer>
      </>}
    </div>
    <div ref={exportRef} aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 0, width: '1400px', pointerEvents: 'none', background: '#FFFFFF' }} />
  </div>;
}
