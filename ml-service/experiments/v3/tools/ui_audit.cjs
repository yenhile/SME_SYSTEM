/* Kiểm tra giao diện thật bằng Chrome headless qua giao thức DevTools (không cài thêm gì; dùng WebSocket có sẵn của Node 22).
 * Với từng tài khoản: đăng nhập qua form, mở từng mục menu, mở hồ sơ, mở các trang trong menu tài khoản; ghi lại lỗi console,
 * ngoại lệ chưa bắt, lời gọi API lỗi, chữ rác (undefined, NaN, [object, Invalid Date), banner lỗi, nút bị khóa; chụp ảnh từng màn.
 * Dùng: node ui_audit.cjs <thư mục ảnh> [tên_đăng_nhập:mật_khẩu ...]. Chỉ đọc dữ liệu (không bấm nút ghi), ngoại trừ đổi cỡ chữ trong Cài đặt.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const OUT = process.argv[2];
const ACCOUNTS = process.argv.slice(3).map(x => x.split(':'));
const BASE = process.env.UI_BASE || 'http://localhost:5173';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sme-ui-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=1440,1000', '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const list = await r.json(); const page = list.find(t => t.type === 'page'); if (page) return { proc, ws: page.webSocketDebuggerUrl }; } catch { /* chưa sẵn sàng */ }
    await sleep(200);
  }
  throw new Error('Chrome không khởi động');
}

class Cdp {
  constructor(url) { this.id = 0; this.pending = new Map(); this.handlers = []; this.ws = new WebSocket(url); }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
      else for (const h of this.handlers) h(msg);
    };
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  on(h) { this.handlers.push(h); }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  }
  async shot(file) { const r = await this.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); }
}

