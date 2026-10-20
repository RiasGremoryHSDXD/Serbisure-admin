const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const loader = require('./source-loader.cjs');
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cryptoFor(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'crypto', previous); else delete globalThis.crypto; });
}

test('text and image requests reach the API on HTTP LAN browsers without randomUUID', async t => {
  cryptoFor(t, { getRandomValues: array => webcrypto.getRandomValues(array) });
  const requests = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (url, options) => {
    requests.push({ url, options }); return { data: { chat_message_id: `saved-${requests.length}` } };
  } } })('src/api/adminApi.ts');
  const text = await api.sendChatMessage('recipient', 'Phone text');
  const file = new Blob(['test-image'], { type: 'image/png' });
  const image = await api.sendChatImageMessage('recipient', file, 'Phone image');
  assert.equal(requests.length, 2);
  assert.equal(text.chat_message_id, 'saved-1'); assert.equal(image.chat_message_id, 'saved-2');
  assert.equal(requests[0].url, '/api/v1/chat/send/');
  assert.deepEqual(JSON.parse(requests[0].options.body), { receiver_id: 'recipient', message_payload: 'Phone text' });
  assert.equal(requests[1].url, '/api/v1/chat/send-image/');
  assert.equal(requests[1].options.body.get('receiver_id'), 'recipient');
  assert.equal(requests[1].options.body.get('message_payload'), 'Phone image');
  assert.equal(requests[1].options.body.get('image').size, file.size);
  const keys = requests.map(request => request.options.headers['Idempotency-Key']);
  keys.forEach(key => assert.match(key, uuidV4)); assert.notEqual(keys[0], keys[1]);
});

test('HTTPS and localhost retain the native UUID implementation and its receiver', t => {
  const provider = { randomUUID() { assert.equal(this, provider); return '62e0d54f-3f29-467c-922a-8db16efeb303'; } };
  cryptoFor(t, provider);
  const { createRequestId } = loader()('src/utils/requestId.ts');
  assert.equal(createRequestId(), '62e0d54f-3f29-467c-922a-8db16efeb303');
});

test('HTTP fallback sets UUID version and variant bits and produces independent request keys', t => {
  cryptoFor(t, { getRandomValues: bytes => bytes.fill(255) });
  const { createRequestId } = loader()('src/utils/requestId.ts');
  assert.equal(createRequestId(), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } });
  const keys = Array.from({ length: 100 }, createRequestId);
  keys.forEach(key => assert.match(key, uuidV4)); assert.equal(new Set(keys).size, 100);
});

test('missing randomness fails clearly without sending an unsafe or duplicate request key', async t => {
  cryptoFor(t, undefined); let sent = false;
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async () => { sent = true; } } })('src/api/adminApi.ts');
  await assert.rejects(api.sendChatMessage('recipient', 'Draft'), /Refresh the page and try again/);
  assert.equal(sent, false);
});
