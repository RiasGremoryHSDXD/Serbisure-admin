import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, RotateCw } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { messageCountLabel } from '../../data/chatInbox';
import { UnreadBadge } from './UnreadBadge';

export const MessageInbox: React.FC = () => {
  const { chatInbox, unreadChatCount, chatInboxLoaded, chatInboxError, chatRealtimeStatus, refreshChatInbox, openChatPartner } = useAdmin();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div ref={panel} className="relative">
      <button ref={trigger} type="button" aria-label={`Messages, ${chatInboxLoaded ? messageCountLabel(unreadChatCount) : 'checking unread messages'}`}
        aria-expanded={open} aria-controls="portal-message-inbox" title={`Messages · ${messageCountLabel(unreadChatCount)}`}
        onClick={() => { setOpen(value => !value); if (!open) void refreshChatInbox(); }}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#F6F5F2] hover:bg-orange-50 text-zinc-700 cursor-pointer">
        <MessageSquare className="w-5 h-5" />
        {unreadChatCount > 0 && <span className="absolute -top-1 -right-1"><UnreadBadge count={unreadChatCount} /></span>}
      </button>
      {open && (
        <div id="portal-message-inbox" aria-label="Messages" className="fixed right-3 top-16 sm:absolute sm:right-0 sm:top-full sm:mt-3 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100">
            <div><h2 className="text-sm font-black text-zinc-900">Messages</h2>
              <p className="text-xs text-zinc-500" role="status">{chatInboxLoaded ? messageCountLabel(unreadChatCount) : 'Checking messages…'}</p></div>
            <button type="button" onClick={() => void refreshChatInbox()} aria-label="Refresh messages" className="p-2 rounded-full hover:bg-zinc-100"><RotateCw className="w-4 h-4" /></button>
          </div>
          <p role="status" className="px-4 py-2 text-[11px] text-zinc-500">{chatRealtimeStatus === 'connected' ? 'Live updates' : chatRealtimeStatus === 'unauthorized' ? 'Live updates unavailable. Refresh or sign in again.' : 'Reconnecting… Messages will sync when connected.'}</p>
          {chatInboxError && <p role="status" className="px-4 py-2 bg-amber-50 text-amber-800 text-xs">{chatInboxError} Use refresh to retry.</p>}
          {!chatInboxLoaded && !chatInboxError && <p className="p-5 text-sm text-zinc-500">Loading messages…</p>}
          {chatInboxLoaded && chatInbox.length === 0 && <p className="p-5 text-sm text-zinc-500">No messages yet.</p>}
          <div className="max-h-[60vh] overflow-y-auto">
            {chatInbox.map(entry => (
              <button key={entry.partner_id} type="button" onClick={() => { openChatPartner(entry); setOpen(false); }}
                aria-label={`${entry.partner_name}, ${messageCountLabel(entry.unread_count)}. Open conversation`}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-50 border-b border-zinc-50 ${entry.unread_count > 0 ? 'bg-[#FFF8F4]' : ''}`}>
                <div className="flex-1 min-w-0"><p className={`text-sm text-zinc-900 truncate ${entry.unread_count > 0 ? 'font-extrabold' : 'font-semibold'}`}>{entry.partner_name}</p>
                  <p className={`mt-1 text-xs truncate ${entry.unread_count > 0 ? 'text-zinc-800 font-semibold' : 'text-zinc-500'}`}>{entry.last_message}</p></div>
                <UnreadBadge count={entry.unread_count} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
