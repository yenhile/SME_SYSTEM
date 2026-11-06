import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const require = createRequire(path.join(root, 'frontend/package.json'));
const { build } = require('esbuild');
const output = path.join(folder, 'preview-build');
await build({ entryPoints: [path.join(folder, 'preview.tsx')], bundle: true, outdir: output, format: 'esm', platform: 'browser', jsx: 'automatic', nodePaths: [path.join(root, 'frontend/node_modules')], logLevel: 'silent' });
await writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Portal UI fixture - no API</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/preview.css"><div id="root"></div><script type="module" src="/preview.js"></script></html>');
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname;
    const file = name === '/preview.js' ? 'preview.js' : name === '/preview.css' ? 'preview.css' : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    res.end(await readFile(path.join(output, file)));
  } catch { res.statusCode = 500; res.end('fixture read failure'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const site = `http://127.0.0.1:${server.address().port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = { fixture: 'Presentation only, synthetic data. No API or database writes.', checks: [], screenshots: [], errors: [] };
const profile = path.join(folder, 'chrome-profile-' + Date.now());
let chrome, ws, send;
const check = (condition, label) => { result.checks.push({ label, pass: !!condition }); };
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 80; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
  throw Error('DOM not ready: ' + expression);
}
async function width(value) { await send('Emulation.setDeviceMetricsOverride', { width: value, height: 1000, deviceScaleFactor: 1, mobile: value < 600 }); await sleep(150); }
async function navigate(url) { await send('Page.navigate', { url }); await sleep(300); }
async function screenshot(name, full = false) {
  const metrics = full ? await send('Page.getLayoutMetrics') : null;
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}) });
  await writeFile(path.join(folder, name + '.png'), Buffer.from(r.data, 'base64'));
  result.screenshots.push(name + '.png');
}
const submit = `document.querySelector('button[aria-describedby="review-submit-help"]')`;
const clickText = async text => {
  const found = await evaluate(`(()=>{const n=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(text)});if(!n)return false;n.click();return true;})()`);
  assert.ok(found, 'Button exists: ' + text);
};
try {
  await mkdir(profile, { recursive: true });
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-gpu', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; chrome.stderr.on('data', d => { stderr += d; });
  const endpoint = await (async () => { for (let i = 0; i < 100; i++) { const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) return m[1]; if (chrome.exitCode !== null) throw Error('Chrome exited'); await sleep(100); } throw Error('Chrome startup timed out'); })();
  const targets = await (await fetch(endpoint.replace('ws:', 'http:').replace(/\/devtools\/browser\/.*/, '/json/list'))).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data); if (m.method === 'Runtime.exceptionThrown') result.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); const item = pending.get(m.id); if (item) { clearTimeout(item.timer); pending.delete(m.id); m.error ? item.reject(Error(m.error.message)) : item.resolve(m.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__uiWriteAttempts=0;const nativeFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{if(!['GET','HEAD'].includes(String(options.method||input?.method||'GET').toUpperCase())){window.__uiWriteAttempts++;return Promise.reject(Error('No business writes in UI verification'));}return nativeFetch(input,options);};` });
  for (const size of [1440, 375]) {
    await width(size); await navigate(site + '/?scenario=incomplete'); await wait('document.querySelector(".portal-review")');
    check(await evaluate('document.querySelectorAll(".review-section").length===4'), `${size}: four review groups`);
    check(await evaluate('document.querySelectorAll(".review-declaration input").length===1'), `${size}: one declaration`);
    check(await evaluate('!/[a-z]+[A-Z][a-zA-Z]*|representative\\.mode/.test(document.querySelector(".portal-review").innerText)'), `${size}: no raw technical fields in visible text`);
    check(await evaluate(`(${submit}).disabled`), `${size}: incomplete submit disabled`);
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${size}: no horizontal overflow`);
    check(await evaluate(`getComputedStyle(document.querySelector('.review-submit-card')).position===${JSON.stringify(size > 900 ? 'sticky' : 'static')}`), `${size}: responsive submit card`);
    check(await evaluate('document.querySelector(".review-section").open'), `${size}: incomplete section initially expanded`);
    await screenshot('review-incomplete-' + size, true);
    await evaluate(`document.querySelector('.review-needs button').click()`);
    check(await evaluate(`document.querySelector('#fixture-action').textContent.includes('jump:1:')`), `${size}: edit link points to originating step`);
    await evaluate(`document.querySelector('.review-full-answers > summary').click()`);
    check(await evaluate('document.querySelector(".review-full-answers").open'), `${size}: full answers expandable`);
    await evaluate(`document.querySelector('.review-submit-card').scrollIntoView({block:'start'})`); await sleep(150);
    await screenshot('review-actions-' + size);
  }
  await width(1440);
  for (const scenario of ['ready', 'dirty', 'stale', 'error', 'readonly', 'closed', 'files', 'legacy']) {
    await navigate(site + '/?scenario=' + scenario); await wait('document.querySelector(".portal-review")');
    const ready = scenario === 'ready';
    check(await evaluate(`(${submit}).disabled===${!ready}`), `${scenario}: preserves supplied submit guard`);
    check(await evaluate(`!!document.querySelector('.review-status-ready')===${ready}`), `${scenario}: honest readiness presentation`);
    if (ready) {
      await screenshot('review-ready', true);
      await evaluate(`(${submit}).click()`);
      check(await evaluate(`document.querySelector('#fixture-action').textContent.includes('submit-local-only')`), 'Ready: callback remains connected, fixture only');
      await evaluate(`document.querySelector('.review-declaration input').click()`);
      check(await evaluate(`(${submit}).disabled&&document.querySelector('#review-submit-help').textContent.includes('Lưu nháp')`), 'Declaration change: unsaved-state explanation');
    } else {
      await evaluate(`(${submit}).click()`);
      check(await evaluate(`!document.querySelector('#fixture-action').textContent.includes('submit-local-only')`), `${scenario}: disabled submit cannot invoke callback`);
    }
    if (scenario === 'readonly') check(await evaluate(`[...document.querySelectorAll('.review-edit,.review-submit-actions button,.review-declaration input')].every(n=>n.disabled)`), 'Readonly: mutation controls disabled, information retained');
    if (scenario === 'dirty') check(await evaluate(`document.querySelector('#review-submit-help').textContent.includes('Lưu nháp')`), 'Dirty: save guidance visible');
    if (scenario === 'legacy') check(await evaluate(`!document.querySelector('.portal-review').innerText.includes('annualRevenueBasis')`), 'Legacy: readiness fields translated in the shared review');
    if (['dirty', 'error', 'readonly'].includes(scenario)) await screenshot('review-' + scenario, true);
  }
  // Real anonymous application screens; never submit a form or create/reset an account.
  for (const size of [1440, 375]) {
    await width(size); await navigate('http://localhost:5173/portal'); await wait('document.querySelector(".portal-auth")');
    for (const [mode, action, title] of [['login', null, 'Đăng nhập doanh nghiệp'], ['register', 'Tạo tài khoản doanh nghiệp', 'Tạo tài khoản'], ['verify', 'Xác minh email', 'Xác minh email'], ['forgot', 'Quên mật khẩu?', 'Quên mật khẩu']]) {
      if (mode === 'forgot') { await clickText('Quay lại đăng nhập'); await sleep(100); }
      if (action) { await clickText(action); await sleep(150); }
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Live anonymous ${mode}/${size}: no horizontal overflow`);
      check(await evaluate(`document.querySelector('.portal-auth h2')?.textContent===${JSON.stringify(title)}`), `Live anonymous ${mode}/${size}: correct view title`);
      await screenshot('auth-' + mode + '-' + size, true);
    }
    await navigate('http://localhost:5173/portal?reset=ui-fixture-invalid-token'); await wait('document.querySelector(".portal-auth")');
    check(await evaluate(`document.querySelector('.portal-auth h2').textContent==='Đặt lại mật khẩu'`), `Live anonymous reset/${size}: reset view only, no submission`);
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Live anonymous reset/${size}: no horizontal overflow`);
    await screenshot('auth-reset-' + size, true);
    check(await evaluate('window.__uiWriteAttempts===0'), `Live anonymous ${size}: no mutation attempts`);
  }
  check(result.errors.length === 0, 'No browser runtime exceptions');
  await writeFile(path.join(folder, 'browser-results.json'), JSON.stringify(result, null, 2));
  const failed = result.checks.filter(c => !c.pass);
  console.log(JSON.stringify({ checks: result.checks.length, failed, screenshots: result.screenshots.length, errors: result.errors }, null, 2));
  assert.equal(failed.length, 0);
} finally {
  if (send) await send('Browser.close').catch(() => {});
  ws?.close(); chrome?.kill(); server.close(); await sleep(600);
  const owned = await realpath(profile).catch(() => null);
  const parent = await realpath(folder);
  if (owned && path.dirname(owned) === parent && path.basename(owned).startsWith('chrome-profile-')) await rm(owned, { recursive: true, force: true }).catch(() => {});
}
