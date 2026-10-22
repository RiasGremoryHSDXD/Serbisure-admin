const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const loader = require('./source-loader.cjs');
const data = loader()('src/data/penalties.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const user = { id: 'resident', name: 'Ana Cruz', account_type: 'Homeowner', barangay: 'Pagatpat', penalty_points: 1,
  is_restricted: false, penalty_month: '2026-10-01', resets_at: '2026-11-01T00:00:00+08:00' };
const review = () => ({ user: { ...user }, cancellations: { count: 0, results: [] }, recent_adjustments: [] });
const draft = { points_delta: -1, reason: 'Verified unfair cancellation.', report_verified: false, incident_reference: '' };

test('history uses labelled table columns and keeps long notes available without expanding every row', t => {
  const { PenaltyHistoryList } = loader()('src/components/penalties/PenaltyHistoryList.tsx');
  const record = { id: 'audit-1', user_name: 'Ana Peña', user_role: 'Homeowner', user_barangay: 'Pagatpat',
    points_delta: -1, points_before: 2, points_after: 1, reason: 'Verified safety report. '.repeat(20),
    report_verified: true, incident_reference: 'BLT-2026-001', booking_id_snapshot: 'booking-12345678',
    admin_name: 'Demo Administrator', admin_role: 'Admin', penalty_month: '2026-10-01', created_at: '2026-10-22T03:20:00Z' };
  let view;
  act(() => { view = Renderer.create(React.createElement(PenaltyHistoryList, { records: [record] })); });
  t.after(() => act(() => view.unmount()));
  assert.deepEqual(view.root.findAllByType('th').map(node => node.children.join('')), [
    'User', 'Change', 'Score', 'Reason / incident notes', 'Report / cancellation', 'Adjusted by', 'Date / period',
  ]);
  assert.equal(view.root.findAllByType('tbody')[0].findAllByType('td').length, 7);
  assert.equal(view.root.findByType('details').findByType('p').children.join(''), record.reason);
  assert.match(JSON.stringify(view.toJSON()), /BLT-2026-001/);
  assert.match(JSON.stringify(view.toJSON()), /Demo Administrator/);
});

test('draft validation protects score bounds and requires a reason and verified report reference', () => {
  assert.equal(data.validatePenaltyDraft(user, draft), null);
  assert.match(data.validatePenaltyDraft(user, { ...draft, points_delta: -2 }), /between 0 and 3/);
  assert.match(data.validatePenaltyDraft(user, { ...draft, points_delta: 0 }), /Choose/);
  assert.match(data.validatePenaltyDraft(user, { ...draft, points_delta: 1.5 }), /Choose/);
  assert.match(data.validatePenaltyDraft(user, { ...draft, reason: ' ' }), /10 characters/);
  assert.match(data.validatePenaltyDraft(user, { ...draft, report_verified: true }), /reference/);
  assert.equal(data.validatePenaltyDraft(user, { ...draft, report_verified: true, incident_reference: 'BLT-001' }), null);
  for (const invalid of [{}, { ...user, penalty_points: undefined }, { ...user, penalty_points: -1 }, { ...user, penalty_points: 4 }]) {
    assert.throws(() => data.parsePenaltyUser(invalid), /could not be loaded/);
  }
});

test('API uses server-scoped reads, guarded writes without automatic retries, and authenticated PDF responses', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => {
    calls.push(args); if (args[0].includes('/export/')) return new Blob(['%PDF-1.7\nSample report'], { type: 'application/pdf' });
    if (args[0].includes('/users/resident/')) return args[1]?.method === 'POST' ? { user, record: {} } : review();
    return { count: 1, results: [user] };
  } } })('src/api/penaltyApi.ts');
  const filters = { search: ' Ana ', role: 'Homeowner', barangay: 'Pagatpat', points: '0' };
  await api.fetchPenaltyUsers(filters, 2); await api.fetchPenaltyReview('resident', 1);
  await api.adjustPenalty(user, draft, 'request-id');
  const report = await api.exportPenaltyHistory(filters);
  assert.equal(report.type, 'application/pdf');
  assert.match(await report.text(), /^%PDF-/);
  const query = new URL(calls[0][0], 'http://test.local').searchParams;
  assert.equal(query.get('barangay'), 'Pagatpat'); assert.equal(query.get('role'), 'Homeowner');
  assert.equal(query.get('search'), 'Ana'); assert.equal(query.get('page'), '2');
  assert.equal(query.get('points'), '0');
  const body = JSON.parse(calls[2][1].body);
  assert.equal(body.expected_points, 1); assert.equal(body.expected_month, '2026-10-01');
  assert.equal(body.request_id, 'request-id'); assert.equal(calls[2][1].maxRetries, 0);
  assert.equal(calls[3][1].responseType, 'blob');
  await api.fetchPenaltyUsers({ ...filters, points: 'with_penalties' }, 1);
  assert.equal(new URL(calls[4][0], 'http://test.local').searchParams.get('points'), 'with_penalties');
});

