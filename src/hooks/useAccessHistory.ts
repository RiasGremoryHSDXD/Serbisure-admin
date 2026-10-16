import { useCallback, useEffect, useState } from 'react';
import { fetchAccessHistory } from '../api/moderationApi';
import type { AccessAction, AccessHistoryPage } from '../data/accessHistory';
import { realtime } from '../realtime';

export function useAccessHistory(accountId: string | undefined, role: string, barangay: string,
  filters: { page: number; search: string; action: AccessAction | '' }, revision: number) {
  const scope = JSON.stringify([accountId, role, barangay, filters]);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: AccessHistoryPage } | null>(null);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(value => value + 1), []);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setLoading(scope); setFailure(null);
    fetchAccessHistory({ ...filters, barangay }).then(data => {
      if (active) setSnapshot({ scope, data });
    }).catch(error => {
      if (active) setFailure({ scope, message: error instanceof Error ? error.message : 'Unable to load access history.' });
    }).finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [accountId, scope, role, barangay, filters.page, filters.search, filters.action, refreshKey, revision]);

  useEffect(() => {
    const off = realtime.subscribe(event => {
      if (event.type === 'moderation.changed' || event.type === 'sync') refresh();
    });
    const focus = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', focus);
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    return () => { off(); clearInterval(timer); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);

  return { data: snapshot?.scope === scope ? snapshot.data : null,
    loading: loading === scope, error: failure?.scope === scope ? failure.message : null, refresh };
}
