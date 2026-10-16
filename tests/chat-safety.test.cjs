const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./source-loader.cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('manual controls send explicit user-scoped actions without automatic retries', async () => {
  const calls = [];
  const load = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { calls.push(args); return {}; } } });
  const api = load('src/api/moderationApi.ts');
  await api.fetchSuspension('resident');
  await api.updateSuspension('resident', 'pause_chat', '2026-10-17T00:00:00Z');
  await api.updateSuspension('resident', 'resume_chat');
  await api.updateSuspension('resident', 'suspend_account');
  await api.updateSuspension('resident', 'restore_account');
  assert.equal(calls[0][0], '/api/v1/chat/safety/users/resident/');
  assert.deepEqual(JSON.parse(calls[1][1].body), { action: 'pause_chat', until: '2026-10-17T00:00:00Z' });
  for (const [, options] of calls.slice(1)) assert.equal(options.maxRetries, 0);
  assert.deepEqual(JSON.parse(calls[2][1].body), { action: 'resume_chat' });
  assert.deepEqual(JSON.parse(calls[3][1].body), { action: 'suspend_account' });
  assert.deepEqual(JSON.parse(calls[4][1].body), { action: 'restore_account' });
});

test('controls are progressive disclosure rather than crowded inline suspension buttons', () => {
  const { AccountControls } = loader()('src/components/users/AccountControls.tsx');
  const markup = renderToStaticMarkup(React.createElement(AccountControls, { userId: 'resident', name: 'Test Resident', onSaved() {} }));
  assert.match(markup, /Manage access/);
  assert.doesNotMatch(markup, /Suspend entire account|Pause messaging|dialog/);
});

test('send helpers preserve server-masked content and the sender-only notice', async () => {
  global.crypto ||= require('node:crypto').webcrypto;
  const saved = { chat_message_id: 'saved', message_payload: 'g*go' };
  const load = loader({ 'src/api/apiClient.ts': { fetchApi: async () => ({ data: saved, language_warning: 'Please communicate respectfully.' }), sanitizeUserFriendlyError: value => value } });
  const api = load('src/api/adminApi.ts');
  const result = await api.sendChatMessage('resident', 'gago');
  assert.equal(result.message_payload, 'g*go');
  assert.equal(result.language_warning, 'Please communicate respectfully.');
});
