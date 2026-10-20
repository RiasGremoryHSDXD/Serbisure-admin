const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./source-loader.cjs');
const { bindChatViewport } = loader()('src/utils/chatViewport.ts');

function events(values = {}) {
  const listeners = new Map();
  return Object.assign(values, {
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    emit(name) { [...(listeners.get(name) || [])].forEach(listener => listener()); },
    count() { return [...listeners.values()].reduce((sum, items) => sum + items.size, 0); },
  });
}
function fixture(withViewport = true) {
  const viewport = events({ height: 640, width: 360, offsetTop: 0, scale: 1 });
  const browser = events({ innerHeight: 720, visualViewport: withViewport ? viewport : null });
  const classes = () => { const list = new Set(); return { contains: name => list.has(name), add: name => list.add(name), remove: name => list.delete(name) }; };
  const page = { documentElement: { classList: classes() }, body: { classList: classes() } };
  const style = new Map();
  const element = { style: { setProperty: (key, value) => style.set(key, value), removeProperty: key => style.delete(key) } };
  return { viewport, browser, page, element, style };
}

test('chat follows actual visible height and browser panning through keyboard open, typing and close', () => {
  const f = fixture(); const cleanup = bindChatViewport(f.element, f.browser, f.page);
  assert.equal(f.style.get('--chat-viewport-height'), '640px');
  f.viewport.height = 330; f.viewport.emit('resize');
  assert.equal(f.style.get('--chat-viewport-height'), '330px');
  f.viewport.offsetTop = 85; f.viewport.emit('scroll');
  assert.equal(f.style.get('--chat-viewport-top'), '85px');
  f.viewport.height = 640; f.viewport.offsetTop = 0; f.viewport.emit('resize');
  assert.equal(f.style.get('--chat-viewport-height'), '640px');
  assert.equal(f.style.get('--chat-viewport-top'), '0px');
  cleanup(); assert.equal(f.viewport.count(), 0); assert.equal(f.browser.count(), 0);
  assert.equal(f.style.size, 0); assert.equal(f.page.body.classList.contains('chat-viewport-active'), false);
});

test('zoom and invalid measurements do not collapse chat; route cleanup preserves existing classes', () => {
  const f = fixture(); f.page.body.classList.add('chat-viewport-active');
  const cleanup = bindChatViewport(f.element, f.browser, f.page);
  f.viewport.scale = 2; f.viewport.height = 200; f.viewport.emit('resize');
  assert.equal(f.style.get('--chat-viewport-height'), '640px');
  f.viewport.scale = 1; f.viewport.height = 0; f.viewport.emit('resize');
  assert.equal(f.style.get('--chat-viewport-height'), '640px');
  cleanup(); assert.equal(f.page.body.classList.contains('chat-viewport-active'), true);
  assert.equal(f.page.documentElement.classList.contains('chat-viewport-active'), false);
});

test('browsers without VisualViewport use live window height and release listeners', () => {
  const f = fixture(false); const cleanup = bindChatViewport(f.element, f.browser, f.page);
  assert.equal(f.style.get('--chat-viewport-height'), '720px');
  f.browser.innerHeight = 400; f.browser.emit('resize');
  assert.equal(f.style.get('--chat-viewport-height'), '400px'); cleanup();
  assert.equal(f.browser.count(), 0);
});
