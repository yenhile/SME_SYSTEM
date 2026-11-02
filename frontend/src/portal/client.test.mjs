import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
async function fixture(run) {
  const requests = [];
  let release, started;
  const deferred = new Promise(resolve => { release = resolve; });
  const deferredStarted = new Promise(resolve => { started = resolve; });
  const server = http.createServer(async (req, res) => {
    requests.push(req.url);
    if (req.url.endsWith('/deferredBody')) { res.writeHead(200,{'Content-Type':'application/json'});res.write('{"private":');started();await deferred;res.end('true}');return; }
    if (req.url.endsWith('/deferred') || req.url.endsWith('/deferred401')) { started(); await deferred; }
    if (req.url.endsWith('/conflict')) { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Bản nháp đã thay đổi' })); return; }
    if (req.url.endsWith('/slow')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    if (req.url.endsWith('/auth/me') || req.url.endsWith('/auth/login') || req.url.endsWith('/deferred401')) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Phiên không hợp lệ' })); return; }
    let body = ''; for await (const part of req) body += part;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authorization: req.headers.authorization, role: req.headers['x-active-role'] ?? null, body: body ? JSON.parse(body) : null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const storage = new Map([['sme_token', 'internal'], ['sme_active_role', 'CBTD'], ['sme_portal_token', 'enterprise']]);
  const window = new EventTarget(); const module = { exports: {} };
  const code = ts.transpileModule(source.replace('import.meta.env.VITE_API_URL', JSON.stringify(base)), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, fetch, Headers, FormData, Event, window, AbortSignal: { timeout: () => AbortSignal.timeout(100) }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  try { await run({ ...module.exports, storage, window, requests, release, deferredStarted }); } finally { release(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('portal requests use enterprise token and never send internal role', () => fixture(async ({ portalApi }) => {
  const data = await portalApi.post('/requests', { data: { companyName: 'Test' } });
  assert.equal(data.authorization, 'Bearer enterprise'); assert.equal(data.role, null); assert.equal(data.body.data.companyName, 'Test');
}));
test('expired portal session removes only portal token and notifies UI', () => fixture(async ({ portalApi, storage, window }) => {
  let expired = 0; window.addEventListener('sme-portal-session-expired', () => expired++);
  await assert.rejects(portalApi.get('/auth/me'));
  assert.equal(storage.has('sme_portal_token'), false); assert.equal(storage.get('sme_token'), 'internal'); assert.equal(storage.get('sme_active_role'), 'CBTD'); assert.equal(expired, 1);
}));
test('incorrect login preserves sessions', () => fixture(async ({ portalApi, storage }) => {
  await assert.rejects(portalApi.post('/auth/login', {})); assert.equal(storage.get('sme_portal_token'), 'enterprise'); assert.equal(storage.get('sme_token'), 'internal');
}));
test('timeout also covers a stalled response body and reports friendly message', () => fixture(async ({ portalApi }) => {
  await assert.rejects(portalApi.get('/slow'), error => /quá lâu/.test(error.message));
}));
test('revision conflict preserves HTTP status for recovery', () => fixture(async ({ portalApi, PortalApiError }) => {
  await assert.rejects(portalApi.put('/conflict', { expectedRevision: 1 }), error => error instanceof PortalApiError && error.status === 409 && error.message === 'Bản nháp đã thay đổi');
}));
test('delete sends optional revision body and legacy deletion stays bodyless', () => fixture(async ({ portalApi }) => {
  assert.deepEqual((await portalApi.delete('/documents/one', { expectedRevision: 2 })).body, { expectedRevision: 2 });
  assert.equal((await portalApi.delete('/documents/one')).body, null);
}));

test('a different account in storage cannot receive a draft from the current tab', () => fixture(async ({ portalApi, storage, requests, window }) => {
  let changed=0;window.addEventListener('sme-portal-session-changed',()=>changed++);
  storage.set('sme_portal_token','account-B');
  await assert.rejects(portalApi.post('/requests',{data:{companyName:'Private account A'}}),e=>e.code==='PORTAL_SESSION_CHANGED');
  assert.equal(requests.length,0);assert.equal(storage.get('sme_portal_token'),'account-B');assert.equal(changed,1);
}));

test('a late successful response is discarded after another tab changes account', () => fixture(async ({ portalApi, storage, deferredStarted, release }) => {
  const pending=portalApi.get('/deferred');await deferredStarted;
  storage.set('sme_portal_token','account-B');release();
  await assert.rejects(pending,e=>e.code==='PORTAL_SESSION_CHANGED');
  assert.equal(storage.get('sme_portal_token'),'account-B');
}));

test('a late 401 for account A never clears the new session of account B', () => fixture(async ({ portalApi, storage, deferredStarted, release, window }) => {
  let expired=0;window.addEventListener('sme-portal-session-expired',()=>expired++);
  const pending=portalApi.get('/deferred401');await deferredStarted;
  storage.set('sme_portal_token','account-B');release();
  await assert.rejects(pending);assert.equal(storage.get('sme_portal_token'),'account-B');assert.equal(expired,0);
}));

test('logout from a stale tab preserves the newer token written by another tab', () => fixture(async ({ setPortalToken, storage }) => {
  storage.set('sme_portal_token','account-B');setPortalToken(null);
  assert.equal(storage.get('sme_portal_token'),'account-B');assert.equal(storage.get('sme_token'),'internal');
}));

test('session changes while reading a response body discard its contents',()=>fixture(async({portalApi,storage,deferredStarted,release})=>{
  const pending=portalApi.get('/deferredBody');await deferredStarted;storage.set('sme_portal_token','account-B');release();
  await assert.rejects(pending,e=>e.code==='PORTAL_SESSION_CHANGED');assert.equal(storage.get('sme_portal_token'),'account-B');
}));

test('logout and login with the same token still invalidates earlier requests',()=>fixture(async({portalApi,setPortalToken,deferredStarted,release})=>{
  const pending=portalApi.get('/deferred');await deferredStarted;setPortalToken(null);setPortalToken('enterprise');release();
  await assert.rejects(pending,e=>e.code==='PORTAL_SESSION_CHANGED');
}));