const BAD = /undefined|NaN|\[object|Invalid Date|\bnull\b/i;

async function main() {
  const { proc, ws } = await launch();
  const cdp = new Cdp(ws);
  await cdp.open();
  let issues = [];
  let current = '';
  cdp.on(msg => {
    if (msg.method === 'Runtime.exceptionThrown') issues.push({ where: current, kind: 'EXCEPTION', detail: (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).split('\n')[0] });
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error' && !/favicon/.test(msg.params.entry.url || '')) issues.push({ where: current, kind: 'CONSOLE', detail: `${msg.params.entry.text} ${msg.params.entry.url ?? ''}`.slice(0, 200) });
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') issues.push({ where: current, kind: 'CONSOLE', detail: msg.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200) });
    if (msg.method === 'Network.responseReceived' && /\/api\//.test(msg.params.response.url) && msg.params.response.status >= 400) issues.push({ where: current, kind: 'API', detail: `${msg.params.response.status} ${msg.params.response.url.replace(BASE, '')}` });
  });
  for (const d of ['Page', 'Runtime', 'Network', 'Log']) await cdp.send(`${d}.enable`);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const goto = async url => { await cdp.send('Page.navigate', { url }); await sleep(1200); };
  const waitFor = async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await cdp.eval(expr)) return true; await sleep(250); } return false; };
  const click = sel => cdp.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
  const clickText = (sel, text) => cdp.eval(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`);
  const pageFacts = () => cdp.eval(`(()=>{
    const text=document.body.innerText;
    const main=document.querySelector('main.main-content')?.innerText||'';
    const bad=[...main.matchAll(/.{0,30}(undefined|NaN|\\[object|Invalid Date|\\bnull\\b).{0,30}/gi)].map(m=>m[0].replace(/\\s+/g,' '));
    const alerts=[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText.trim()).filter(Boolean);
    const disabled=[...document.querySelectorAll('main.main-content button:disabled')].filter(b=>b.offsetParent).map(b=>(b.innerText||b.getAttribute('aria-label')||b.title||'').trim().slice(0,40)).filter(Boolean);
    const heading=(document.querySelector('main.main-content h2,main.main-content h1')||{}).innerText||'';
    const overflowX=document.documentElement.scrollWidth>document.documentElement.clientWidth+2;
    return {len:main.length,bad,alerts,disabled,heading,overflowX,loading:/Đang tải/.test(main)};
  })()`);

  const report = [];
  for (const [user, pass] of ACCOUNTS) {
    const log = { user, pages: [] };
    issues = []; current = `${user}/login`;
    await goto(BASE + '/');
    await cdp.eval('localStorage.clear();sessionStorage.clear();0');
    await goto(BASE + '/');
    await waitFor(`!!document.querySelector('input[autocomplete=username]')`);
    await cdp.eval(`(()=>{const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))};
      set(document.querySelector('input[autocomplete=username]'),${JSON.stringify(user)});set(document.querySelector('input[type=password]'),${JSON.stringify(pass)});
      document.querySelector('form button[type=submit]').click();0})()`);
    const ok = await waitFor(`!!document.querySelector('.account-trigger')`, 10000);
    if (!ok) { log.pages.push({ name: 'đăng nhập', error: 'không vào được hệ thống' }); await cdp.shot(path.join(OUT, `${user}-login-fail.png`)); report.push({ ...log, issues }); continue; }
    await sleep(1500);
    const identity = await cdp.eval(`document.querySelector('.account-trigger-text')?.innerText.replace(/\\n/g,' | ')`);
    log.identity = identity;

    const tabs = await cdp.eval(`[...document.querySelectorAll('.nav-tab-btn')].map(b=>({tab:b.dataset.tab,label:b.querySelector('span')?.innerText||b.innerText,disabled:b.disabled,locked:b.classList.contains('is-locked')}))`);
    log.menu = tabs.map(t => `${t.label}${t.disabled ? ' [chưa triển khai]' : t.locked ? ' [khóa quyền]' : ''}`);
    const snap = async (name, extra = {}) => {
      current = `${user}/${name}`;
      await sleep(900);
      const facts = await pageFacts();
      const file = `${user}-${name.replace(/[^a-z0-9]+/gi, '_')}.png`;
      await cdp.shot(path.join(OUT, file));
      log.pages.push({ name, ...facts, file, ...extra });
    };
    await snap('trang đầu');
    for (const t of tabs.filter(t => !t.disabled && !t.locked)) {
      current = `${user}/${t.label}`;
      await click(`.nav-tab-btn[data-tab="${t.tab}"]`);
      await sleep(1000);
      await snap(`menu ${t.label}`);
      // mở hồ sơ đầu tiên nếu có
      if (['loans', 'appraisal', 'dashboard'].includes(t.tab)) {
        const opened = await cdp.eval(`(()=>{const e=document.querySelector('main.main-content .lt-code, main.main-content tbody tr .btn-link, main.main-content table tbody tr td button');if(!e)return false;e.click();return true})()`);
        if (opened) {
          await sleep(1800);
          const modal = await cdp.eval(`!!document.querySelector('.modal-overlay')`);
          await snap(`hồ sơ từ ${t.label}`, { modal });
          // đóng modal hoặc quay lại danh sách
          await cdp.eval(`(()=>{const c=document.querySelector('.modal-overlay [aria-label=Đóng], .modal-overlay .btn-secondary');if(c){c.click();return}const b=[...document.querySelectorAll('main.main-content button')].find(x=>/Danh sách|Quay lại/.test(x.innerText));if(b)b.click()})()`);
          await sleep(700);
        }
      }
    }

    // ---- menu tài khoản ----
    for (const label of ['Hồ sơ', 'Cài đặt', 'Trợ giúp', 'Quyền riêng tư', 'Ngôn ngữ']) {
      current = `${user}/tài khoản/${label}`;
      await click('.account-trigger'); await sleep(400);
      const clicked = await clickText('.account-menu-item', label);
      if (!clicked) { log.pages.push({ name: `tài khoản: ${label}`, error: 'không thấy mục menu' }); continue; }
      await sleep(900);
      const isDialog = label === 'Ngôn ngữ';
      const facts = isDialog ? await cdp.eval(`({dialog:!!document.querySelector('.modal-overlay [role=dialog]'),text:(document.querySelector('.modal-overlay')||{}).innerText||''})`) : await pageFacts();
      await cdp.shot(path.join(OUT, `${user}-tk-${label.replace(/\s+/g, '_')}.png`));
      log.pages.push({ name: `tài khoản: ${label}`, ...(isDialog ? { dialog: facts.dialog, sample: facts.text.slice(0, 80) } : facts), separatePage: !isDialog });
      if (isDialog) await click('.modal-overlay [aria-label=Đóng]');
      else await clickText('button', 'Quay lại');
      await sleep(400);
    }
    // cỡ chữ: đổi, kiểm tra, trả lại
    await click('.account-trigger'); await sleep(300); await clickText('.account-menu-item', 'Cài đặt'); await sleep(600);
    await cdp.eval(`document.querySelectorAll('input[name=font-scale]')[2].click()`); await sleep(300);
    const big = await cdp.eval(`document.documentElement.style.fontSize`);
    await cdp.eval(`document.querySelectorAll('input[name=font-scale]')[0].click()`); await sleep(300);
    const back = await cdp.eval(`document.documentElement.style.fontSize`);
    log.fontScale = { afterLarge: big, afterReset: back };
    report.push({ ...log, issues: issues.slice() });
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  proc.kill();
  for (const r of report) {
    console.log(`\n=== ${r.user} (${r.identity ?? '?'}) ===`);
    console.log('menu:', (r.menu ?? []).join(' | '));
    for (const p of r.pages) {
      const flags = [];
      if (p.error) flags.push('LỖI: ' + p.error);
      if (p.bad?.length) flags.push('chữ rác: ' + p.bad.slice(0, 3).join(' ; '));
      if (p.alerts?.length) flags.push('banner: ' + p.alerts.join(' / ').slice(0, 120));
      if (p.overflowX) flags.push('tràn ngang');
      if (p.loading) flags.push('còn "Đang tải"');
      if (p.len === 0) flags.push('trang trống');
      console.log(` - ${p.name}${p.heading ? ` [${p.heading.replace(/\s+/g, ' ').slice(0, 40)}]` : ''}${p.modal ? ' (modal)' : ''}${p.separatePage ? ' (trang riêng)' : ''}${flags.length ? '  ⚠ ' + flags.join(' | ') : ''}${p.disabled?.length ? `  khóa: ${[...new Set(p.disabled)].slice(0, 6).join(', ')}` : ''}`);
    }
    console.log('cỡ chữ:', JSON.stringify(r.fontScale));
    const uniq = [...new Map(r.issues.map(i => [i.kind + i.detail + i.where, i])).values()];
    console.log(uniq.length ? 'sự cố:\n' + uniq.map(i => `   [${i.kind}] ${i.where}: ${i.detail}`).join('\n') : 'sự cố console/API: không');
  }
}
main().catch(e => { console.error('AUDIT FAIL', e); process.exit(1); });
