import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptFolder = path.dirname(fileURLToPath(import.meta.url));
const logoOnly = process.argv.includes('--logo-only');
const folder = logoOnly ? path.join(scriptFolder, 'logo-only') : scriptFolder;
const root = path.resolve(scriptFolder, '../../..');
const site = 'http://localhost:5173';
const fixture = await readFile(path.join(root, 'backend/scripts/verify-local-running-system.cjs'), 'utf8');
const password = fixture.match(/const STAFF_PASSWORD\s*=\s*['"]([^'"]+)['"]/)[1];
const profile = path.join(folder, 'chrome-profile-' + Date.now());
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = { checks: [], views: [], screenshots: [], errors: [] };
let chrome, ws, send;
function check(condition, label) { result.checks.push({ label, pass: Boolean(condition) }); }
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
  throw Error('DOM not ready: ' + expression);
}
async function width(value) { await send('Emulation.setDeviceMetricsOverride', { width: value, height: 1000, deviceScaleFactor: 1, mobile: value < 600 }); await sleep(150); }
async function navigate(url) { await send('Page.navigate', { url }); await sleep(350); }
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(folder, name + '.png'), Buffer.from(shot.data, 'base64'));
  result.screenshots.push(name + '.png');
}
async function appearance() {
  return evaluate(`(()=>{const style=s=>{const n=document.querySelector(s);if(!n)return null;const c=getComputedStyle(n);return {color:c.color,background:c.backgroundColor,border:c.borderColor,radius:c.borderRadius,width:c.width,height:c.height,fontSize:c.fontSize,fontWeight:c.fontWeight};};return {logo:style('.sme-brand-icon'),title:style('.sme-brand-text strong'),subtitle:style('.sme-brand-text small'),svg:document.querySelector('.sme-brand-icon svg')?.outerHTML,button:style('.btn-primary'),active:style('[data-tab][aria-current=page]'),surface:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+2}})()`);
}
async function hover(selector) {
  const rect = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!rect) return null;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rect }); await sleep(250);
  return evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor`);
}
try {
  await mkdir(folder, { recursive: true });
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-gpu', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; chrome.stderr.on('data', data => { stderr += data; });
  const endpoint = await (async () => {
    for (let i = 0; i < 100; i++) { const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) return m[1]; if (chrome.exitCode !== null) throw Error('Chrome exited'); await sleep(100); }
    throw Error('Chrome debugger startup timed out');
  })();
  const targets = await (await fetch(endpoint.replace('ws:', 'http:').replace(/\/devtools\/browser\/.*/, '/json/list'))).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); const item = pending.get(message.id); if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const originalFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{if(!['GET','HEAD'].includes(String(options.method||input?.method||'GET').toUpperCase()))return Promise.reject(new Error('Business writes disabled during branding review'));return originalFetch(input,options);};` });
  await width(1440); await navigate(site + '/portal'); await wait('document.querySelector(".sme-brand-icon")');
  const reference = result.portalReference = await appearance();
  check(reference.button.background === 'rgb(15, 23, 42)', 'Portal reference primary is navy');
  result.portalHover = await hover('.portal-auth .btn-primary');
  check(result.portalHover === 'rgb(30, 41, 59)', 'Portal hover reference');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }); await sleep(250);
  await screenshot('01-portal-desktop'); await width(375); await screenshot('02-portal-mobile');
  for (const size of [1440, 375]) {
    await width(size); await navigate(site + '/'); await wait('document.querySelector(".login-card .sme-brand")');
    const style = await appearance();
    if (logoOnly) check(await evaluate(`document.querySelector('.sme-brand').textContent.trim()==='SME'&&!document.querySelector('.sme-brand small')&&document.querySelector('.sme-brand').getAttribute('aria-label')==='SME'`), `Staff login has no subtitle at ${size}px`);
    check(JSON.stringify(style.logo) === JSON.stringify(reference.logo) && style.svg === reference.svg, `Staff login logo matches Portal at ${size}px`);
    check(style.button.background === reference.button.background, `Staff login primary matches Portal at ${size}px`);
    check(!style.overflow, `Staff login fits ${size}px`);
    await screenshot('03-staff-login-' + size);
  }
  const roles = [['ADMIN', 'test_admin'], ['CBTD', 'test_cbtd'], ['THAM_QUYEN', 'test_tham_quyen'], ['QUAN_LY', 'test_quan_ly']];
  for (const [role, username] of roles) {
    const response = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(8000) });
    assert.ok(response.ok, role + ' synthetic login'); const auth = await response.json();
    await evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('sme_token',${JSON.stringify(auth.accessToken)});localStorage.setItem('sme_active_role',${JSON.stringify(role)});`);
    await width(1440); await navigate(site + '/'); await wait('document.querySelector(".sidebar .sme-brand")');
    const tabs = await evaluate(`[...document.querySelectorAll('[data-tab]:not(:disabled)')].map(n=>n.dataset.tab)`);
    for (const tab of logoOnly ? tabs.slice(0, 1) : tabs) {
      await width(1440); await evaluate(`document.querySelector('[data-tab=${tab}]').click()`); await sleep(400);
      for (const size of [1440, 375]) {
        await width(size); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }); await sleep(250);
        const style = await appearance(); result.views.push({ role, tab, width: size, style });
        if (logoOnly) check(await evaluate(`document.querySelector('.sidebar .sme-brand').textContent.trim()==='SME'&&!document.querySelector('.sidebar .sme-brand small')&&document.querySelector('.sidebar .sme-brand').getAttribute('aria-label')==='SME'`), `${role}/${size}: logo has no bank subtitle`);
        check(JSON.stringify(style.logo) === JSON.stringify(reference.logo) && style.svg === reference.svg, `${role}/${tab}/${size}: shared logo matches Portal`);
        check(style.title.color === reference.title.color && style.title.fontSize === reference.title.fontSize, `${role}/${tab}/${size}: brand wordmark matches Portal`);
        check(style.active.color === 'rgb(30, 64, 175)' && style.active.background === 'rgb(239, 246, 255)', `${role}/${tab}/${size}: blue navigation matches Portal palette`);
        if (style.button) check(style.button.background === reference.button.background, `${role}/${tab}/${size}: primary button matches Portal`);
        check(style.surface === 'rgb(248, 250, 252)', `${role}/${tab}/${size}: background matches Portal palette`);
        check(!style.overflow, `${role}/${tab}/${size}: no document horizontal overflow`);
        if (size === 1440 || tab === tabs[0]) await screenshot('04-' + role.toLowerCase() + '-' + tab + '-' + size);
      }
    }
    await width(1440); await evaluate(`document.querySelector('[data-tab=${tabs.find(tab=>tab==='companies'||tab==='settings')??tabs[0]}]').click()`); await sleep(400);
    const hoverColor = await hover('.main-content .btn-primary');
    if (hoverColor) check(hoverColor === result.portalHover, role + ': primary hover matches Portal');
    await evaluate(`document.querySelector('.main-content input')?.focus()`);
    await sleep(250);
    const focus = await evaluate(`(()=>{const n=document.querySelector('.main-content input');return n?getComputedStyle(n).borderColor:null;})()`);
    if (focus) check(focus === 'rgb(30, 64, 175)', role + ': focus uses Portal accent');
    await evaluate(`document.querySelector('.account-trigger').click()`); await sleep(200);
    const avatar = await evaluate(`(()=>{const c=getComputedStyle(document.querySelector('.account-avatar'));return {background:c.backgroundColor,color:c.color};})()`);
    check(avatar.background === 'rgb(239, 246, 255)' && avatar.color === 'rgb(30, 64, 175)', role + ': account accent is blue');
    await screenshot('05-' + role.toLowerCase() + '-account');
  }
  check(result.errors.length === 0, 'No browser runtime exceptions');
  if (result.checks.some(item=>!item.pass)) process.exitCode = 1;
} catch (error) { result.error = error.message; process.exitCode = 1; }
finally {
  if (send && ws?.readyState === WebSocket.OPEN) await evaluate('localStorage.clear();sessionStorage.clear()').catch(()=>{});
  ws?.close(); chrome?.kill(); await sleep(500);
  const resolved = await realpath(profile).catch(()=>null);
  if (resolved && path.dirname(resolved).toLowerCase() === (await realpath(folder)).toLowerCase() && path.basename(resolved).startsWith('chrome-profile-')) await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(()=>{});
  await writeFile(path.join(folder, 'branding.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks: result.checks.length, failures: result.checks.filter(c=>!c.pass), views: result.views.length, screenshots: result.screenshots.length, runtimeErrors: result.errors, error: result.error }));
}
