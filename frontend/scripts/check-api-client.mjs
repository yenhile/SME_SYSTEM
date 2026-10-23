import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');
async function fixture(run) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/hang') { req.resume(); return; }
    if (req.url === '/api/slow-body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    if (req.url === '/api/disconnect') { req.socket.destroy(); return; }
    if (req.url === '/api/auth/login' || req.url === '/api/expired') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' })); return;
    }
    if (req.url === '/api/file') { res.end('document-content'); return; }
    if (req.url === '/api/empty') { res.writeHead(204); res.end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ method: req.method, auth: req.headers.authorization, role: req.headers['x-active-role'], body: body ? JSON.parse(body) : null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const storage = new Map([['sme_token', 'test-token'], ['sme_active_role', 'CBTD']]);
  const window = new EventTarget(), module = { exports: {} }, timers = [];
  const code = ts.transpileModule(source.replace('import.meta.env.VITE_API_URL', JSON.stringify(base)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, fetch, Headers, FormData, Blob, Event, window,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    // Accelerate only the client deadline; HTTP requests use a real local server.
    AbortSignal: { timeout: ms => { timers.push(ms); return AbortSignal.timeout(Math.min(ms, 250)); }, any: signals => AbortSignal.any(signals) },
  });
  try { await run({ ...module.exports, storage, window, timers }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request remained pending; no client timeout')), 900); })]); }
  finally { clearTimeout(timer); }
}
await test('hanging request rejects with a timeout instead of remaining pending', () => fixture(async ({ api, ApiError, timers }) => {
  await assert.rejects(bounded(api.post('/hang', { username: 'test_cbtd' })), error => error instanceof ApiError && error.status === 408 && /quá lâu/.test(error.message));
  assert.equal(timers[0], 15000);
}));
await test('deadline also covers a response body that never finishes', () => fixture(async ({ api, ApiError }) => {
  await assert.rejects(bounded(api.get('/slow-body')), error => error instanceof ApiError && error.status === 408);
}));
await test('JSON and authentication headers are preserved', () => fixture(async ({ api }) => {
  assert.deepEqual(await api.post('/echo', { value: 42 }), { method: 'POST', auth: 'Bearer test-token', role: 'CBTD', body: { value: 42 } });
}));
await test('invalid login preserves the server message and existing session', () => fixture(async ({ api, ApiError, storage }) => {
  await assert.rejects(api.post('/auth/login', {}), error => error instanceof ApiError && error.status === 401 && /không chính xác/.test(error.message));
  assert.equal(storage.get('sme_token'), 'test-token');
}));
await test('expired session clears token and role and notifies the UI', () => fixture(async ({ api, storage, window }) => {
  let expired = 0; window.addEventListener('sme-session-expired', () => expired++);
  await assert.rejects(api.get('/expired'), error => error.status === 401);
  assert.equal(storage.has('sme_token'), false); assert.equal(storage.has('sme_active_role'), false); assert.equal(expired, 1);
}));
await test('network failures remain distinguishable from timeout', () => fixture(async ({ api, ApiError }) => {
  await assert.rejects(api.get('/disconnect'), error => error instanceof ApiError && error.status === 0 && /Không kết nối/.test(error.message));
}));
await test('file downloads and empty responses still work', () => fixture(async ({ api }) => {
  assert.equal(await (await api.download('/file')).text(), 'document-content');
  assert.equal(await api.delete('/empty'), undefined);
}));
