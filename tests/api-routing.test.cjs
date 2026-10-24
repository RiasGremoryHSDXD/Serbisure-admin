const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');

function client(env, origin) {
  const source = fs.readFileSync(path.join(__dirname, '../src/api/apiClient.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText.replaceAll('import.meta.env', 'testEnv');
  const module = { exports: {} };
  new Function('exports', 'testEnv', 'window', js)(module.exports, env, { location: { origin } });
  return module.exports;
}

test('local development uses the page origin on phones and desktops for API and realtime', () => {
  for (const backend of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000']) {
    for (const origin of ['http://192.168.1.14:3000', 'http://localhost:3000']) {
      const api = client({ DEV: true, VITE_API_URL: backend }, origin);
      assert.equal(api.API_BASE_URL, origin);
      assert.equal(api.buildApiUrl('/api/v1/accounts/admin/login/'), origin + '/api/v1/accounts/admin/login/');
      assert.equal(api.buildApiUrl('api/v1/accounts/admin/users/'), origin + '/api/v1/accounts/admin/users/');
      assert.equal(api.isCloudBackend(), false);
    }
  }
});

test('hosted targets and production builds keep their explicitly configured backend', () => {
  const cloud = 'https://serbisure-backend-rho.vercel.app';
  assert.equal(client({ DEV: true, VITE_API_URL: cloud }, 'http://192.168.1.14:3000').API_BASE_URL, cloud);
  assert.equal(client({ DEV: false, VITE_API_URL: cloud }, 'https://admin.example.test').API_BASE_URL, cloud);
  assert.equal(client({ DEV: false, VITE_API_URL: 'http://localhost:8000' }, 'http://localhost:3000').API_BASE_URL, 'http://localhost:8000');
});

test('without an override the staging branch uses Railway for API and realtime', () => {
  for (const DEV of [true, false]) {
    const api = client({ DEV }, 'http://localhost:3000');
    assert.equal(api.API_BASE_URL, 'https://serbisure-backend-staging-production.up.railway.app');
    assert.equal(api.buildApiUrl('/api/v1/accounts/admin/penalties/users/'),
      'https://serbisure-backend-staging-production.up.railway.app/api/v1/accounts/admin/penalties/users/');
  }
});

test('the Vite API proxy preserves login requests and backend responses', async t => {
  const received = [];
  const backend = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ method: req.method, path: req.url, body });
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Invalid credentials.' }));
    });
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => backend.close(resolve)));
  const previous = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://127.0.0.1:${backend.address().port}`;
  t.after(() => { if (previous === undefined) delete process.env.VITE_API_URL; else process.env.VITE_API_URL = previous; });
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: path.resolve(__dirname, '..'),
    server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  });
  t.after(() => vite.close());
  await vite.listen();
  const response = await fetch(`http://127.0.0.1:${vite.httpServer.address().port}/api/v1/accounts/admin/login/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'routing-test@example.test', password: 'test-only' }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { detail: 'Invalid credentials.' });
  assert.deepEqual(received, [{ method: 'POST', path: '/api/v1/accounts/admin/login/', body: JSON.stringify({ email: 'routing-test@example.test', password: 'test-only' }) }]);
  assert.equal(vite.config.server.proxy['/ws'].target, `http://127.0.0.1:${backend.address().port}`);
  assert.equal(vite.config.server.proxy['/ws'].ws, true);
});
