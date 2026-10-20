/** Keep the chat inside the visible browser area, including the software keyboard. */
export function bindChatViewport(element: HTMLElement, browser: Window, page: Document): () => void {
  const viewport = browser.visualViewport;
  const roots = [page.documentElement, page.body];
  const alreadyActive = roots.map(root => root.classList.contains('chat-viewport-active'));
  roots.forEach(root => root.classList.add('chat-viewport-active'));
  const sync = () => {
    // Let browser pinch zoom retain its native size and panning behavior.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    const height = viewport?.height ?? browser.innerHeight;
    if (!Number.isFinite(height) || height <= 0) return;
    element.style.setProperty('--chat-viewport-height', `${height}px`);
    element.style.setProperty('--chat-viewport-top', `${Math.max(0, viewport?.offsetTop ?? 0)}px`);
  };
  sync();
  viewport?.addEventListener('resize', sync);
  viewport?.addEventListener('scroll', sync);
  browser.addEventListener('resize', sync);
  return () => {
    viewport?.removeEventListener('resize', sync);
    viewport?.removeEventListener('scroll', sync);
    browser.removeEventListener('resize', sync);
    roots.forEach((root, index) => { if (!alreadyActive[index]) root.classList.remove('chat-viewport-active'); });
    element.style.removeProperty('--chat-viewport-height');
    element.style.removeProperty('--chat-viewport-top');
  };
}
