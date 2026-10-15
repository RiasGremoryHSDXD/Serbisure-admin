const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatTyping } = require('./source-loader.cjs')()('src/data/chatTyping.ts');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('typing starts immediately, throttles edits, refreshes and stops after three seconds idle', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 });
  const sent = [];
  const session = createChatTyping(async value => sent.push(value));
  session.change('a'); session.change('ab'); await flush();
  assert.deepEqual(sent, [true]);
  t.mock.timers.tick(2000); session.change('abc'); await flush();
  assert.deepEqual(sent, [true, true]);
  t.mock.timers.tick(2999); await flush(); assert.equal(sent.length, 2);
  t.mock.timers.tick(1); await flush(); assert.deepEqual(sent, [true, true, false]);
  session.dispose();
});

test('clearing, blur/send and changing threads stop typing; a new session is never throttled by the previous one', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 });
  const sent = [];
  const session = createChatTyping(async value => sent.push(value));
  session.change('a'); session.change(''); await flush(); assert.deepEqual(sent, [true, false]);
  session.change('b'); session.stop(); await flush(); assert.deepEqual(sent.slice(-2), [true, false]);
  session.change('c'); session.dispose(); session.change('ignored'); await flush();
  t.mock.timers.tick(5000); await flush(); assert.deepEqual(sent, [true, false, true, false, true, false]);
});

test('stopped is serialized after a slow typing request, and a failed broadcast does not block later updates', async () => {
  let resolve;
  const sent = [];
  const session = createChatTyping(value => {
    sent.push(value);
    return sent.length === 1 ? new Promise(yes => { resolve = yes; }) : Promise.reject(new Error('offline'));
  });
  session.change('a'); await flush(); session.stop(); await flush();
  assert.deepEqual(sent, [true]); resolve(); await flush();
  assert.deepEqual(sent, [true, false]);
  session.change('b'); session.dispose(); await flush();
  assert.deepEqual(sent, [true, false, true, false]);
});
