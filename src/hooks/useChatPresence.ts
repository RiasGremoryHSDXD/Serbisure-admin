import { useEffect, useState } from 'react';
import { realtime } from '../realtime';

/** Unknown until confirmed; clear stale green dots when our connection is lost. */
export function useChatPresence(account: string | null, partnerIds: string[]) {
  const key = JSON.stringify([...new Set(partnerIds)].slice(-100));
  const [snapshot, setSnapshot] = useState<{ account: string | null; statuses: Record<string, { online: boolean; expires: number }> }>({ account: null, statuses: {} });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setSnapshot({ account, statuses: {} });
    if (!account) return;
    const ids: string[] = JSON.parse(key);
    const offEvent = realtime.subscribe(event => {
      if (event.type !== 'presence.changed' || !event.partner_id || !ids.includes(event.partner_id)) return;
      const id = event.partner_id;
      setSnapshot(prev => {
        const statuses = { ...(prev.account === account ? prev.statuses : {}) };
        if (typeof event.is_online !== 'boolean') delete statuses[id];
        else statuses[id] = { online: event.is_online, expires: Date.now() + 65000 };
        return { account, statuses };
      });
      setNow(Date.now());
    });
    const offStatus = realtime.subscribeStatus(status => {
      if (status !== 'connected') setSnapshot({ account, statuses: {} });
    });
    const unwatch = realtime.watchPresence(ids);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { offEvent(); offStatus(); unwatch(); window.clearInterval(timer); };
  }, [account, key]);
  return (partnerId: string): boolean | undefined => {
    const value = snapshot.account === account ? snapshot.statuses[partnerId] : undefined;
    return value && value.expires > now ? value.online : undefined;
  };
}
