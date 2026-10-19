const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function loader(overrides = {}) {
  const cache = new Map(Object.entries({ 'src/realtime/index.ts': { realtime: { status: 'idle' } }, ...overrides }).map(([name, value]) => [path.resolve(root, name), value]));
  function load(name) {
    const file = path.resolve(root, name);
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText.replaceAll('import.meta.env', '({})');
    const module = { exports: {} }; cache.set(file, module.exports);
    const localRequire = name => {
      // Icons are irrelevant to data rendering; avoid the package's CJS/ESM shim in Node.
      if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(file), name);
      const target = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
      return load(target);
    };
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return load;
}
const { validateDashboardSnapshot, DashboardRequestGate } = loader()('src/data/adminDashboard.ts');
const metrics = { totalWorkers: 3, totalEmployed: 1, totalAvailable: 2, employmentRatio: 33, totalHomeowners: 2, pendingVerifications: 0 };
const row = { name: 'Agusan', status: 'INACTIVE', totalRegistered: 2, totalWorkers: 1, employed: 0, available: 1, employmentRatio: 0, pending: 1, verified: 1, rejected: 0, noDocuments: 0 };

test('a successful empty snapshot replaces earlier barangay data instead of restoring defaults', () => {
  const value = { metrics, barangays: [] };
  assert.equal(validateDashboardSnapshot(value), value);
});
test('malformed and internally inconsistent statistics are errors, never demo fallbacks', () => {
  assert.throws(() => validateDashboardSnapshot({ barangays: [] }));
  assert.throws(() => validateDashboardSnapshot({ metrics: { ...metrics, totalAvailable: 193 }, barangays: [] }));
  assert.throws(() => validateDashboardSnapshot({ metrics, barangays: [{ ...row, pending: 4 }] }));
  assert.throws(() => validateDashboardSnapshot({ metrics, barangays: [{ ...row, employed: 110 }] }));
  assert.equal(validateDashboardSnapshot({ metrics, barangays: [row] }).barangays[0], row);
});
test('late responses cannot replace a newer request, another jurisdiction or a logged-out session', () => {
  const gate = new DashboardRequestGate();
  const first = gate.begin('admin:all'); const second = gate.begin('admin:all');
  assert.equal(gate.accepts(first, 'admin:all'), false);
  assert.equal(gate.accepts(second, 'admin:all'), true);
  gate.setScope('admin:Agusan'); assert.equal(gate.accepts(second, 'admin:all'), false);
  const third = gate.begin('admin:Agusan'); gate.setScope('logged-out');
  assert.equal(gate.accepts(third, 'admin:Agusan'), false);
});
function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), clear: () => map.clear(), key: index => Array.from(map.keys())[index], get length() { return map.size; } };
}
function withStorage(values, run) {
  const original = global.localStorage; global.localStorage = storage(values);
  return Promise.resolve().then(run).finally(() => { global.localStorage = original; });
}
test('context does not restore poisoned mock barangays from browser storage', async () => {
  await withStorage({ serbisure_admin_barangays: JSON.stringify([{ name: 'Canitoan', employed: 110, available: 88, status: 'ACTIVE' }]) }, () => {
    const context = loader({ 'src/api/adminApi.ts': {} })('src/context/AdminContext.tsx');
    let state;
    function Probe() { state = context.useAdmin(); return null; }
    renderToStaticMarkup(React.createElement(context.AdminProvider, null, React.createElement(Probe)));
    assert.deepEqual(state.barangays, []); assert.deepEqual(state.directoryBarangays, []);
    assert.equal(state.dashboardMetrics, null);
  });
});
test('backend login failure cannot authenticate predefined accounts offline', async () => {
  await withStorage({}, async () => {
    const context = loader({ 'src/api/adminApi.ts': { adminLoginApi: async () => { throw new Error('Server unavailable'); } } })('src/context/AdminContext.tsx');
    let state;
    function Probe() { state = context.useAdmin(); return null; }
    renderToStaticMarkup(React.createElement(context.AdminProvider, null, React.createElement(Probe)));
    const result = await state.login('admin_canitoan', 'not-a-real-password');
    assert.equal(result.success, false);
    assert.equal(global.localStorage.getItem('serbisure_admin_auth'), null);
    assert.equal(global.localStorage.getItem('serbisure_admin_token'), null);
  });
});
function pageLoader(state) {
  return loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state },
    'src/components/dashboard/EmploymentTrendChart.tsx': { EmploymentTrendChart: () => null },
    'src/components/dashboard/VerificationStatusChart.tsx': { VerificationStatusChart: () => null },
    'src/components/dashboard/DashboardActivityTable.tsx': { DashboardActivityTable: () => null } });
}
test('dashboard first paint shows Loading and later renders actual numbers without a mock flash', () => {
  const state = { currentRole: 'SUPERADMIN', selectedBarangay: 'All Barangays', dashboardMetrics: null, dashboardStatsError: null };
  const { DashboardPage } = pageLoader(state)('src/pages/DashboardPage.tsx');
  const loading = renderToStaticMarkup(React.createElement(DashboardPage));
  assert.match(loading, /Loading/); assert.doesNotMatch(loading, /373|193|180/);
  state.dashboardMetrics = metrics;
  const real = renderToStaticMarkup(React.createElement(DashboardPage));
  assert.match(real, />3<\/div>/); assert.doesNotMatch(real, /Loading|373/);
  state.dashboardMetrics = null; state.dashboardStatsError = 'Could not load database statistics.';
  assert.match(renderToStaticMarkup(React.createElement(DashboardPage)), /Unavailable/);
});
test('directory uses database citizen counts and never labels residents as configured LGUs', async () => {
  await withStorage({}, () => {
    const state = { currentRole: 'SUPERADMIN', currentUser: { role: 'SUPERADMIN', name: 'Test Admin' }, selectedBarangay: 'All Barangays', barangays: [], directoryBarangays: [row], dashboardMetrics: metrics, dashboardStatsError: null };
    const { SettingsPage } = pageLoader(state)('src/pages/SettingsPage.tsx');
    const html = renderToStaticMarkup(React.createElement(SettingsPage));
    assert.match(html, /No Account/); assert.match(html, /Setup LGU/);
    assert.doesNotMatch(html, /Active LGU<|Brgy\. Canitoan|Brgy\. Pagatpat/);
    state.dashboardMetrics = null; state.directoryBarangays = [];
    assert.match(renderToStaticMarkup(React.createElement(SettingsPage)), /Loading barangay data/);
    state.dashboardStatsError = 'Could not load database statistics.';
    assert.match(renderToStaticMarkup(React.createElement(SettingsPage)), /Could not load database statistics/);
  });
});