test('shared authenticated HTTP wrapper preserves PDF bytes and keeps JSON as the default', async t => {
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255, 128]);
  global.fetch = async () => new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
  const api = loader()('src/api/apiClient.ts');
  const report = await api.fetchApi('/export/', { responseType: 'blob' });
  assert.equal(report.type, 'application/pdf');
  assert.deepEqual(new Uint8Array(await report.arrayBuffer()), bytes);
  global.fetch = async () => new Response('{"count":0}', { headers: { 'Content-Type': 'application/json' } });
  assert.deepEqual(await api.fetchApi('/history/'), { count: 0 });
  global.fetch = async () => new Response('{"detail":"Access denied."}', { status: 403, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(api.fetchApi('/export/', { responseType: 'blob' }), { status: 403, message: 'Access denied.' });
});

test('PDF export rejects a successful HTML or JSON response instead of downloading a broken file', async () => {
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async () => new Blob(['Login page'], { type: 'text/html' }) } })('src/api/penaltyApi.ts');
  await assert.rejects(api.exportPenaltyHistory({ search: '', role: '', barangay: 'All Barangays' }), /PDF could not be generated/);
});

async function dialog(t) {
  const old = global.document; global.document = { body: {}, activeElement: null };
  let current = review(); const writes = [], saved = [], reads = [];
  const load = loader({ 'react-dom': { createPortal: children => children }, 'src/api/penaltyApi.ts': {
    async fetchPenaltyReview(...args) { reads.push(args); return current; },
    adjustPenalty(...args) { const request = { ...deferred(), args }; writes.push(request); return request.promise; },
  } });
  const { PenaltyReviewDialog } = load('src/components/penalties/PenaltyReviewDialog.tsx');
  let view;
  await act(async () => { view = Renderer.create(React.createElement(PenaltyReviewDialog, {
    userId: 'resident', onClose() {}, onSaved: value => saved.push(value),
  }), { createNodeMock: () => ({ focus() {}, querySelectorAll: () => [] }) }); });
  t.after(() => { act(() => view.unmount()); global.document = old; });
  const button = text => view.root.findAllByType('button').find(node => node.children.join('') === text);
  return { view, writes, saved, reads, button,
    type(reason) { act(() => view.root.findByProps({ 'aria-label': 'Reason or incident notes' }).props.onChange({ target: { value: reason } })); },
    submit() { act(() => { void view.root.findByType('form').props.onSubmit({ preventDefault() {} }); }); },
    async fail(error) { await act(async () => writes.at(-1).reject(error)); },
    async resolve() { await act(async () => writes.at(-1).resolve({ user: { ...user, penalty_points: 0 }, record: {} })); },
    setReview(value) { current = value; },
    async refresh() { await act(async () => button('Refresh score').props.onClick()); },
    unmount() { act(() => view.unmount()); },
  };
}

test('review prevents double submit and retains the draft and request ID after a network failure', async t => {
  const screen = await dialog(t); screen.type('Verified unfair cancellation.'); screen.submit(); screen.submit();
  assert.equal(screen.writes.length, 1);
  const id = screen.writes[0].args[2];
  await screen.fail(new Error('Connection timed out. Please retry.'));
  assert.equal(screen.view.root.findByType('textarea').props.value, 'Verified unfair cancellation.');
  screen.submit(); assert.equal(screen.writes.length, 2); assert.equal(screen.writes[1].args[2], id);
  await screen.resolve(); assert.equal(screen.saved[0].penalty_points, 0);
});

