const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./source-loader.cjs');
const data = loader()('src/data/accountAccess.ts');
const now = Date.parse('2026-10-16T08:00:00Z');
const resident = (id, overrides = {}) => ({ id, name: `Resident ${id}`, role: 'HOMEOWNER', avatar: '',
  barangay: 'Pagatpat', canManageSuspension: true, isAccountActive: true, isAccountSuspended: false,
  chatSuspendedUntil: null, ...overrides });

test('effective access uses expiry and distinguishes whole-account suspension from chat pauses', () => {
  assert.equal(data.accountAccessStatus(resident('a'), now), 'available');
  assert.equal(data.accountAccessStatus(resident('a', { chatSuspendedUntil: '2026-10-16T08:00:01Z' }), now), 'chat_paused');
  assert.equal(data.accountAccessStatus(resident('a', { chatSuspendedUntil: '2026-10-16T08:00:00Z' }), now), 'available');
  assert.equal(data.accountAccessStatus(resident('a', { chatSuspendedUntil: '2026-10-17T08:00:00Z', isAccountSuspended: true }), now), 'account_suspended');
  assert.equal(data.accountAccessStatus(resident('a', { isAccountActive: false }), now), 'deactivated');
});

test('search, role and access filters combine without mixing in administrative accounts', () => {
  const users = [resident('a', { name: 'Ana Cruz' }), resident('b', { name: 'Ben Doe', role: 'KASAMBAHAY', barangay: 'Carmen', isAccountSuspended: true }),
    resident('staff', { role: 'BARANGAY' })];
  assert.deepEqual(data.filterAccessUsers(users, '  ANA  ', 'ALL', 'ALL', now).map(user => user.id), ['a']);
  assert.deepEqual(data.filterAccessUsers(users, 'carmen', 'KASAMBAHAY', 'account_suspended', now).map(user => user.id), ['b']);
  assert.equal(data.filterAccessUsers(users, '', 'HOMEOWNER', 'account_suspended', now).length, 0);
  assert.equal(data.filterAccessUsers(users, '', 'ALL', 'ALL', now).length, 2);
});

test('pagination clamps after filters or a suspension removes rows from the current result set', () => {
  const users = Array.from({ length: 21 }, (_, index) => resident(String(index)));
  assert.deepEqual(data.accessPage(users, 3).rows.map(user => user.id), ['20']);
  assert.equal(data.accessPage(users.slice(0, 5), 3).page, 1);
  assert.deepEqual(data.accessPage([], 9), { page: 1, totalPages: 1, rows: [] });
});

test('missing suspension fields and malformed responses never become false Available states', () => {
  for (const invalid of [{}, [{ id: 'partial', name: 'Partial', role: 'HOMEOWNER' }],
    [resident('a', { chatSuspendedUntil: 'not-a-date' })], [resident('a', { isAccountSuspended: 'false' })]]) {
    assert.throws(() => data.parseAccountAccessUsers(invalid), /could not be loaded/);
  }
  assert.deepEqual(data.parseAccountAccessUsers([]), []);
  assert.deepEqual(data.parseAccountAccessUsers([resident('a')]), [resident('a')]);
});

test('roster API requests the explicit server-scoped management view', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async path => { calls.push(path); return [resident('a')]; } } })('src/api/moderationApi.ts');
  assert.equal((await api.fetchAccountAccessUsers('Brgy. Pagatpat')).length, 1);
  const url = new URL(calls[0], 'http://test.local');
  assert.equal(url.pathname, '/api/v1/accounts/admin/users/');
  assert.equal(url.searchParams.get('access_management'), '1');
  assert.equal(url.searchParams.get('barangay'), 'Brgy. Pagatpat');
});

test('table keeps one named management action per person and displays independent access states', () => {
  const { AccountAccessTable } = loader()('src/components/users/AccountAccessTable.tsx');
  const html = renderToStaticMarkup(React.createElement(AccountAccessTable, {
    users: [resident('one', { name: 'Ana Cruz' }), resident('two', { name: 'Ben Doe', role: 'KASAMBAHAY', isAccountSuspended: true })], now, onSaved() {},
  }));
  assert.match(html, /<table/); assert.match(html, /Homeowner/); assert.match(html, /Kasambahay/);
  assert.match(html, /Available/); assert.match(html, /Account suspended/);
  assert.match(html, /Manage access for Ana Cruz/); assert.match(html, /Manage access for Ben Doe/);
  assert.equal((html.match(/>Manage access<\/button>/g) || []).length, 2);
});

test('both sidebar roles place Account Access immediately below Users, including collapsed mode', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) for (const collapsed of [false, true]) {
    const { Sidebar } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => ({ currentRole: role, selectedBarangay: 'Pagatpat',
      activeNav: 'account-access', setActiveNav() {}, verifications: [], currentUser: {}, logout() {}, unreadChatCount: 0 }) } })('src/components/layout/Sidebar.tsx');
    const html = renderToStaticMarkup(React.createElement(Sidebar, { isSidebarCollapsed: collapsed, setIsSidebarCollapsed() {} }));
    assert.match(html, /aria-label="Account Access"/);
    assert.ok(html.indexOf('aria-label="Users,') < html.indexOf('aria-label="Account Access"'));
    assert.ok(html.indexOf('aria-label="Account Access"') < html.indexOf('aria-label="Settings"'));
  }
});


test('page shows clear loading, empty and error states without inventing account rows', () => {
  for (const roster of [
    { users: [], loaded: false, loading: true, error: null, expected: /Loading accounts/ },
    { users: [], loaded: true, loading: false, error: null, expected: /No accounts to manage/ },
    { users: [], loaded: false, loading: false, error: 'Connection unavailable', expected: /Connection unavailable/ },
  ]) {
    const load = loader({
      'src/context/AdminContext.tsx': { useAdmin: () => ({ currentUser: { id: 'admin' }, currentRole: 'SUPERADMIN', selectedBarangay: 'All Barangays', refreshUsers() {} }) },
      'src/hooks/useAccountAccessUsers.ts': { useAccountAccessUsers: () => ({ ...roster, refresh() {} }) },
    });
    const { AccountAccessPage } = load('src/pages/AccountAccessPage.tsx');
    const html = renderToStaticMarkup(React.createElement(AccountAccessPage));
    assert.match(html, roster.expected);
    assert.doesNotMatch(html, /Manage access for/);
  }
});