test('skills distribution shows verified-worker counts, percentages, scope and an honest empty state', () => {
  const categories = ['Cleaning', 'Cooking', 'Child_care', 'Caregiver', 'Laundry', 'All-around'].map(category => ({ category, count: category === 'Cleaning' ? 4 : 0, percentage: category === 'Cleaning' ? 80 : 0 }));
  const state = { selectedBarangay: 'Pagatpat', dashboardSkills: { totalWorkers: 5, categories } };
  const { SkillsDistributionPanel } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/dashboard/SkillsDistributionPanel.tsx');
  const html = () => renderToStaticMarkup(React.createElement(SkillsDistributionPanel));
  assert.match(html(), /4 workers \(80%\)/); assert.match(html(), /Pagatpat/);
  assert.match(html(), /aria-valuenow="80"/); assert.match(html(), /Child Care/);
  assert.doesNotThrow(() => validateDashboardSnapshot({ metrics: { ...metrics, totalWorkers: 5, totalAvailable: 4 }, barangays: [], skills: state.dashboardSkills }));
  assert.throws(() => validateDashboardSnapshot({ metrics, barangays: [], skills: state.dashboardSkills }));
  state.dashboardSkills = { totalWorkers: 0, categories: categories.map(item => ({ ...item, count: 0, percentage: 0 })) };
  state.selectedBarangay = 'Agusan'; assert.match(html(), /Agusan/); assert.match(html(), /No verified workers/);
  state.dashboardStatsError = 'offline'; assert.match(html(), /Skills data unavailable/); assert.doesNotMatch(html(), /NaN|Infinity/);
});

