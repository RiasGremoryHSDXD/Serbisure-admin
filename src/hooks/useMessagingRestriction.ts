import { useEffect, useState } from 'react';
import { fetchSafetyStatus } from '../api/moderationApi';
import { realtime } from '../realtime';

export function useMessagingRestriction() {
  const [until, setUntil] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const version = ++requestVersion;
      try {
        const status = await fetchSafetyStatus();
        if (!active || version !== requestVersion) return;
        setUntil(status.restricted_until); clearTimeout(timer);
        if (status.restricted_until) {
          const remaining = Date.parse(status.restricted_until) - Date.now();
          if (remaining > 0) timer = setTimeout(() => { void refresh(); }, Math.min(remaining + 1000, 86401000));
        }
      } catch { /* Sending always rechecks the authoritative server status. */ }
    };
    void refresh();
    const off = realtime.subscribe(event => { if (event.type === 'moderation.changed' || event.type === 'sync') void refresh(); });
    const focus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', focus);
    return () => { active = false; clearTimeout(timer); off(); document.removeEventListener('visibilitychange', focus); };
  }, []);
  return until;
}
