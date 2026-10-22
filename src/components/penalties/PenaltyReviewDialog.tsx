import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { adjustPenalty, fetchPenaltyReview } from '../../api/penaltyApi';
import { createRequestId } from '../../utils/requestId';
import { penaltyDate, penaltyError, validatePenaltyDraft, type PenaltyReview, type PenaltyUser } from '../../data/penalties';
import { PenaltyHistoryList } from './PenaltyHistoryList';

const field = 'mt-1 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-[#FFB380]';
export function PenaltyReviewDialog({ userId, onClose, onSaved }: {
  userId: string; onClose: () => void; onSaved: (user: PenaltyUser) => void;
}) {
  const [review, setReview] = useState<PenaltyReview | null>(null);
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null), [saveError, setSaveError] = useState<string | null>(null);
  const [delta, setDelta] = useState(-1), [reason, setReason] = useState('');
  const [verified, setVerified] = useState(false), [reference, setReference] = useState(''), [bookingId, setBookingId] = useState('');
  const [busy, setBusy] = useState(false), [conflicted, setConflicted] = useState(false);
  const pending = useRef(false), live = useRef(true), initialized = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => { live.current = false; previous?.focus?.(); };
  }, []);
  useEffect(() => {
    let active = true; setReview(null); setLoadError(null);
    fetchPenaltyReview(userId, page).then(data => {
      if (!active) return;
      setReview(data); setConflicted(false);
      if (!initialized.current) { initialized.current = true; setDelta(data.user.penalty_points ? -1 : 1); }
    }).catch(error => { if (active) setLoadError(penaltyError(error)); });
    return () => { active = false; };
  }, [userId, page, revision]);
  const draft = { points_delta: delta, reason, report_verified: verified, incident_reference: reference, ...(bookingId ? { booking_id: bookingId } : {}) };
  const invalid = review ? validatePenaltyDraft(review.user, draft) : 'Loading score…';
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!review || pending.current || conflicted) return;
    if (invalid) { setSaveError(invalid); return; }
    pending.current = true; setBusy(true); setSaveError(null);
    try {
      const signature = JSON.stringify([userId, review.user.penalty_points, review.user.penalty_month, draft]);
      if (attempt.current?.signature !== signature) attempt.current = { signature, id: createRequestId() };
      const result = await adjustPenalty(review.user, draft, attempt.current.id);
      if (live.current) onSaved(result.user);
    } catch (error) {
      if (live.current) {
        setSaveError(penaltyError(error, 'The adjustment was not confirmed. Retry to check the same request.'));
        if ((error as { status?: number })?.status === 409) setConflicted(true);
      }
    } finally { pending.current = false; if (live.current) setBusy(false); }
  };

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3 sm:p-5"
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="penalty-review-title" aria-busy={busy}
      className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
          if (!controls?.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <header className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <h2 id="penalty-review-title" className="text-lg font-bold">Review penalty points</h2>
        <button ref={close} type="button" aria-label="Close penalty review" disabled={busy} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 disabled:opacity-40"><X size={18} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
        {loadError && <div role="alert" className="space-y-3 text-sm text-red-700"><p>{loadError}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="rounded-full bg-zinc-100 px-4 py-3 text-zinc-800">Retry</button></div>}
        {!review && !loadError && <p role="status" className="text-sm text-zinc-500">Loading penalty review…</p>}
        {review && <>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#FFF1E7] p-4">
            <div className="min-w-0"><p className="font-bold [overflow-wrap:anywhere]">{review.user.name}</p><p className="mt-1 text-xs text-zinc-600">{review.user.account_type} · {review.user.barangay || 'No barangay'}</p></div>
            <strong className="shrink-0 text-2xl">{review.user.penalty_points}/3</strong>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">{review.user.is_restricted ? 'Booking and posting are currently restricted. ' : ''}Points reset on {penaltyDate(review.user.resets_at)}. Messaging and account suspensions are managed separately.</p>
          <section className="mt-6" aria-label="This month’s cancellations">
            <h3 className="font-semibold">This month’s cancellations</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Review the cancellation, then verify any safety report with the user or barangay records.</p>
            {!review.cancellations.results.length ? <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">No cancellations recorded this month.</p> : <ul className="mt-3 space-y-2">{review.cancellations.results.map(item => <li key={item.booking_id} className="rounded-xl border border-zinc-100 p-3">
              <label className="flex cursor-pointer items-start gap-3"><input className="mt-1 h-4 w-4 accent-[#0D0D11]" type="radio" name="cancellation" checked={bookingId === item.booking_id} disabled={busy} onChange={() => setBookingId(item.booking_id)} />
                <span className="min-w-0 text-sm"><span className="block font-semibold">{item.service_category.join(', ').replace(/_/g, ' ')} · {item.cancellation_penalty_points} original point(s)</span>
                  <span className="mt-1 block text-zinc-600 [overflow-wrap:anywhere]">{item.cancellation_reason}</span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">Cancelled {penaltyDate(item.cancelled_at)} · Scheduled {penaltyDate(item.start_time)} · #{item.booking_id.slice(0, 8)}</span></span>
              </label>
            </li>)}</ul>}
            {bookingId && <button type="button" disabled={busy} onClick={() => setBookingId('')} className="mt-2 min-h-11 text-xs font-semibold text-zinc-600">Clear linked cancellation</button>}
            {review.cancellations.count > 10 && <div className="mt-3 flex items-center justify-between gap-3 text-xs"><button type="button" disabled={busy || page === 1} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-full bg-zinc-100 px-4 disabled:opacity-40">Previous cancellations</button><span>{page} / {Math.ceil(review.cancellations.count / 10)}</span><button type="button" disabled={busy || page * 10 >= review.cancellations.count} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-full bg-zinc-100 px-4 disabled:opacity-40">Next cancellations</button></div>}
          </section>
          <form className="mt-6 space-y-4" onSubmit={save} noValidate>
            <label className="block text-sm font-semibold">Adjustment<select aria-label="Points adjustment" className={field} value={delta} disabled={busy} onChange={event => setDelta(Number(event.target.value))}>
              {[-1, -2, -3, 1, 2, 3].map(value => <option key={value} value={value}>{value > 0 ? 'Add' : 'Deduct'} {Math.abs(value)} point{Math.abs(value) > 1 ? 's' : ''}</option>)}
            </select></label>
            <p className={`text-sm font-semibold ${review.user.penalty_points + delta < 0 || review.user.penalty_points + delta > 3 ? 'text-red-700' : 'text-zinc-700'}`}>New score: {review.user.penalty_points + delta}/3{review.user.penalty_points + delta === 3 ? ' · Booking and posting will be restricted.' : ''}</p>
            <label className="block text-sm font-semibold">Reason / incident notes<textarea aria-label="Reason or incident notes" className={`${field} min-h-28 resize-y font-normal`} value={reason} disabled={busy} minLength={10} maxLength={2000} onChange={event => setReason(event.target.value)} placeholder="Explain the review and why these points should change." /><span className="mt-1 block text-xs font-normal text-zinc-500">At least 10 characters. Do not include unnecessary personal details.</span></label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0D0D11]" checked={verified} disabled={busy} onChange={event => { setVerified(event.target.checked); if (!event.target.checked) setReference(''); }} />I verified the safety / incident report</label>
            {verified && <label className="block text-sm font-semibold">Report or blotter reference<input aria-label="Report or blotter reference" className={field} maxLength={100} value={reference} disabled={busy} onChange={event => setReference(event.target.value)} placeholder="e.g. BLT-2026-001" /></label>}
            <p className="text-xs leading-5 text-zinc-500">Every adjustment is recorded permanently with your name, the point change and these notes.</p>
            {invalid && <p className="text-xs text-zinc-600">{invalid}</p>}
            {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            {conflicted && <button type="button" onClick={() => { attempt.current = null; setSaveError(null); setRevision(value => value + 1); }} className="min-h-11 rounded-full bg-zinc-100 px-4 text-sm font-semibold">Refresh score</button>}
            <div className="flex gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 flex-1 rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold disabled:opacity-40">Close</button><button type="submit" disabled={busy || !!invalid || conflicted} className="min-h-11 flex-1 rounded-full bg-[#0D0D11] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Apply adjustment'}</button></div>
          </form>
          {review.recent_adjustments.length > 0 && <section className="mt-6 border-t border-zinc-100 pt-5"><h3 className="font-semibold">Recent adjustments</h3><PenaltyHistoryList records={review.recent_adjustments} /></section>}
        </>}
      </div>
    </div>
  </div>, document.body);
}
