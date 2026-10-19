import React from 'react';
import { createPortal } from 'react-dom';
import { Copy, Loader2, MoreVertical, Reply, Smile, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export function MessageActions({ mine, reaction, hasText, disabled, busy, onReact, onReply, onRemove, onCopy }: {
  mine: boolean; reaction?: string | null; hasText: boolean; disabled?: boolean; busy?: boolean;
  onReact: (emoji: string) => void; onReply: () => void; onRemove: () => void; onCopy: () => void;
}) {
  const [popup, setPopup] = React.useState<{ type: 'reactions' | 'more'; left: number; top: number } | null>(null);
  const toolbar = React.useRef<HTMLDivElement>(null);
  const popover = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (!popup) return;
    popover.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!toolbar.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setPopup(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPopup(null); trigger.current?.focus(); }
    };
    const close = () => setPopup(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [popup]);
  const open = (type: 'reactions' | 'more', button: HTMLButtonElement) => {
    if (popup?.type === type) { setPopup(null); return; }
    trigger.current = button;
    const rect = button.getBoundingClientRect();
    const width = type === 'reactions' ? 248 : 192;
    const height = type === 'reactions' ? 48 : hasText ? 96 : 52;
    setPopup({ type,
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
      top: rect.top > height + 12 ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 8),
    });
  };
  const select = (action: () => void) => { setPopup(null); trigger.current?.focus(); action(); };
  const iconButton = 'flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40';
  return <div ref={toolbar} role="group" aria-label="Message actions" aria-busy={busy} className={clsx(
    'flex shrink-0 items-center rounded-full p-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
    popup || busy ? 'opacity-100 bg-white shadow-sm' : 'opacity-0',
    mine && 'flex-row-reverse',
  )}>
    <button type="button" title="React" aria-label="React to message" aria-expanded={popup?.type === 'reactions'} disabled={disabled} className={iconButton} onClick={event => open('reactions', event.currentTarget)}><Smile size={16} /></button>
    <button type="button" title="Reply" aria-label="Reply to message" disabled={disabled} className={iconButton} onClick={() => select(onReply)}><Reply size={16} /></button>
    <button type="button" title={busy ? 'Saving…' : 'More'} aria-label="More message options" aria-expanded={popup?.type === 'more'} disabled={disabled} className={iconButton} onClick={event => open('more', event.currentTarget)}>{busy ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}</button>
    {popup && createPortal(<div ref={popover} role="group" aria-label={popup.type === 'reactions' ? 'Choose a reaction' : 'More message options'}
      className={clsx('fixed z-[200] rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg max-w-[calc(100vw-1rem)]', popup.type === 'reactions' ? 'flex w-[248px] items-center justify-between' : 'w-48')}
      style={{ left: popup.left, top: popup.top }}>
      {popup.type === 'reactions' ? REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`React ${emoji}`} aria-pressed={reaction === emoji}
        className={clsx('rounded-full p-1.5 text-xl hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-300', reaction === emoji && 'bg-orange-50')}
        onClick={() => select(() => onReact(emoji))}>{emoji}</button>) : <>
        <button type="button" disabled={disabled} onClick={() => select(onRemove)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={15} />Remove message</button>
        {hasText && <button type="button" onClick={() => select(onCopy)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"><Copy size={15} />Copy text</button>}
      </>}
    </div>, document.body)}
  </div>;
}
