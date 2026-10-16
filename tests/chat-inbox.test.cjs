const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./source-loader.cjs');
const { ChatInboxStore, parseChatInbox, unreadMessageCount } = loader()('src/data/chatInbox.ts');
const entry = (id, count, type = 'Homeowner') => ({ partner_id: id, partner_name: `User ${id}`,
  partner_account_type: type, last_message: 'Hello admin', last_message_time: '2026-10-12T10:00:00+08:00', unread_count: count, sent_count: 1 });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('counts are received messages, including multiple unread messages from one partner', async () => {
  const store = new ChatInboxStore(async () => [entry('home', 2), entry('worker', 3, 'Kasambahay'), entry('officer', 0, 'Barangay')]);
  store.setAccount('superadmin'); await store.refresh();
  assert.equal(unreadMessageCount(store.snapshot.entries), 5);
});
test('a successful empty inbox clears old previews and badges', async () => {
  let entries = [entry('worker', 4)]; const store = new ChatInboxStore(async () => entries);
  store.setAccount('officer'); await store.refresh(); entries = []; await store.refresh();
  assert.deepEqual(store.snapshot.entries, []); assert.equal(store.snapshot.loaded, true);
});
test('failed sync retains confirmed counts with an error, and successful retry recovers', async () => {
  let fail = false; const store = new ChatInboxStore(async () => { if (fail) throw new Error('Offline'); return [entry('home', 2)]; });
  store.setAccount('admin'); await store.refresh(); fail = true; await store.refresh();
  assert.equal(unreadMessageCount(store.snapshot.entries), 2); assert.match(store.snapshot.error, /out of date/);
  fail = false; await store.refresh(); assert.equal(store.snapshot.error, null);
});
test('late responses cannot expose a previous account inbox after switching accounts or logout', async () => {
  const old = deferred(); let calls = 0;
  const store = new ChatInboxStore(() => ++calls === 1 ? old.promise : Promise.resolve([entry('new', 1)]));
  store.setAccount('superadmin'); const pending = store.refresh();
  store.setAccount('barangay'); assert.deepEqual(store.snapshot.entries, []);
  await store.refresh(); old.resolve([entry('private', 9)]); await pending;
  assert.equal(store.snapshot.account, 'barangay'); assert.equal(store.snapshot.entries[0].partner_id, 'new');
  store.setAccount(null); await store.refresh(); assert.deepEqual(store.snapshot.entries, []); assert.equal(calls, 2);
});
test('overlapping polls coalesce, but a read acknowledgment queues a fresh authoritative count', async () => {
  const beforeRead = deferred(); let calls = 0;
  const store = new ChatInboxStore(() => ++calls === 1 ? beforeRead.promise : Promise.resolve([entry('home', 0)]));
  store.setAccount('admin'); const first = store.refresh();
  assert.equal(store.refresh(), first); store.refresh(true); store.refresh(true);
  beforeRead.resolve([entry('home', 3)]); await first;
  assert.equal(calls, 2); assert.equal(unreadMessageCount(store.snapshot.entries), 0);
});
test('malformed inbox responses are errors, never assumed zero unread messages', () => {
  assert.deepEqual(parseChatInbox({ data: [] }), []);
  assert.equal(parseChatInbox({ results: [{ ...entry('home', 1), last_message: null }] })[0].last_message, '');
  for (const response of [{}, { data: null }, [entry('x', -1)], [entry('x', 1.5)], [entry('x', 1), entry('x', 1)]]) {
    assert.throws(() => parseChatInbox(response));
  }
});
const state = { currentRole: 'SUPERADMIN', selectedBarangay: 'All Barangays', activeNav: 'dashboard',
  currentUser: { id: 'admin', role: 'SUPERADMIN', name: 'Admin', username: 'admin', email: 'admin@example.test' },
  verifications: [], users: [], userBarangays: [], unreadChatCount: 5, chatInboxLoaded: true, chatInboxError: null,
  chatInbox: [entry('home', 2), entry('worker', 3, 'Kasambahay')], setActiveNav() {}, refreshChatInbox() {}, requestedChatPartner: null };
function uiLoader() { return loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state }, 'src/api/adminApi.ts': {} }); }
test('global header and expanded/collapsed navigation show counts on the dashboard for either admin role', () => {
  const load = uiLoader(); const { Header } = load('src/components/layout/Header.tsx'); const { Sidebar } = load('src/components/layout/Sidebar.tsx');
  for (const role of ['SUPERADMIN', 'ADMIN']) {
    state.currentRole = role;
    assert.match(renderToStaticMarkup(React.createElement(Header)), /Messages, 5 unread messages/);
    for (const collapsed of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Sidebar, { isSidebarCollapsed: collapsed, setIsSidebarCollapsed() {} }));
      assert.match(html, /Users, 5 unread messages/); assert.match(html, />5<\/span>/);
    }
  }
});
test('directory shows per-user unread count and badges on other role tabs', () => {
  state.currentRole = 'SUPERADMIN';
  state.users = [{ id: 'home', name: 'Homeowner One', role: 'HOMEOWNER', email: 'home@example.test',
    avatar: '', barangay: 'Pagatpat', socialLinks: [], joinedDate: '2026-10-12', contactNumber: '', city: 'CDO' }];
  const { UserDirectory } = uiLoader()('src/components/users/UserDirectory.tsx');
  const html = renderToStaticMarkup(React.createElement(UserDirectory));
  assert.match(html, /Homeowner One, 2 unread messages/);
  assert.match(html, /Kasambahays <span aria-label="3 unread messages"/);
  assert.match(html, /Hello admin/);
});
test('badges disappear at zero, cap visually at 99+ and retain exact accessible count', () => {
  const { UnreadBadge } = loader()('src/components/chat/UnreadBadge.tsx');
  assert.equal(renderToStaticMarkup(React.createElement(UnreadBadge, { count: 0 })), '');
  const html = renderToStaticMarkup(React.createElement(UnreadBadge, { count: 105 }));
  assert.match(html, /105 unread messages/); assert.match(html, /99\+/);
});


test('resident access controls move to the table while authorized staff controls remain in staff profiles', () => {
  state.currentRole = 'SUPERADMIN';
  for (const [role, expected] of [['HOMEOWNER', false], ['BARANGAY', true]]) {
    state.users = [{ id: 'person', name: 'Test Person', role, email: 'person@example.test',
      avatar: '', barangay: 'Pagatpat', socialLinks: [], joinedDate: '2026-10-12', contactNumber: '', city: 'CDO', canManageSuspension: true }];
    const { UserDirectory } = uiLoader()('src/components/users/UserDirectory.tsx');
    const html = renderToStaticMarkup(React.createElement(UserDirectory));
    assert.equal(html.includes('Manage access for Test Person'), expected);
  }
});
