const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('./source-loader.cjs');
const { RealtimeClient } = loader()('src/realtime/RealtimeClient.ts');
function fixture() {
  const sockets = []; const urls = []; const events = [];
  const client = new RealtimeClient('https://api.example.test', url => {
    urls.push(url);
    const socket = { sent: [], closed: false, send(data) { this.sent.push(JSON.parse(data)); }, close() { this.closed = true; } };
    sockets.push(socket); return socket;
  });
  client.subscribe(event => events.push(event));
  const ready = () => { sockets.at(-1).onopen({}); sockets.at(-1).onmessage({ data: '{"type":"ready"}' }); };
  return { client, sockets, urls, events, ready };
}
test('mobile and web use identical tested WebSocket protocol clients', () => {
  const web = path.resolve(__dirname, '../src/realtime/RealtimeClient.ts');
  const mobile = path.resolve(__dirname, '../../front_end_2/SerbiSure-Frontend/src/shared/realtime/RealtimeClient.ts');
  assert.equal(fs.readFileSync(web, 'utf8'), fs.readFileSync(mobile, 'utf8'));
});
test('JWT is sent as an auth frame, never in the URL; events wait for server authentication', () => {
  const f = fixture(); f.client.start('private-token');
  assert.equal(f.urls[0], 'wss://api.example.test/ws/events/'); assert.doesNotMatch(f.urls[0], /private-token/);
  f.sockets[0].onmessage({ data: '{"type":"chat.changed"}' }); assert.deepEqual(f.events, []);
  f.ready(); assert.deepEqual(f.sockets[0].sent[0], { type: 'authenticate', token: 'private-token' });
  assert.equal(f.client.status, 'connected'); assert.deepEqual(f.events, [{ type: 'sync' }]);
  f.sockets[0].onmessage({ data: '{"type":"chat.changed","partner_id":"sender"}' });
  assert.equal(f.events[1].partner_id, 'sender');
  for (const data of ['bad-json', 'null', '[]', '{"type":"unknown"}']) f.sockets[0].onmessage({ data });
  assert.equal(f.events.length, 2); f.client.stop();
});
test('dropped connections reconnect with backoff and request REST reconciliation after reconnect', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const f = fixture(); f.client.start('token'); f.ready();
  f.sockets[0].onclose({ code: 1006 }); assert.equal(f.client.status, 'reconnecting');
  t.mock.timers.tick(1600); assert.equal(f.sockets.length, 2); f.ready();
  assert.equal(f.events.filter(event => event.type === 'sync').length, 2); f.client.stop();
});
test('expired/rejected auth stops retries and logout invalidates callbacks and timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = fixture(); f.client.start('token'); f.sockets[0].onclose({ code: 4401 });
  assert.equal(f.client.status, 'unauthorized'); t.mock.timers.tick(60000); assert.equal(f.sockets.length, 1);
  f.client.start('new-token'); const stale = f.sockets[1].onmessage; f.client.stop();
  stale({ data: '{"type":"chat.changed"}' }); t.mock.timers.tick(60000);
  assert.equal(f.client.status, 'idle'); assert.deepEqual(f.events, []);
});
test('background pauses the socket; foreground reauthenticates and missed data reconciles', () => {
  const f = fixture(); f.client.start('token'); f.ready();
  f.client.setActive(false); assert.equal(f.sockets[0].closed, true); assert.equal(f.client.status, 'idle');
  f.client.setActive(true); assert.equal(f.sockets.length, 2); f.ready();
  assert.equal(f.events.filter(event => event.type === 'sync').length, 2); f.client.stop();
});
test('heartbeat pings detect a stale server and reconnect', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });
  const f = fixture(); f.client.start('token'); f.ready();
  t.mock.timers.tick(25000); assert.equal(f.sockets[0].sent.at(-1).type, 'ping');
  t.mock.timers.tick(50000); assert.equal(f.client.status, 'reconnecting');
  assert.equal(f.sockets[0].closed, true); f.client.stop();
});