test('verification role pills request the correct role and ignore late responses from previous roles and scopes', async t => {
  const Renderer = require('react-test-renderer');
  const pending = [];
  const state = { selectedBarangay: 'All Barangays', barangays: [], userBarangays: ['Agusan'], currentUser: { role: 'SUPERADMIN' }, setSelectedBarangay(value) { state.selectedBarangay = value; } };
  const { VerificationStatusChart } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state },
    'src/api/adminApi.ts': { fetchVerificationStatusStats: (barangay, role) => new Promise((resolve, reject) => pending.push({ barangay, role, resolve, reject })) },
  })('src/components/dashboard/VerificationStatusChart.tsx');
  let view; Renderer.act(() => { view = Renderer.create(React.createElement(VerificationStatusChart)); });
  t.after(() => Renderer.act(() => view.unmount()));
  const choose = role => Renderer.act(() => view.root.findAllByType('button').find(node => node.children.includes(role)).props.onClick());
  const json = () => JSON.stringify(view.toJSON());
  choose('Kasambahay'); assert.equal(pending.at(-1).role, 'Kasambahay');
  await Renderer.act(async () => { pending[0].resolve({ total: 999, stats: { verified: 999, pending: 0, unverified: 0, rejected: 0 } }); await Promise.resolve(); });
  assert.doesNotMatch(json(), /999/);
  await Renderer.act(async () => { pending.at(-1).resolve({ total: 3, stats: { verified: 2, pending: 1, unverified: 0, rejected: 0 } }); await Promise.resolve(); });
  assert.match(json(), /NBI and Police clearances/);
  choose('Homeowner'); assert.equal(pending.at(-1).role, 'Homeowner');
  Renderer.act(() => view.root.findByType('select').props.onChange({ target: { value: 'Agusan' } }));
  assert.equal(pending.at(-1).barangay, 'Agusan'); assert.equal(pending.at(-1).role, 'Homeowner');
  await Renderer.act(async () => { pending.at(-1).resolve({ total: 0, stats: { verified: 0, pending: 0, unverified: 0, rejected: 0 } }); await Promise.resolve(); });
  assert.match(json(), /National ID: front and back/); assert.doesNotMatch(json(), /999/);
});

test('employment chart labels Occupied and leaves months without history visibly unavailable', async t => {
  const Renderer = require('react-test-renderer');
  let calls = 0;
  const state = { selectedBarangay: 'All Barangays', barangays: [], userBarangays: [], dashboardMetrics: { totalWorkers: 5, totalEmployed: 2, totalAvailable: 3 } };
  const { EmploymentTrendChart } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state },
    'src/api/adminApi.ts': { fetchMonthlyTrend: async () => { calls++; return { trend: [{ month: 'Sep', year: 2026, employed: null, available: null, total: null, has_history: false },
      { month: 'Oct', year: 2026, employed: 2, available: 3, total: 5, has_history: true }] }; } },
  })('src/components/dashboard/EmploymentTrendChart.tsx');
  let view; await Renderer.act(async () => { view = Renderer.create(React.createElement(EmploymentTrendChart)); await Promise.resolve(); });
  t.after(() => Renderer.act(() => view.unmount()));
  const json = JSON.stringify(view.toJSON());
  assert.match(json, /No history/); assert.match(json, /Occupied/); assert.doesNotMatch(json, /On the Job|NaN/);
  const bars = view.root.findAllByType('rect').filter(node => String(node.props.fill).includes('BarGradient'));
  assert.equal(bars.length, 2); // Only the known current month has bars.
  const occupiedHeight = bars[0].props.height;
  state.dashboardMetrics = { totalWorkers: 5, totalEmployed: 4, totalAvailable: 1 };
  Renderer.act(() => view.update(React.createElement(EmploymentTrendChart)));
  assert.ok(view.root.findAllByType('rect').find(node => String(node.props.fill).includes('occupiedBarGradient')).props.height > occupiedHeight);
  assert.equal(calls, 1); // Reuse the cards' existing live refresh without fetching history again.
});
