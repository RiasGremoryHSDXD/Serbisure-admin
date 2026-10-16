import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { fetchSuspension, updateSuspension, type SuspensionState, type SuspensionAction } from '../../api/moderationApi';
import { realtime } from '../../realtime';

interface Props { userId: string; name: string; onSaved: () => void; disabled?: boolean }
const subtle = 'rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50';

export function AccountControls({ userId, name, onSaved, disabled = false }: Props): React.ReactElement {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SuspensionState | null>(null);
  const [action, setAction] = useState<SuspensionAction>('pause_chat');
  const [hours, setHours] = useState('24');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setState(null); setError(''); setConfirm(false);
    fetchSuspension(userId).then(value => {
      if (active) { setState(value); setAction(value.is_account_suspended ? 'restore_account' : 'pause_chat'); }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load access settings.'); });
    return () => { active = false; };
  }, [userId, open, revision]);
  useEffect(() => {
    if (!open) return;
    return realtime.subscribe(event => {
      if (!busy && (event.type === 'moderation.changed' || event.type === 'sync')) setRevision(value => value + 1);
    });
  }, [open, busy]);

  const close = () => { if (!busy) { setOpen(false); setConfirm(false); } };
  const pauseActive = !!state?.chat_suspended_until && Date.parse(state.chat_suspended_until) > Date.now();
  const currentStatus = !state?.is_active
    ? 'Account inactive'
    : state?.is_account_suspended
      ? 'Account suspended'
      : pauseActive
        ? 'Messaging paused'
        : 'Available';
  const statusTone = !state?.is_active
    ? 'bg-zinc-100 text-zinc-600'
    : state?.is_account_suspended
      ? 'bg-rose-50 text-rose-700'
      : pauseActive
        ? 'bg-amber-50 text-amber-800'
        : 'bg-emerald-50 text-emerald-700';
  const actionDescription = action === 'suspend_account'
    ? 'Blocks all app access, including support messages.'
    : action === 'restore_account'
      ? 'Restores app access for this user.'
      : action === 'resume_chat'
        ? 'Allows the user to message residents again.'
        : 'Pauses resident chats. Support and Barangay messages stay open.';
  const formattedPauseExpiry = pauseActive && state?.chat_suspended_until
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(state.chat_suspended_until))
    : null;
  const save = async () => {
    if (busy || !state?.can_manage) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy(true); setError('');
    try {
      const until = action === 'pause_chat' ? new Date(Date.now() + Number(hours) * 3600000).toISOString() : undefined;
      await updateSuspension(userId, action, until);
      onSaved(); setOpen(false); setConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update access. Refresh before retrying.');
      setConfirm(false);
    } finally { setBusy(false); }
  };
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-label={`Manage access for ${name}`} className={subtle} onClick={() => setOpen(true)} title={`Manage access for ${name}`}>Manage access</button>
    {open && <dialog ref={dialog} aria-labelledby="access-title" onCancel={event => { event.preventDefault(); close(); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md overflow-hidden rounded-3xl bg-white p-0 text-left text-zinc-900 shadow-2xl backdrop:bg-black/40">
      <header className="flex items-start justify-between gap-5 border-b border-zinc-100 px-6 py-5 sm:px-7">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Account access</p>
          <h2 id="access-title" className="mt-1 text-xl font-bold">Manage access</h2>
          <p className="mt-1 break-words text-sm text-zinc-500">{name}</p>
          {state && <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>{currentStatus}</span>}
        </div>
        <button type="button" aria-label="Close access settings" disabled={busy} onClick={close} className="shrink-0 rounded-full bg-zinc-100 p-3 transition-colors hover:bg-zinc-200"><X size={20} /></button>
      </header>
      <div className="px-6 py-6 sm:px-7">
        {!state && !error && <p role="status" className="text-sm text-zinc-500">Loading access settings…</p>}
        {error && <div role="alert" className="space-y-4 text-sm text-red-700"><p>{error}</p>{!state && <button type="button" className={subtle} onClick={() => setRevision(value => value + 1)}>Retry</button>}</div>}
        {state && <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
          {formattedPauseExpiry && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">Messaging is paused until <strong>{formattedPauseExpiry}</strong>.</p>}
          <label className="block text-left" htmlFor={`access-action-${userId}`}>
            <span className="text-sm font-semibold text-zinc-800">Change access</span>
            <div className="relative mt-2">
              <select id={`access-action-${userId}`} disabled={busy || !state.can_manage} value={action} onChange={event => { setAction(event.target.value as SuspensionAction); setConfirm(false); }} className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 pr-12 text-sm font-semibold text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:bg-white">
                {!state.is_account_suspended && <option value="pause_chat">Pause messaging</option>}
                {pauseActive && <option value="resume_chat">Lift messaging pause</option>}
                <option value={state.is_account_suspended ? 'restore_account' : 'suspend_account'}>{state.is_account_suspended ? 'Restore account' : 'Suspend account'}</option>
              </select>
              <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
          </label>
          {action === 'pause_chat' && <label className="block text-left" htmlFor={`access-duration-${userId}`}>
            <span className="text-sm font-semibold text-zinc-800">Pause for</span>
            <div className="relative mt-2">
              <select id={`access-duration-${userId}`} value={hours} disabled={busy || !state.can_manage} onChange={event => { setHours(event.target.value); setConfirm(false); }} className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 pr-12 text-sm font-semibold text-zinc-800 outline-none transition-colors focus:border-zinc-400 focus:bg-white">
                <option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option>
              </select>
              <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
          </label>}
          <p className="text-sm leading-5 text-zinc-500">{actionDescription}</p>
          {confirm && <div role="status" className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm leading-5 text-zinc-800"><strong>Apply this change to {name}?</strong><span className="mt-1 block text-zinc-500">Your official account will be recorded.</span></div>}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-5">
            <button type="button" disabled={busy} className={subtle} onClick={close}>Cancel</button>
            <button type="submit" disabled={busy || !state.can_manage} className="rounded-full bg-[#0D0D11] px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50">{busy ? 'Saving…' : confirm ? 'Confirm' : 'Continue'}</button>
          </div>
        </form>}
      </div>
    </dialog>}
  </>;
}
