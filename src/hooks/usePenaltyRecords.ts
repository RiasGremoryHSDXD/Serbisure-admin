import { useEffect, useState } from 'react';
import { fetchPenaltyHistory, fetchPenaltyUsers } from '../api/penaltyApi';
import { penaltyError, type PenaltyFilters, type PenaltyPage, type PenaltyRecord, type PenaltyUser } from '../data/penalties';
import { realtime } from '../realtime';

export function usePenaltyRecords(view: 'users' | 'history', filters: PenaltyFilters, page: number) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: PenaltyPage<PenaltyUser | PenaltyRecord> | null; error: string | null; pageMissing?: boolean } | null>(null);
  const key = JSON.stringify([view, filters, page, revision]);
  useEffect(() => {
    let active = true;
    const request = view === 'users' ? fetchPenaltyUsers(filters, page) : fetchPenaltyHistory(filters, page);
    request.then(data => { if (active) setState({ key, data, error: null }); })
      .catch(error => { if (active) setState({ key, data: null, error: penaltyError(error), pageMissing: error?.status === 404 }); });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    const off = realtime.subscribe(event => { if (event.type === 'booking.changed' || event.type === 'sync') setRevision(value => value + 1); });
    const focus = () => { if (!document.hidden) setRevision(value => value + 1); };
    document.addEventListener('visibilitychange', focus);
    return () => { off(); document.removeEventListener('visibilitychange', focus); };
  }, []);
  return { data: state?.key === key ? state.data : null, error: state?.key === key ? state.error : null,
    pageMissing: state?.key === key && state.pageMissing,
    loading: state?.key !== key, refresh: () => setRevision(value => value + 1) };
}
