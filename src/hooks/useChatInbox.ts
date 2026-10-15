import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchChatInbox } from '../api/adminApi';
import { realtime } from '../realtime';
import { RealtimeStatus } from '../realtime/RealtimeClient';
import { ChatInboxStore, unreadMessageCount } from '../data/chatInbox';

export function useChatInbox(account: string | null) {
  const store = useMemo(() => new ChatInboxStore(fetchChatInbox), []);
  const [chatRealtimeStatus, setChatRealtimeStatus] = useState<RealtimeStatus>(realtime.status);
  const [snapshot, setSnapshot] = useState(store.snapshot);
  useEffect(() => {
    const unsubscribe = store.subscribe(setSnapshot);
    store.setAccount(account);
    setSnapshot(store.snapshot);
    const sync = () => {
      realtime.setActive(!document.hidden);
      if (!document.hidden) void store.refresh();
    };
    const offStatus = realtime.subscribeStatus(setChatRealtimeStatus);
    const offEvent = realtime.subscribe(event => {
      if (['sync', 'chat.changed', 'booking.changed'].includes(event.type) && !document.hidden) void store.refresh(true);
    });
    realtime.setActive(!document.hidden);
    realtime.start(account ? localStorage.getItem('serbisure_admin_token') : null);
    sync();
    const timer = window.setInterval(() => { if (realtime.status !== 'connected') sync(); }, 30000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      unsubscribe(); offStatus(); offEvent(); realtime.stop();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      store.setAccount(null);
    };
  }, [account, store]);
  const refreshChatInbox = useCallback(() => store.refresh(true), [store]);
  const current = snapshot.account === account ? snapshot : null;
  const chatInbox = current?.entries ?? [];
  return { chatInbox, chatRealtimeStatus, unreadChatCount: unreadMessageCount(chatInbox),
    chatInboxLoaded: current?.loaded ?? false, chatInboxError: current?.error ?? null, refreshChatInbox };
}
