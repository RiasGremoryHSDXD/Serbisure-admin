import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchChatInbox } from '../api/adminApi';
import { ChatInboxStore, unreadMessageCount } from '../data/chatInbox';

export function useChatInbox(account: string | null) {
  const store = useMemo(() => new ChatInboxStore(fetchChatInbox), []);
  const [snapshot, setSnapshot] = useState(store.snapshot);
  useEffect(() => {
    const unsubscribe = store.subscribe(setSnapshot);
    store.setAccount(account);
    setSnapshot(store.snapshot);
    const sync = () => { if (!document.hidden) void store.refresh(); };
    sync();
    const timer = window.setInterval(sync, 5000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      store.setAccount(null);
    };
  }, [account, store]);
  const refreshChatInbox = useCallback(() => store.refresh(true), [store]);
  const current = snapshot.account === account ? snapshot : null;
  const chatInbox = current?.entries ?? [];
  return { chatInbox, unreadChatCount: unreadMessageCount(chatInbox),
    chatInboxLoaded: current?.loaded ?? false, chatInboxError: current?.error ?? null, refreshChatInbox };
}
