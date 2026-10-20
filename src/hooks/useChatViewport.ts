import { useLayoutEffect, useRef } from 'react';
import { bindChatViewport } from '../utils/chatViewport';

export function useChatViewport(enabled: boolean) {
  const shell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (enabled && shell.current) return bindChatViewport(shell.current, window, document);
  }, [enabled]);
  return shell;
}
