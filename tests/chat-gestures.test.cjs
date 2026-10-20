const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const loader = require('./source-loader.cjs');

function screen(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const before = { window: global.window, document: global.document };
  const listeners = new Map();
  const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); };
  const remove = (name, fn) => listeners.get(name)?.delete(fn);
  global.window = { innerWidth: 320, innerHeight: 740, visualViewport: { width: 320, height: 350, offsetTop: 60, offsetLeft: 0, addEventListener: add, removeEventListener: remove }, addEventListener: add, removeEventListener: remove };
  global.document = { body: {}, addEventListener: add, removeEventListener: remove };
  const capture = new Set();
  let menuFocus = 0;
  const element = { focus() {}, contains() { return false; }, querySelector() { return { focus() { menuFocus++; } }; },
    getBoundingClientRect: () => ({ left: 40, top: 300, bottom: 340, width: 210 }),
    setPointerCapture: id => capture.add(id), hasPointerCapture: id => capture.has(id), releasePointerCapture: id => capture.delete(id) };
  const calls = { reply: 0, remove: 0, copy: 0, reactions: [] };
  const { MessageActions } = loader({ 'react-dom': { createPortal: content => content } })('src/components/chat/MessageActions.tsx');
  const props = { mine: false, hasText: true, onReply: () => calls.reply++, onRemove: () => calls.remove++, onCopy: () => calls.copy++, onReact: emoji => calls.reactions.push(emoji), ...options };
  let view; act(() => { view = Renderer.create(React.createElement(MessageActions, props, React.createElement('span', null, 'Message')), { createNodeMock: () => element }); });
  let mounted = true;
  const unmount = () => { if (mounted) { act(() => view.unmount()); mounted = false; } };
  t.after(() => { unmount(); global.window = before.window; global.document = before.document; });
  const surface = () => view.root.findByProps({ 'aria-label': 'Message options' });
  const fire = (name, values = {}) => act(() => surface().props[name]({ currentTarget: element, target: element, pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 100, clientY: 200, preventDefault() {}, stopPropagation() {}, ...values }));
  return { view, calls, fire, unmount, capture, menuFocus: () => menuFocus,
    hold: () => act(() => t.mock.timers.tick(501)),
    label: name => view.root.findByProps({ 'aria-label': name }),
    click: name => act(() => view.root.findByProps({ 'aria-label': name }).props.onClick()),
    update: values => act(() => view.update(React.createElement(MessageActions, { ...props, ...values }, React.createElement('span', null, 'Message')))),
  };
}

test('horizontal swipes reply once in either direction, release capture and suppress attachment clicks', t => {
  const s = screen(t);
  for (const x of [165, 35]) {
    s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: x });
    s.fire('onPointerUp', { clientX: x });
  }
  assert.equal(s.calls.reply, 2); assert.equal(s.capture.size, 0);
  let prevented = false; s.fire('onClickCapture', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.deepEqual(s.calls.reactions, []);
});

test('touch capture transferring from a nested bubble does not reset a swipe before release', t => {
  const s = screen(t); const bubble = {};
  s.fire('onPointerDown', { target: bubble });
  s.fire('onPointerMove', { clientX: 125, clientY: 204, target: bubble });
  // Touch browsers implicitly capture the original child, then bubble its loss
  // of capture when the outer gesture surface takes over the same pointer.
  s.fire('onLostPointerCapture', { target: bubble });
  s.fire('onPointerMove', { clientX: 165, clientY: 210 });
  s.fire('onPointerUp', { clientX: 165, clientY: 210 });
  assert.equal(s.calls.reply, 1);
});

test('a locked horizontal swipe tolerates finger drift and uses the final release distance', t => {
  const s = screen(t);
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: 125, clientY: 202 });
  s.fire('onPointerMove', { clientX: 145, clientY: 248 });
  s.fire('onPointerUp', { clientX: 165, clientY: 248 });
  assert.equal(s.calls.reply, 1);
});

test('losing the surface capture or browser cancellation still stops the reply', t => {
  const s = screen(t);
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: 165 });
  s.capture.delete(1); s.fire('onLostPointerCapture'); s.fire('onPointerUp', { clientX: 165 });
  assert.equal(s.calls.reply, 0);
});

test('scrolling, short drags, cancelled gestures and a second finger never reply or open a hold menu', t => {
  const s = screen(t);
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientY: 225 }); s.hold();
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: 130 }); s.fire('onPointerUp');
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: 165 }); s.fire('onPointerCancel');
  s.fire('onPointerDown'); s.fire('onPointerDown', { pointerId: 2, isPrimary: false }); s.hold();
  assert.equal(s.calls.reply, 0); assert.equal(s.view.root.findAllByProps({ 'aria-label': 'Message options menu' }).length, 0);
  assert.equal(s.capture.size, 0);
});

test('hold opens reactions, reply, copy and remove without taking an action; native contextmenu keeps it open', t => {
  const s = screen(t); s.fire('onPointerDown'); s.hold();
  const menu = s.view.root.findByProps({ 'aria-label': 'Message options menu' });
  assert.ok(menu); assert.equal(menu.findAllByType('button').length, 9);
  assert.equal(s.menuFocus(), 0, 'touch hold keeps focus on the composer so the keyboard stays open');
  assert.ok(menu.props.style.top >= 68); assert.ok(menu.props.style.top + 212 <= 410);
  s.fire('onContextMenu'); s.fire('onPointerUp');
  assert.equal(s.view.root.findAllByProps({ 'aria-label': 'React 👍' }).length, 1);
  assert.deepEqual(s.calls, { reply: 0, remove: 0, copy: 0, reactions: [] });
  s.click('React 👍'); assert.deepEqual(s.calls.reactions, ['👍']);
});

test('keyboard users can open the same menu; copy and remove use existing callbacks only when selected', t => {
  const s = screen(t);
  const key = () => { const node = s.label('Message options'); s.fire('onKeyDown', { key: 'Enter', target: node.instance, currentTarget: node.instance }); };
  key();
  assert.equal(s.menuFocus(), 1, 'keyboard activation moves focus into the action menu');
  act(() => s.view.root.findAllByType('button').find(node => node.children.includes('Copy text')).props.onClick());
  assert.equal(s.calls.copy, 1); assert.equal(s.calls.remove, 0);
  key(); act(() => s.view.root.findAllByType('button').find(node => node.children.includes('Remove message')).props.onClick());
  assert.equal(s.calls.remove, 1);
});

test('mouse movement stays native; disabled, unmounted and newly busy messages cancel pending long presses', t => {
  const s = screen(t);
  s.fire('onPointerDown', { pointerType: 'mouse' }); s.hold(); assert.equal(s.label('Message options').props['aria-expanded'], false);
  s.fire('onPointerDown'); s.update({ disabled: true }); s.hold();
  assert.equal(s.label('Message options').props['aria-expanded'], false);
  s.fire('onPointerDown'); s.fire('onPointerMove', { clientX: 170 }); s.fire('onPointerUp'); assert.equal(s.calls.reply, 0);
  s.update({ disabled: false }); s.fire('onPointerDown'); s.unmount(); s.hold();
  assert.deepEqual(s.calls, { reply: 0, remove: 0, copy: 0, reactions: [] });
});
