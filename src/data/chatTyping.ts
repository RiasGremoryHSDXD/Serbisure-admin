/** One composer session. Serialize POSTs so a slow "typing" cannot arrive after "stopped". */
export function createChatTyping(send: (typing: boolean) => Promise<void>) {
  let lastSent = -Infinity;
  let typing = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  const publish = (value: boolean) => {
    queue = queue.then(() => send(value)).catch(() => {});
  };
  const stop = () => {
    clearTimeout(timer);
    if (typing) { typing = false; publish(false); }
  };
  return {
    change(value: string) {
      if (disposed) return;
      if (!value.trim()) { stop(); return; }
      if (!typing || Date.now() - lastSent >= 2000) {
        typing = true; lastSent = Date.now(); publish(true);
      }
      clearTimeout(timer);
      timer = setTimeout(stop, 3000);
    },
    stop,
    dispose() { stop(); disposed = true; },
  };
}
