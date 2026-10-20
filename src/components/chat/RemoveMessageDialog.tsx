import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function RemoveMessageDialog({ busy, error, onCancel, onRemove }: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const dialog = React.useRef<HTMLDivElement>(null);
  const cancelButton = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelButton.current?.focus();
    return () => previous?.focus?.();
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="remove-message-title" aria-describedby="remove-message-description" aria-busy={busy}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl"
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); }
          if (event.key === 'Tab') {
            const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            if (!buttons?.length) { event.preventDefault(); return; }
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id="remove-message-title" className="text-base font-semibold text-zinc-950">Remove for you</h2>
          <button type="button" aria-label="Close removal dialog" disabled={busy} onClick={onCancel}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"><X size={18} /></button>
        </div>
        <p id="remove-message-description" className="px-5 pt-4 text-sm leading-6 text-zinc-600">
          This will remove the message from your devices. Other chat members will still be able to see it.
        </p>
        {error && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 px-5 py-5">
          <button ref={cancelButton} type="button" aria-label="Cancel removal" disabled={busy} onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">Cancel</button>
          <button type="button" aria-label="Confirm removal" disabled={busy} onClick={onRemove}
            className="rounded-full bg-[#0D0D11] px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
