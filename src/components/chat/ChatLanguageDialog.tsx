import React from 'react';
import { createPortal } from 'react-dom';
import { OFFENSIVE_LANGUAGE_ADVISORY } from '../../utils/offensiveLanguage';

export function ChatLanguageDialog({ mode, onClose, onConfirm }: {
  mode: 'send' | 'reveal'; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = React.useRef<HTMLDivElement>(null);
  const close = React.useRef<HTMLButtonElement>(null);
  const title = React.useId();
  const description = React.useId();
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title} aria-describedby={description}
      className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <h2 id={title} className="text-lg font-bold text-zinc-950">{mode === 'send' ? 'Review your message' : 'Sensitive message'}</h2>
      <p id={description} className="mt-3 text-sm leading-6 text-zinc-600">{mode === 'send' ? OFFENSIVE_LANGUAGE_ADVISORY : 'This message may contain offensive or sensitive language. Would you like to show it?'}</p>
      <div className="mt-6 flex gap-3">
        <button ref={close} type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">Close</button>
        <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-full bg-[#FFB380] px-4 py-3 text-sm font-bold text-zinc-950">{mode === 'send' ? 'Send Anyway' : 'Show Message'}</button>
      </div>
    </div>
  </div>, document.body);
}

export function SensitiveMessage({ sensitive, children }: { sensitive: boolean; children: React.ReactNode }) {
  const [revealed, setRevealed] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  if (!sensitive || revealed) return <>{children}</>;
  // Keep the actual wording out of screen readers and selection until consent.
  return <>
    <button type="button" aria-label="Open sensitive message" onClick={() => setConfirm(true)}
      className="relative w-56 max-w-full overflow-hidden rounded-2xl bg-[#F0F0EC] p-4 text-left">
      <span aria-hidden="true" className="pointer-events-none block select-none space-y-2 blur-[5px] opacity-40">
        <span className="block h-2 w-40 max-w-full rounded bg-zinc-500" /><span className="block h-2 w-28 rounded bg-zinc-500" />
      </span>
      <span className="relative mt-3 block text-xs font-semibold text-zinc-700">Sensitive message · Tap to view</span>
    </button>
    {confirm && <ChatLanguageDialog mode="reveal" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setRevealed(true); }} />}
  </>;
}
