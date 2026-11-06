import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const site = 'http://localhost:5173';
const apiBase = 'http://localhost:3000/api';
const fixture = await readFile(path.join(root, 'backend/scripts/verify-local-running-system.cjs'), 'utf8');
function fixtureValue(key) {
  const match = fixture.match(new RegExp(`const ${key}\\s*=\\s*['"]([^'"]+)['"]`));
  assert.ok(match, 'Known synthetic fixture constant is available: ' + key);
  return match[1];
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = { scope: 'Live UI, existing synthetic accounts, read-only business data', checks: [], observations: [], screenshots: [], api: [], actors: {}, runtimeErrors: [] };
let chrome, ws, send;
const profile = path.join(folder, 'chrome-profile-' + Date.now());
function check(value, label) { result.checks.push({ label, pass: Boolean(value) }); }
async function api(endpoint, token, role) {
  const response = await fetch(apiBase + endpoint, { headers: { Authorization: `Bearer ${token}`, 'X-Active-Role': role }, signal: AbortSignal.timeout(8000) });
  result.api.push({ endpoint: endpoint.replace(/[a-f0-9-]{36}/g, ':id'), role, status: response.status });
  if (!response.ok) return null;
  return response.json();
}
async function login(role, username) {
  const response = await fetch(apiBase + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: fixtureValue('STAFF_PASSWORD') }), signal: AbortSignal.timeout(8000) });
  assert.ok(response.ok, 'Synthetic staff sign-in: ' + role);
  const data = await response.json();
  assert.ok(data.user.roles.includes(role));
  return data.accessToken;
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
  throw Error('DOM not ready: ' + expression);
}
async function navigate(url) { await send('Page.navigate', { url }); await sleep(400); }
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(folder, name + '.png'), Buffer.from(shot.data, 'base64'));
  result.screenshots.push(name + '.png');
}
async function clickTab(tab) {
  await evaluate(`document.querySelector('button[data-tab="${tab}"]').click()`);
  await sleep(450);
}
async function snapshot() {
  return evaluate(`({heading:document.querySelector('main h2')?.textContent?.trim(),alerts:[...document.querySelectorAll('[role=alert]')].map(n=>n.textContent.trim()),kanban:[...document.querySelectorAll('.kanban-col-header h3')].map(n=>n.textContent.trim()),filters:[...document.querySelectorAll('option')].filter(n=>['CAP_TREN','WAITING_HEAD_OFFICE'].includes(n.value)).map(n=>({value:n.value,label:n.textContent.trim()}))})`);
}
try {
  await mkdir(folder, { recursive: true });
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-gpu', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', data => { stderr += data; });
  const endpoint = await (async () => {
    for (let i = 0; i < 100; i++) {
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) return match[1];
      if (chrome.exitCode !== null) throw Error('Chrome exited before debugger was ready');
      await sleep(100);
    }
    throw Error('Chrome debugger startup timed out');
  })();
  const targets = await (await fetch(endpoint.replace('ws:', 'http:').replace(/\/devtools\/browser\/.*/, '/json/list'))).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') result.runtimeErrors.push(message.params.exceptionDetails.text);
    const item = pending.get(message.id);
    if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); }
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const originalFetch=window.fetch.bind(window);window.__blockedWrites=[];window.fetch=(input,options={})=>{const method=String(options.method||input?.method||'GET').toUpperCase();if(!['GET','HEAD'].includes(method)){window.__blockedWrites.push(method);return Promise.reject(new Error('Business writes disabled during UI review'));}return originalFetch(input,options);};` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate(site + '/'); await wait('document.querySelector(".login-card")'); await screenshot('01-staff-login');
  const expected = { ADMIN: ['users', 'settings'], CBTD: ['companies', 'loans'], THAM_QUYEN: ['dashboard', 'companies', 'loans', 'appraisal'], QUAN_LY: ['dashboard', 'companies', 'loans', 'appraisal', 'assignments'] };
  for (const [role, username] of [['ADMIN', 'test_admin'], ['CBTD', 'test_cbtd'], ['THAM_QUYEN', 'test_tham_quyen'], ['QUAN_LY', 'test_quan_ly']]) {
    const token = await login(role, username);
    await evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('sme_token',${JSON.stringify(token)});localStorage.setItem('sme_active_role',${JSON.stringify(role)});`);
    await navigate(site + '/'); await wait('document.querySelector(".account-trigger")');
    const menus = await evaluate(`({enabled:[...document.querySelectorAll('[data-tab]')].filter(n=>!n.disabled).map(n=>n.dataset.tab),disabled:[...document.querySelectorAll('[data-tab]')].filter(n=>n.disabled).map(n=>n.dataset.tab)})`);
    check(JSON.stringify([...menus.enabled].sort()) === JSON.stringify([...expected[role]].sort()), role + ' menu matches role matrix');
    const actor = result.actors[role] = { menus, views: {} };
    for (const tab of menus.enabled) {
      await clickTab(tab);
      actor.views[tab] = await snapshot();
      if (tab === 'settings') {
        await wait('document.querySelector(".sla-row")');
        const names = await evaluate(`[...document.querySelectorAll('.sla-row input[type=text],.sla-row label:first-child input')].map(n=>n.value)`);
        actor.slaRows = names;
        check(names.length === 3 && !names.some(name => /cấp trên|hội đồng/i.test(name)), 'Admin SLA view contains three current stages, no head-office stage');
        const serverStages = await api('/admin/workflow-stages', token, role);
        actor.apiStillContainsLegacyStage = serverStages?.some(stage => stage.stageCode === 'CAP_TREN');
        await screenshot('02-admin-sla-desktop');
        await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
        actor.mobileOverflow = await evaluate('document.documentElement.scrollWidth>innerWidth+2');
        await screenshot('03-admin-sla-mobile');
        await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      }
      if (tab === 'users') {
        await evaluate(`[...document.querySelectorAll('button')].find(n=>n.textContent.includes('Tạo mới liên hệ')).click()`);
        actor.grantRoles = await evaluate(`[...document.querySelectorAll('.modal-content fieldset label')].map(n=>n.textContent.trim())`);
        check(actor.grantRoles.length === 4, 'Admin grants only the four internal roles');
        await screenshot('04-admin-account-roles');
        await evaluate(`[...document.querySelectorAll('.modal-content button')].find(n=>n.textContent==='Đóng').click()`);
      }
      if (tab === 'dashboard') {
        actor.coordinationButton = await evaluate(`[...document.querySelectorAll('button')].some(n=>n.textContent.includes('Điều phối cán bộ'))`);
        if (role === 'THAM_QUYEN' && actor.coordinationButton) {
          await evaluate(`[...document.querySelectorAll('button')].find(n=>n.textContent.includes('Điều phối cán bộ')).click()`);
          actor.coordinationDestination = await evaluate(`document.querySelector('button[aria-current=page]')?.dataset.tab`);
          result.observations.push('Tham quyen sees coordination button but navigation returns to dashboard');
          await screenshot('05-approver-dashboard');
        }
      }
      if (tab === 'loans') {
        await screenshot('06-' + role.toLowerCase() + '-loans');
        actor.hasIntakeTab = await evaluate(`!!document.querySelector('.portal-tabs')`);
        if (actor.hasIntakeTab) {
          await evaluate(`[...document.querySelectorAll('.portal-tabs button')].find(n=>n.textContent.includes('Chờ tiếp nhận')).click()`);
          await wait('document.querySelector(".portal-intake")');
          actor.intake = await snapshot();
          await screenshot('07-' + role.toLowerCase() + '-intake');
        }
        const loans = await api('/loan-applications', token, role);
        const currentLoan = loans?.find(loan => loan.businessPolicyVersion && loan.currentStage !== 'HOAN_TAT');
        actor.currentPolicyLoanAvailable = Boolean(currentLoan);
        const selectedLoan = currentLoan ?? loans?.find(loan => loan.currentStage === (role === 'THAM_QUYEN' ? 'THAM_DINH' : 'TIEP_NHAN'));
        if (selectedLoan) {
          actor.detailDataPolicy = selectedLoan.businessPolicyVersion ? 'current' : 'legacy';
          await clickTab('loans');
          await evaluate(`document.querySelector('.portal-tabs button')?.click()`);
          await evaluate(`[...document.querySelectorAll('.kanban-card,tbody tr')].find(n=>n.textContent.includes(${JSON.stringify(selectedLoan.applicationCode)}))?.click()`);
          await sleep(500);
          const progress = await evaluate(`[...document.querySelectorAll('.workflow-progress-bar h4')].map(n=>n.textContent)`);
          actor.loanProgress = progress;
          if (progress.length) {
            if (currentLoan) check(progress.length === 3 && !progress.some(text=>/Cấp trên/.test(text)), role + ' current-policy loan shows three stages');
            await screenshot('08-' + role.toLowerCase() + '-loan-detail');
            await evaluate(`[...document.querySelectorAll('.modal-content button')].find(n=>n.textContent.includes('Yêu cầu bổ sung'))?.click()`);
            await sleep(250);
            actor.supplementButtons = await evaluate(`[...document.querySelectorAll('.modal-content button')].map(n=>n.textContent.trim()).filter(text=>/bổ sung|Yêu cầu làm rõ|Phê duyệt|Từ chối/i.test(text))`);
            await screenshot('08b-' + role.toLowerCase() + '-supplements');
          }
          await navigate(site + '/'); await wait('document.querySelector(".account-trigger")');
        }
      }
    }
    check((await evaluate('window.__blockedWrites.length')) === 0, role + ' review made no business write attempts');
  }
  await navigate(site + '/portal'); await wait('document.querySelector(".portal-auth")');
  await screenshot('09-enterprise-login');
  const authViews = [];
  for (const [name, buttonText] of [['register', 'Tạo tài khoản doanh nghiệp'], ['verify', 'Xác minh email'], ['forgot', 'Quên mật khẩu?']]) {
    await navigate(site + '/portal'); await wait('document.querySelector(".portal-auth")');
    await evaluate(`[...document.querySelectorAll('.portal-auth button')].find(n=>n.textContent.trim()===${JSON.stringify(buttonText)}).click()`);
    authViews.push(await evaluate(`({mode:${JSON.stringify(name)},title:document.querySelector('.portal-auth h2')?.textContent,inputs:[...document.querySelectorAll('.portal-auth input')].map(n=>n.type)})`));
    await screenshot('13-enterprise-' + name);
  }
  await navigate(site + '/portal?reset=ui-review-invalid-token'); await wait('document.querySelector(".portal-auth input[type=password]")');
  authViews.push(await evaluate(`({mode:'reset',title:document.querySelector('.portal-auth h2')?.textContent})`));
  await screenshot('14-enterprise-reset');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await navigate(site + '/portal'); await wait('document.querySelector(".portal-auth")');
  await screenshot('15-enterprise-login-mobile');
  const loginOverflow = await evaluate('document.documentElement.scrollWidth>innerWidth+2');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const skipLogin = process.argv.includes('--skip-enterprise-login');
  const response = skipLogin ? {status:401,ok:false} : await fetch(apiBase + '/portal/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fixtureValue('SYNTHETIC_DN_EMAIL'), password: fixtureValue('DN_PASSWORD') }), signal: AbortSignal.timeout(8000) });
  result.actors.ENTERPRISE = { loginStatus: response.status, skippedKnownFailedLogin:skipLogin, authViews, loginOverflow };
  if (response.ok) {
    const data = await response.json();
    await evaluate(`localStorage.setItem('sme_portal_token',${JSON.stringify(data.accessToken)});sessionStorage.clear();`);
    await navigate(site + '/portal'); await sleep(700);
    result.actors.ENTERPRISE.signedIn = await evaluate('!!document.querySelector(".portal-account-box")');
    await screenshot('10-enterprise-list');
    const row = await evaluate(`Boolean(document.querySelector('.portal-request-row'))`);
    if (row) { await evaluate(`document.querySelector('.portal-request-row').click()`); await sleep(650); await screenshot('11-enterprise-detail'); result.actors.ENTERPRISE.stepCount = await evaluate(`document.querySelectorAll('.v2-stepper li').length`); }
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    await screenshot('12-enterprise-mobile');
    result.actors.ENTERPRISE.mobileOverflow = await evaluate('document.documentElement.scrollWidth>innerWidth+2');
    check((await evaluate('window.__blockedWrites.length')) === 0, 'Enterprise review made no business write attempts');
  }
  check(result.runtimeErrors.length === 0, 'No browser runtime exceptions');
} catch (error) { result.error = error.message; process.exitCode = 1; }
finally {
  if (send && ws?.readyState === WebSocket.OPEN) await evaluate('localStorage.clear();sessionStorage.clear()').catch(()=>{});
  ws?.close();
  chrome?.kill();
  await writeFile(path.join(folder, 'live-ui.json'), JSON.stringify(result, null, 2));
  await sleep(500);
  const resolved = await realpath(profile).catch(()=>null);
  if (resolved && path.dirname(resolved).toLowerCase() === (await realpath(folder)).toLowerCase() && path.basename(resolved).startsWith('chrome-profile-')) await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(()=>{});
  console.log(JSON.stringify({ checks: result.checks, actors: Object.keys(result.actors), screenshots: result.screenshots.length, observations: result.observations, error: result.error }));
}