test('a stale score blocks another save until refreshed, then uses the current score', async t => {
  const screen = await dialog(t); screen.type('Verified unfair cancellation.'); screen.submit();
  await screen.fail(Object.assign(new Error('Points changed. Refresh before adjusting.'), { status: 409 }));
  assert.equal(screen.button('Apply adjustment').props.disabled, true);
  screen.submit(); assert.equal(screen.writes.length, 1);
  screen.setReview({ ...review(), user: { ...user, penalty_points: 2 } }); await screen.refresh();
  screen.submit(); assert.equal(screen.writes[1].args[0].penalty_points, 2);
  assert.notEqual(screen.writes[0].args[2], screen.writes[1].args[2]);
});

test('verified incidents need an explicit report reference and late writes cannot update a closed scope', async t => {
  const screen = await dialog(t); screen.type('Verified unfair cancellation.');
  act(() => screen.view.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } }));
  assert.equal(screen.button('Apply adjustment').props.disabled, true);
  act(() => screen.view.root.findByProps({ 'aria-label': 'Report or blotter reference' }).props.onChange({ target: { value: 'BLT-001' } }));
  screen.submit(); assert.equal(screen.writes[0].args[1].report_verified, true);
  assert.equal(screen.writes[0].args[1].incident_reference, 'BLT-001');
  screen.unmount(); await screen.resolve(); assert.deepEqual(screen.saved, []);
});

test('changing barangay immediately hides old records and ignores late responses from the previous scope', async t => {
  const old = global.document; global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const requests = []; let context = { currentUser: { id: 'admin' }, currentRole: 'SUPERADMIN', selectedBarangay: 'Pagatpat' };
  const load = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => context },
    'src/realtime/index.ts': { realtime: { subscribe: () => () => {} } },
    'src/api/penaltyApi.ts': { fetchPenaltyUsers(filters) { const request = { ...deferred(), filters }; requests.push(request); return request.promise; } },
  });
  const { PenaltyPointsPage } = load('src/pages/PenaltyPointsPage.tsx'); let view;
  act(() => { view = Renderer.create(React.createElement(PenaltyPointsPage)); });
  t.after(() => { act(() => view.unmount()); global.document = old; });
  context = { ...context, selectedBarangay: 'Carmen' };
  act(() => view.update(React.createElement(PenaltyPointsPage)));
  await act(async () => requests[0].resolve({ count: 1, results: [user] }));
  assert.doesNotMatch(JSON.stringify(view.toJSON()), /Ana Cruz/);
  await act(async () => requests[1].resolve({ count: 0, results: [] }));
  assert.match(JSON.stringify(view.toJSON()), /No matching users/);
  assert.equal(requests[1].filters.barangay, 'Carmen');
});

test('score filter resets pagination, combines with the role filter, and stays separate from historical records', async t => {
  const old = global.document; global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const requests = [];
  const load = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => ({ currentUser: { id: 'admin' }, currentRole: 'SUPERADMIN', selectedBarangay: 'Pagatpat' }) },
    'src/realtime/index.ts': { realtime: { subscribe: () => () => {} } },
    'src/api/penaltyApi.ts': {
      async fetchPenaltyUsers(filters, page) { requests.push({ filters, page }); return { count: 21, results: [user] }; },
      async fetchPenaltyHistory(filters, page) { requests.push({ filters, page, history: true }); return { count: 0, results: [] }; },
    },
  });
  const { PenaltyPointsPage } = load('src/pages/PenaltyPointsPage.tsx'); let view;
  await act(async () => { view = Renderer.create(React.createElement(PenaltyPointsPage)); });
  t.after(() => { act(() => view.unmount()); global.document = old; });
  const button = text => view.root.findAllByType('button').find(node => node.children.join('') === text);
  await act(async () => button('Next').props.onClick());
  assert.equal(requests.at(-1).page, 2);
  await act(async () => view.root.findByProps({ 'aria-label': 'Penalty score' }).props.onChange({ target: { value: '1' } }));
  assert.equal(requests.at(-1).page, 1);
  assert.equal(requests.at(-1).filters.points, '1');
  await act(async () => view.root.findAllByType('select').find(node => !node.props['aria-label']).props.onChange({ target: { value: 'Homeowner' } }));
  assert.equal(requests.at(-1).filters.role, 'Homeowner');
  assert.equal(requests.at(-1).filters.points, '1');
  await act(async () => button('Adjustment history').props.onClick());
  assert.equal(requests.at(-1).filters.points, '');
  assert.equal(view.root.findAllByProps({ 'aria-label': 'Penalty score' }).length, 0);
  await act(async () => button('User points').props.onClick());
  assert.equal(requests.at(-1).filters.points, '1');
});
