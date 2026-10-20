import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCw, Search } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { AccountAccessTable } from '../components/users/AccountAccessTable';
import { accessPage, filterAccessUsers, type ResidentRoleFilter, type AccessFilter } from '../data/accountAccess';
import { useAccountAccessUsers } from '../hooks/useAccountAccessUsers';
import { AccountAccessHistory } from '../components/users/AccountAccessHistory';

const field = 'w-full min-w-0 min-h-11 rounded-2xl bg-white px-3 sm:px-4 py-3 text-sm text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-[#FFB380]';
const selectField = `${field} appearance-none pr-8 sm:pr-12 text-ellipsis`;
const secondary = 'inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40';

export function AccountAccessPage(): React.ReactElement {
  const { currentUser, currentRole, selectedBarangay, refreshUsers } = useAdmin();
  const roster = useAccountAccessUsers(currentUser?.id, currentRole, selectedBarangay);
  const scope = JSON.stringify([currentUser?.id, currentRole, selectedBarangay]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ResidentRoleFilter>('ALL');
  const [access, setAccess] = useState<AccessFilter>('ALL');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState<{ scope: string; name: string } | null>(null);
  const [view, setView] = useState<'accounts' | 'history'>('accounts');
  const [historyRevision, setHistoryRevision] = useState(0);
  useEffect(() => { setSearch(''); setRole('ALL'); setAccess('ALL'); setPage(1); setSaved(null); }, [scope]);
  useEffect(() => { setPage(1); }, [search, role, access]);
  useEffect(() => {
    const expiries = roster.users.map(user => Date.parse(user.chatSuspendedUntil || '')).filter(value => value > now);
    if (!expiries.length) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.min(...expiries) - Date.now() + 50, 2147483647));
    return () => clearTimeout(timer);
  }, [roster.users, now]);
  useEffect(() => {
    const focus = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, []);
  const filtered = filterAccessUsers(roster.users, search, role, access, now);
  const { page: currentPage, totalPages, rows } = accessPage(filtered, page);
  const onSaved = (name: string) => {
    if (scopeRef.current !== scope) return;
    setSaved({ scope, name }); roster.refresh(); void refreshUsers();
  };
  const reset = () => { setSearch(''); setRole('ALL'); setAccess('ALL'); setPage(1); };

  return <section className="min-w-0 space-y-5 sm:space-y-8" aria-labelledby="account-access-title">
    <header className="flex items-start justify-between gap-3 sm:gap-6">
      <div className="min-w-0"><h1 id="account-access-title" className="text-2xl font-black font-display text-[#0D0D11]">Account Access</h1><p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-zinc-500">Manage messaging and account suspensions.</p></div>
      <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-40" disabled={view === 'accounts' && roster.loading} onClick={() => view === 'accounts' ? roster.refresh() : setHistoryRevision(value => value + 1)} aria-label={view === 'accounts' ? 'Refresh accounts' : 'Refresh access history'}><RotateCw size={18} className={view === 'accounts' && roster.loading ? 'animate-spin' : ''} /></button>
    </header>
    <nav aria-label="Account access views" className="grid grid-cols-2 sm:flex w-full sm:w-fit gap-1 rounded-full bg-zinc-200/60 p-1">
      {(['accounts', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`min-w-0 min-h-11 rounded-full px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${view === value ? 'bg-[#0D0D11] text-white' : 'text-zinc-600 hover:bg-white/60'}`}>{value === 'accounts' ? 'Accounts' : 'Access history'}</button>)}
    </nav>
    {view === 'history' ? <AccountAccessHistory key={scope} accountId={currentUser?.id} role={currentRole} barangay={selectedBarangay} revision={historyRevision} /> : <>
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="relative min-w-0 col-span-2 sm:col-span-1"><span className="sr-only">Search users or barangay</span><Search aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-3.5 text-zinc-400" /><input className={`${field} pl-12 sm:pl-12`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or barangay" /></label>
      <label><span className="sr-only">User type</span><div className="relative"><select className={selectField} value={role} onChange={event => setRole(event.target.value as ResidentRoleFilter)}><option value="ALL">All users</option><option value="HOMEOWNER">Homeowners</option><option value="KASAMBAHAY">Kasambahays</option></select><ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" /></div></label>
      <label><span className="sr-only">Access status</span><div className="relative"><select className={selectField} value={access} onChange={event => setAccess(event.target.value as AccessFilter)}><option value="ALL">All access</option><option value="available">Available</option><option value="chat_paused">Messaging paused</option><option value="account_suspended">Account suspended</option><option value="deactivated">Deactivated</option></select><ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" /></div></label>
    </div>
    {saved?.scope === scope && <p role="status" className="text-sm text-emerald-700">Access updated for {saved.name}.</p>}
    {roster.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6"><p className="text-sm text-red-700">{roster.error}</p><button type="button" className={secondary} disabled={roster.loading} onClick={roster.refresh}>Retry</button></div>}
    <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-white" aria-busy={roster.loading}>
      {!roster.loaded && !roster.error ? <p role="status" className="p-6 text-sm text-zinc-500">Loading accounts…</p> : roster.loaded && !rows.length ? <div className="space-y-4 p-6 sm:p-8"><h2 className="font-bold">{roster.users.length ? 'No matching users' : 'No accounts to manage'}</h2><p className="text-sm leading-6 text-zinc-500">{roster.users.length ? 'Try another name or clear the filters.' : 'Homeowners and Kasambahays you can manage will appear here.'}</p>{roster.users.length > 0 && <button className={secondary} onClick={reset}>Clear filters</button>}</div> : roster.loaded && <>
        <AccountAccessTable users={rows} now={now} onSaved={onSaved} disabled={!!roster.error || roster.loading} />
        <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
          <p className="text-xs text-zinc-500">Showing {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, filtered.length)} of {filtered.length} {filtered.length === 1 ? 'user' : 'users'}</p>
          {totalPages > 1 && <nav className="flex items-center gap-4" aria-label="Account pages"><button className={secondary} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span className="text-xs text-zinc-500">{currentPage} / {totalPages}</span><button className={secondary} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>}
        </footer>
      </>}
    </div>
    </>}
  </section>;
}
