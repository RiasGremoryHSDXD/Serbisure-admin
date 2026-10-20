const test = require('node:test');
const assert = require('node:assert/strict');
const { fitImage, constrainImage, INITIAL_IMAGE_TRANSFORM } = require('./source-loader.cjs')()('src/data/imageViewport.ts');
const frame = { width: 600, height: 400 };
const portrait = { width: 1200, height: 1800 };

function viewer(t) {
  const React = require('react');
  const { create, act } = require('react-test-renderer');
  const { ReviewImageViewer } = require('./source-loader.cjs')()('src/components/verifications/ReviewImageViewer.tsx');
  const previousWindow = global.window;
  global.window = { addEventListener() {}, removeEventListener() {} };
  const captured = new Set();
  let prevented = 0;
  const element = { clientWidth: 300, clientHeight: 300, focus() {}, addEventListener() {}, removeEventListener() {},
    setPointerCapture(id) { captured.add(id); }, hasPointerCapture(id) { return captured.has(id); },
    releasePointerCapture(id) { captured.delete(id); },
  };
  let tree;
  act(() => { tree = create(React.createElement(ReviewImageViewer, { src: 'https://example.test/photo.jpg', label: 'Profile photo' }), {
    createNodeMock: node => node.props.role === 'group' ? element : null,
  }); });
  t.after(() => { act(() => tree.unmount()); if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  const frameNode = () => tree.root.findByProps({ role: 'group' });
  const button = name => tree.root.findByProps({ 'aria-label': name });
  const click = name => act(() => button(name).props.onClick());
  const pointer = (handler, type, id, x, y) => act(() => frameNode().props[handler]({
    pointerType: type, pointerId: id, clientX: x, clientY: y, button: 0, currentTarget: element,
    preventDefault() { prevented++; },
  }));
  const load = () => act(() => tree.root.findByType('img').props.onLoad({ currentTarget: { naturalWidth: 600, naturalHeight: 600 } }));
  const transform = () => tree.root.findByType('img').props.style.transform;
  return { frameNode, button, click, pointer, load, captured, transform, prevented: () => prevented };
}

test('touch swipes remain native page scrolling before and after zooming the loaded photo', t => {
  const v = viewer(t);
  assert.equal(v.button('Move Profile photo').props.disabled, true);
  assert.equal(v.frameNode().props.style.touchAction, 'pan-y pinch-zoom');
  v.load();
  v.pointer('onPointerDown', 'touch', 1, 40, 40);
  v.pointer('onPointerMove', 'touch', 1, 40, 160);
  assert.equal(v.prevented(), 0);
  assert.equal(v.captured.size, 0);
  const initial = v.transform();
  assert.match(initial, /scale\(1\)/);
  v.click('Zoom in Profile photo');
  const zoomed = v.transform();
  v.pointer('onPointerDown', 'touch', 2, 40, 40);
  v.pointer('onPointerMove', 'touch', 2, 40, 160);
  assert.equal(v.frameNode().props.style.touchAction, 'pan-y pinch-zoom');
  assert.equal(v.transform(), zoomed);
  assert.equal(v.prevented(), 0);
});

test('touch image mode supports pinch and can be exited during a drag to resume scrolling', t => {
  const v = viewer(t); v.load();
  v.click('Move Profile photo');
  assert.equal(v.button('Move Profile photo').props['aria-pressed'], true);
  assert.equal(v.frameNode().props.style.touchAction, 'none');
  v.pointer('onPointerDown', 'touch', 1, 50, 50);
  v.pointer('onPointerDown', 'touch', 2, 150, 50);
  v.pointer('onPointerMove', 'touch', 2, 250, 50);
  assert.match(v.transform(), /scale\(2\)/);
  assert.equal(v.captured.size, 2);
  v.pointer('onPointerCancel', 'touch', 2, 250, 50);
  assert.equal(v.captured.size, 1);
  v.click('Move Profile photo');
  assert.equal(v.captured.size, 0);
  assert.equal(v.frameNode().props.style.touchAction, 'pan-y pinch-zoom');
  const before = v.transform();
  v.pointer('onPointerMove', 'touch', 1, 50, 180);
  assert.equal(v.transform(), before);
});

test('reset restores scrolling and desktop mouse dragging continues to work', t => {
  const v = viewer(t); v.load();
  v.click('Zoom in Profile photo');
  v.pointer('onPointerDown', 'mouse', 1, 100, 100);
  const before = v.transform();
  v.pointer('onPointerMove', 'mouse', 1, 120, 120);
  assert.notEqual(v.transform(), before);
  v.pointer('onPointerUp', 'mouse', 1, 120, 120);
  v.click('Move Profile photo');
  v.click('Reset Profile photo view');
  assert.equal(v.button('Move Profile photo').props['aria-pressed'], false);
  assert.equal(v.frameNode().props.style.touchAction, 'pan-y pinch-zoom');
  assert.match(v.transform(), /scale\(1\)/);
});

test('portrait and landscape images fit without cropping or distortion', () => {
  const fitted = fitImage(frame, portrait);
  assert.equal(fitted.height, 400);
  assert.ok(Math.abs(fitted.width - 266.6666666667) < .001);
  assert.deepEqual(fitImage(frame, { width: 1800, height: 1200 }), { width: 600, height: 400 });
});
test('invalid image or frame dimensions never produce NaN or infinite transforms', () => {
  for (const size of [{ width: 0, height: 0 }, { width: NaN, height: Infinity }, { width: -2, height: 10 }]) {
    assert.deepEqual(fitImage(frame, size), { width: 0, height: 0 });
    assert.ok(Object.values(constrainImage({ zoom: NaN, rotation: Infinity, x: NaN, y: Infinity }, frame, size)).every(Number.isFinite));
  }
});
test('zoom bounds stop runaway zoom and dragging cannot move the image out of reach', () => {
  assert.equal(constrainImage({ ...INITIAL_IMAGE_TRANSFORM, zoom: 1000 }, frame, portrait).zoom, 5);
  assert.equal(constrainImage({ ...INITIAL_IMAGE_TRANSFORM, zoom: -100 }, frame, portrait).zoom, .5);
  const result = constrainImage({ zoom: 3, rotation: 0, x: 99999, y: -99999 }, frame, portrait);
  assert.ok(Math.abs(result.x - 100) < .001); assert.equal(result.y, -400);
  assert.deepEqual(constrainImage({ ...result, zoom: 1 }, frame, portrait), INITIAL_IMAGE_TRANSFORM);
});
test('rotation and viewport resize re-clamp pan to the currently visible image bounds', () => {
  const result = constrainImage({ zoom: 2, rotation: 450, x: 999, y: 999 }, frame, portrait);
  assert.equal(result.rotation, 90); assert.equal(result.x, 100);
  assert.ok(Math.abs(result.y - 66.6666666667) < .001);
  const resized = constrainImage(result, { width: 1000, height: 800 }, portrait);
  assert.ok(Number.isFinite(resized.x)); assert.ok(Number.isFinite(resized.y));
  assert.equal(constrainImage({ ...result, rotation: -90 }, frame, portrait).rotation, 270);
});
