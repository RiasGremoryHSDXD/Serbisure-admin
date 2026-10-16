const test = require('node:test');
const assert = require('node:assert/strict');
const { fitImage, constrainImage, INITIAL_IMAGE_TRANSFORM } = require('./source-loader.cjs')()('src/data/imageViewport.ts');
const frame = { width: 600, height: 400 };
const portrait = { width: 1200, height: 1800 };

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
