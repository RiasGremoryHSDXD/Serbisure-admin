const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./source-loader.cjs');
const row = (overrides = {}) => ({ log_id: 'log-one', actor_id_snapshot: 'official-one', actor_name: 'Pagatpat Desk',
  actor_role: 'Barangay', actor_barangay: 'Pagatpat', target_id_snapshot: 'resident-one', target_name: 'Ana Cruz',
  target_role: 'Homeowner', target_barangay: 'Pagatpat', action: 'pause_chat',
  previous_state: { chat_suspended_until: null, is_account_suspended: false },
  new_state: { chat_suspended_until: '2026-10-17T08:00:00Z', is_account_suspended: false },
  created_at: '2026-10-16T08:00:00Z', ...overrides });

test('history parser rejects partial, invalid, duplicate or inconsistent records instead of showing an empty success', () => {
  const { parseAccessHistory } = loader()('src/data/accessHistory.ts');
  assert.deepEqual(parseAccessHistory({ count: 0, results: [] }), { count: 0, results: [] });
  assert.equal(parseAccessHistory({ count: 1, results: [row()] }).results.length, 1);
  for (const invalid of [{}, { count: 1, results: [] }, { count: 0, results: [row()] },
    { count: 1, results: [row({ action: 'ban' })] }, { count: 1, results: [row({ created_at: 'bad' })] },
    { count: 1, results: [row({ new_state: { is_account_suspended: false } })] },
    { count: 2, results: [row(), row()] }, { count: -1, results: [] }]) assert.throws(() => parseAccessHistory(invalid), /could not be loaded/);
});

test('history API sends encoded read-only search and pagination parameters', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { calls.push(args); return { count: 0, results: [] }; } } })('src/api/moderationApi.ts');
  await api.fetchAccessHistory({ page: 2, search: '  Ana & Ben  ', action: 'resume_chat', barangay: 'Brgy. Pagatpat' });
  const url = new URL(calls[0][0], 'https://test.local');
  assert.equal(url.pathname, '/api/v1/chat/safety/history/');
  assert.equal(url.searchParams.get('search'), 'Ana & Ben');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('action'), 'resume_chat');
  assert.equal(url.searchParams.get('barangay'), 'Brgy. Pagatpat');
  assert.equal(calls[0].length, 1);
});

test('history export fetches every filtered page before generating a report', async () => {
  const calls = [];
  const pageRows = (start, count) => Array.from({ length: count }, (_, index) => row({ log_id: `log-${start + index}` }));
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => {
    calls.push(args[0]);
    const page = Number(new URL(args[0], 'https://test.local').searchParams.get('page'));
    return { count: 7, results: page === 1 ? pageRows(1, 5) : pageRows(6, 2) };
  } } })('src/api/moderationApi.ts');
  const entries = await api.fetchAllAccessHistory({ search: 'Ana', action: 'pause_chat', barangay: 'Pagatpat' });
  assert.equal(entries.length, 7);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2/);
  assert.match(calls[1], /action=pause_chat/);
});

test('history table shows permanent identity snapshots as static rows without edit/delete controls', () => {
  const { AccessHistoryTable } = loader()('src/components/users/AccountAccessHistory.tsx');
  const html = renderToStaticMarkup(React.createElement(AccessHistoryTable, { entries: [row()] }));
  for (const label of ['Ana Cruz', 'Pagatpat Desk', 'Messaging paused', 'Brgy. Pagatpat']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /<details|View details|Record ID/);
  assert.match(html, /<time dateTime=/);
  assert.doesNotMatch(html, /<button|<input|<select|<form/);
});

test('history uses distinct loading, empty, failure and populated states', () => {
  for (const [data, error, expected] of [[null, null, /Loading access history/],
    [{ count: 0, results: [] }, null, /No access changes yet/],
    [null, 'History unavailable', /History unavailable/],
    [{ count: 1, results: [row()] }, null, /Ana Cruz/]]) {
    const { AccountAccessHistory } = loader({ 'src/hooks/useAccessHistory.ts': { useAccessHistory: () => ({ data, error, loading: !data && !error, refresh() {} }) } })('src/components/users/AccountAccessHistory.tsx');
    const html = renderToStaticMarkup(React.createElement(AccountAccessHistory, { accountId: 'one', role: 'ADMIN', barangay: 'Pagatpat', revision: 0 }));
    assert.match(html, expected);
  }
});

// Minimal lifecycle harness: run effect cleanup on scope changes and observe
// actual hook promises without adding a DOM/runtime dependency to the project.
function hookHarness(fetchAccessHistory) {
  const slots = []; let cursor = 0; let pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        pending.push(() => { cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const { useAccessHistory } = loader({ react: hooks,
    'src/api/moderationApi.ts': { fetchAccessHistory },
    'src/realtime/index.ts': { realtime: { subscribe: () => () => {} } },
  })('src/hooks/useAccessHistory.ts');
  return { render(...args) { cursor = 0; const value = useAccessHistory(...args); const effects = pending; pending = []; effects.forEach(effect => effect()); return value; },
    cleanup() { slots.forEach(slot => slot?.cleanup?.()); } };
}

test('late history responses never cross account, jurisdiction, search or logout boundaries and retries recover', async () => {
  const requests = [];
  const previousDocument = global.document;
  global.document = { addEventListener() {}, removeEventListener() {}, hidden: false };
  const h = hookHarness(filters => new Promise((resolve, reject) => requests.push({ filters, resolve, reject })));
  const filters = { page: 1, search: '', action: '' };
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  try {
    h.render('desk-one', 'ADMIN', 'Pagatpat', filters, 0);
    h.render('desk-two', 'ADMIN', 'Carmen', filters, 0);
    requests[0].resolve({ count: 1, results: [row()] }); await flush();
    assert.equal(h.render('desk-two', 'ADMIN', 'Carmen', filters, 0).data, null);
    assert.equal(requests[1].filters.barangay, 'Carmen'); // The backend, not this presentation filter, enforces authority.
    requests[1].resolve({ count: 0, results: [] }); await flush();
    assert.equal(h.render('desk-two', 'ADMIN', 'Carmen', filters, 0).data.count, 0);
    const search = { ...filters, search: 'Ben' };
    assert.equal(h.render('desk-two', 'ADMIN', 'Carmen', search, 0).data, null);
    requests[2].reject(new Error('Connection unavailable')); await flush();
    const failed = h.render('desk-two', 'ADMIN', 'Carmen', search, 0);
    assert.equal(failed.error, 'Connection unavailable'); failed.refresh();
    h.render('desk-two', 'ADMIN', 'Carmen', search, 0);
    requests[3].resolve({ count: 0, results: [] }); await flush();
    const recovered = h.render('desk-two', 'ADMIN', 'Carmen', search, 0);
    assert.equal(recovered.error, null); assert.equal(recovered.data.count, 0);
    assert.equal(h.render(undefined, 'ADMIN', 'Carmen', search, 0).data, null);
  } finally { h.cleanup(); global.document = previousDocument; }
});
