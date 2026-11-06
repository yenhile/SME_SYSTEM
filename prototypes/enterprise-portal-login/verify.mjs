import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
// Fail before starting any process when the prototype has not been implemented.
await assert.doesNotReject(readFile(path.join(dist, 'index.html')), 'Prototype entry point must exist');
const evidence = path.join(root, 'evidence');
await mkdir(evidence, { recursive: true });
const profile = path.join(evidence, 'chrome-profile-' + Date.now());
const requests = [], exceptions = [], checks = [];
let chrome, ws, server, chromeStderr = '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (condition, message) => { assert.ok(condition, message); checks.push(message); };
try {
  server = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const files = { '/': 'index.html', '/styles.css': 'styles.css', '/app.js': 'app.js' };
    const file = files[name];
    if (!file) { res.writeHead(404); res.end(); return; }
    try {
      const body = await readFile(path.join(dist, file));
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      res.end(body);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-gpu', '--disable-software-rasterizer',
    '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', chunk => { stderr += chunk; chromeStderr += chunk; });
  const browserUrl = await (async () => {
    for (let i = 0; i < 150; i++) {
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) return match[1];
      if (chrome.exitCode !== null) throw Error('Chrome exited: ' + stderr.slice(-800));
      await sleep(100);
    }
    throw Error('Chrome debugging endpoint not ready');
  })();
  const targets = await (await fetch(browserUrl.replace('ws:', 'http:').replace(/\/devtools\/browser\/.*/, '/json/list'))).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    const item = pending.get(message.id);
    if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await sleep(50); }
    throw Error('DOM condition not met: ' + expression);
  };
  const screenshot = async name => {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(evidence, name + '.png'), Buffer.from(image.data, 'base64'));
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: origin });
  await wait("document.querySelector('#login-form') && document.readyState === 'complete'");
  for (const width of [1440, 390, 1280, 375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width > 600 ? 1000 : 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate('window.scrollTo(0,0)');
    await sleep(80);
    check(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `No horizontal overflow at ${width}px`);
    check(await evaluate("!document.querySelector('h1').innerText.includes('ràngcho')"), `Headline preserves word spacing at ${width}px`);
    check(await evaluate("!!document.querySelector('label[for=email]') && !!document.querySelector('label[for=password]')"), `Named email and password fields at ${width}px`);
    if (width === 1440 || width === 390) await screenshot(width === 1440 ? 'desktop-default' : 'mobile-default');
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: false });
  await click('[data-preview=error]');
  check(await evaluate("!document.querySelector('#form-error').hidden && document.querySelector('#email').getAttribute('aria-invalid')==='true'"), 'Error state has accessible message and invalid input');
  await screenshot('mobile-error');
  await click('[data-preview=loading]');
  check(await evaluate("document.querySelector('#login-form').getAttribute('aria-busy')==='true' && document.querySelector('#submit').disabled && document.querySelector('#email').disabled"), 'Loading state prevents duplicate actions and input edits');
  await screenshot('mobile-loading');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await screenshot('desktop-loading');
  await click('[data-preview=error]'); await screenshot('desktop-error');
  await click('[data-preview=default]');
  await click('#submit');
  check(await evaluate("document.activeElement.id==='email' && !document.querySelector('#email-error').hidden"), 'Empty submit focuses required email');
  await fill('#email', 'not-an-email'); await click('#submit');
  check(await evaluate("document.querySelector('#email-error').textContent.includes('định dạng')"), 'Invalid email is explained inline');
  await fill('#email', 'minhhoa@example.test'); await click('#submit');
  check(await evaluate("document.activeElement.id==='password' && !document.querySelector('#password-error').hidden"), 'Missing password focuses password');
  await fill('#password', 'GiaLap123');
  await click('#toggle-password');
  check(await evaluate("document.querySelector('#password').type==='text' && document.querySelector('#toggle-password').getAttribute('aria-pressed')==='true'"), 'Password visibility toggle updates accessible state');
  await click('#toggle-password'); await click('#submit');
  check(await evaluate("document.querySelector('#submit').disabled"), 'Valid local submission enters loading');
  await wait("!document.querySelector('#submit').disabled");
  check(await evaluate("document.querySelector('#notice').textContent.includes('không tạo phiên') && document.querySelector('#password').value === ''"), 'Simulation completes without a session and clears password');
  for (const selector of ['#forgot', '#register', '#verify']) {
    await click(selector);
    check(await evaluate("!document.querySelector('#notice').hidden && document.querySelector('#notice').textContent.includes('giai đoạn sau')"), `Future flow ${selector} is explicitly simulated`);
  }
  await click('[data-preview=default]');
  await evaluate("document.querySelector('#email').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  check(await evaluate("document.activeElement.id==='forgot'"), 'Keyboard navigation reaches forgot password');
  const nonLocal = requests.filter(url => !url.startsWith(origin) && !url.startsWith('data:'));
  check(nonLocal.length === 0, 'No requests outside the isolated prototype origin');
  check(requests.every(url => !new URL(url).pathname.startsWith('/api')), 'No API requests');
  check(await evaluate('localStorage.length===0 && sessionStorage.length===0'), 'No local or session storage written');
  check(exceptions.length === 0, 'No uncaught browser exceptions');
  await writeFile(path.join(evidence, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, requests, exceptions, scope: 'Isolated login prototype only; no SME API or database access' }, null, 2));
  console.log(`PASS ${checks.length} browser checks; evidence: ${evidence}`);
} catch (error) {
  console.error('Chrome diagnostics:', chromeStderr.slice(-3500));
  throw error;
} finally {
  ws?.close(); chrome?.kill(); server?.close();
}
