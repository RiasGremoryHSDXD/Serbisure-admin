import React from 'react';
import { createPortal } from 'react-dom';
import { Copy, Loader2, MoreVertical, Reply, Smile, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export function MessageActions({ mine, reaction, hasText, disabled, busy, onReact, onReply, onRemove, onCopy, children }: {
  mine: boolean; reaction?: string | null; hasText: boolean; disabled?: boolean; busy?: boolean;
  onReact: (emoji: string) => void; onReply: () => void; onRemove: () => void; onCopy: () => void;
  children?: React.ReactNode;
}) {
  const [popup, setPopup] = React.useState<{ type: 'reactions' | 'more' | 'all'; left: number; top: number; focusMenu: boolean } | null>(null);
  const [swipe, setSwipe] = React.useState(0);
  const toolbar = React.useRef<HTMLDivElement>(null);
  const surface = React.useRef<HTMLDivElement>(null);
  const popover = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLElement | null>(null);
  const hold = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = React.useRef<{ id: number; x: number; y: number; dx: number; horizontal: boolean; element: HTMLDivElement } | null>(null);
  const suppressClick = React.useRef(false);
  const stopHold = () => { if (hold.current !== null) { clearTimeout(hold.current); hold.current = null; } };
  const cancelGesture = () => {
    stopHold();
    const active = gesture.current;
    gesture.current = null;
    if (active?.element.hasPointerCapture?.(active.id)) active.element.releasePointerCapture(active.id);
    setSwipe(0);
  };
  React.useEffect(() => {
    if (disabled || busy) { cancelGesture(); setPopup(null); }
    return () => stopHold();
  }, [disabled, busy]);
  React.useEffect(() => {
    if (!popup) return;
    // A touch hold must not blur the composer and collapse the phone keyboard.
    if (popup.focusMenu) popover.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!toolbar.current?.contains(event.target as Node) && !surface.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setPopup(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPopup(null); trigger.current?.focus({ preventScroll: true }); }
    };
    const close = () => setPopup(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.visualViewport?.addEventListener('resize', close);
    window.visualViewport?.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.visualViewport?.removeEventListener('resize', close);
      window.visualViewport?.removeEventListener('scroll', close);
    };
  }, [popup]);
  const open = (type: 'reactions' | 'more' | 'all', button: HTMLElement, toggle = true, focusMenu = true) => {
    if (disabled || busy) return;
    if (popup?.type === type && toggle) { setPopup(null); return; }
    trigger.current = button;
    const rect = button.getBoundingClientRect();
    const width = type === 'all' ? 280 : type === 'reactions' ? 248 : 192;
    const height = type === 'all' ? (hasText ? 212 : 168) : type === 'reactions' ? 56 : hasText ? 104 : 60;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const visibleWidth = viewport?.width || window.innerWidth;
    const visibleHeight = viewport?.height || window.innerHeight;
    setPopup({ type, focusMenu,
      left: Math.max(left + 8, Math.min(rect.left + rect.width / 2 - width / 2, left + visibleWidth - width - 8)),
      top: Math.max(top + 8, Math.min(rect.top > top + height + 12 ? rect.top - height - 8 : rect.bottom + 8, top + visibleHeight - height - 8)),
    });
  };
  const select = (action: () => void) => { setPopup(null); if (popup?.focusMenu) trigger.current?.focus({ preventScroll: true }); action(); };
  const iconButton = 'flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40';
  return <div className={clsx('relative flex min-w-0 max-w-full items-center gap-1.5', mine && 'flex-row-reverse')}>
    {children && <div ref={surface} role="group" aria-label="Message options" aria-haspopup="dialog" aria-expanded={popup?.type === 'all'} tabIndex={0}
      className="message-gesture-surface relative min-w-0 max-w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      title="Swipe to reply. Hold for reactions and more."
      style={{ transform: swipe ? `translateX(${swipe}px)` : undefined }}
      onPointerDown={event => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (event.isPrimary === false || gesture.current) { cancelGesture(); return; }
        if (disabled || busy) return;
        suppressClick.current = false;
        const element = event.currentTarget;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, horizontal: false, element };
        hold.current = setTimeout(() => {
          hold.current = null;
          suppressClick.current = true;
          gesture.current = null;
          open('all', element, false, false);
        }, 500);
      }}
      onPointerMove={event => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.x, dy = event.clientY - active.y;
        if (!active.horizontal) {
          if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { cancelGesture(); return; }
          if (Math.abs(dx) > 10) stopHold();
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) active.horizontal = true;
          else { if (Math.abs(dy) > 10) cancelGesture(); return; }
        }
        if (active.horizontal) {
          active.dx = Math.max(-72, Math.min(72, dx));
          if (!active.element.hasPointerCapture?.(event.pointerId)) active.element.setPointerCapture?.(event.pointerId);
          setSwipe(active.dx);
        }
      }}
      onPointerUp={event => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        const distance = event.clientX - active.x;
        const reply = active.horizontal && Math.abs(distance) >= 56;
        if (active.horizontal) suppressClick.current = true;
        cancelGesture();
        if (reply && !disabled && !busy) onReply();
      }}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={event => {
        // Implicit touch capture starts on the nested text/image. Its loss
        // bubbles here when this surface intentionally takes over the swipe.
        if (event.target !== event.currentTarget || event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
        if (gesture.current?.id === event.pointerId) cancelGesture();
      }}
      onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}
      onContextMenu={event => { event.preventDefault(); cancelGesture(); suppressClick.current = true; open('all', event.currentTarget, false, false); }}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ' || event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) {
          event.preventDefault(); open('all', event.currentTarget);
        }
      }}>
      {swipe !== 0 && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-400" style={swipe > 0 ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' }}><Reply size={18} /></span>}
      {children}
    </div>}
    <div ref={toolbar} role="group" aria-label="Message actions" aria-busy={busy} className={clsx(
    'message-desktop-actions flex shrink-0 items-center rounded-full p-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100',
    popup || busy ? 'opacity-100 bg-white shadow-sm' : 'opacity-0',
    mine && 'flex-row-reverse',
  )}>
    <button type="button" title="React" aria-label="React to message" aria-expanded={popup?.type === 'reactions'} disabled={disabled} className={iconButton} onClick={event => open('reactions', event.currentTarget)}><Smile size={16} /></button>
    <button type="button" title="Reply" aria-label="Reply to message" disabled={disabled} className={iconButton} onClick={() => select(onReply)}><Reply size={16} /></button>
    <button type="button" title={busy ? 'Saving…' : 'More'} aria-label="More message options" aria-expanded={popup?.type === 'more'} disabled={disabled} className={iconButton} onClick={event => open('more', event.currentTarget)}>{busy ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}</button>
    </div>
    {popup && createPortal(<div ref={popover} role={popup.type === 'all' ? 'dialog' : 'group'} aria-label={popup.type === 'all' ? 'Message options menu' : popup.type === 'reactions' ? 'Choose a reaction' : 'More message options'}
      className={clsx('fixed z-[200] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg max-w-[calc(100vw-1rem)]', popup.type === 'reactions' ? 'flex w-[248px] items-center justify-between' : popup.type === 'all' ? 'w-[280px]' : 'w-48')}
      style={{ left: popup.left, top: popup.top, maxHeight: Math.max(44, (window.visualViewport?.height || window.innerHeight) - 16) }}>
      {popup.type !== 'more' && <div className={clsx('flex w-full items-center justify-between', popup.type === 'all' && 'mb-1 border-b border-zinc-100 pb-1')}>
      {REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`React ${emoji}`} aria-pressed={reaction === emoji} disabled={disabled}
        className={clsx('min-w-0 flex-1 rounded-full px-1 py-2 text-xl hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-300', reaction === emoji && 'bg-orange-50')}
        onClick={() => select(() => onReact(emoji))}>{emoji}</button>)}
      </div>}
      {popup.type === 'all' && <button type="button" disabled={disabled} onClick={() => select(onReply)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"><Reply size={15} />Reply</button>}
      {popup.type !== 'reactions' && <>
        {hasText && <button type="button" onClick={() => select(onCopy)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"><Copy size={15} />Copy text</button>}
        <button type="button" disabled={disabled} onClick={() => select(onRemove)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={15} />Remove message</button>
      </>}
    </div>, document.body)}
  </div>;
}
