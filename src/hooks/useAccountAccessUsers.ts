import { useCallback, useEffect, useState } from 'react';
import { fetchAccountAccessUsers } from '../api/moderationApi';
import type { AccountAccessUser } from '../data/accountAccess';
import { realtime } from '../realtime';

export function useAccountAccessUsers(accountId: string | undefined, role: string, barangay: string) {
  const scope = JSON.stringify([accountId, role, barangay]);
  const [snapshot, setSnapshot] = useState<{ scope: string; users: AccountAccessUser[] } | null>(null);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setLoading(scope); setFailure(null);
    fetchAccountAccessUsers(barangay).then(users => {
      if (active) setSnapshot({ scope, users: users.filter(user => user.id !== accountId) });
    }).catch(error => {
      if (active) setFailure({ scope, message: error instanceof Error ? error.message : 'Unable to load accounts. Please retry.' });
    }).finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [accountId, scope, barangay, revision]);

  useEffect(() => {
    const off = realtime.subscribe(event => {
      if (event.type === 'moderation.changed' || event.type === 'sync') refresh();
    });
    const focus = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', focus);
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    return () => { off(); clearInterval(timer); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);

  return {
    users: snapshot?.scope === scope ? snapshot.users : [],
    loaded: snapshot?.scope === scope,
    loading: loading === scope,
    error: failure?.scope === scope ? failure.message : null,
    refresh,
  };
}
