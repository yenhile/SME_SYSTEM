// Real Chrome CDP browser verification for R6 Role Governance & Session Safety
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(frontend.replace(/[\\/]$/, ''));
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { startIsolated } = require('./scripts/check-portal-v2-intake.cjs');
const bcrypt = require('bcryptjs');

const site = 'http://localhost:5174';
let h, vite, chrome, page, profile;
let checks = 0;
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evidence = path.join(root, 'evidence', 'reviews', 'integration');
const check = (v, m) => { assert.ok(v, m); checks++; };

function connection(url) {
  const ws = new WebSocket(url);
  let sequence = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      clearTimeout(p.timer);
      msg.error ? p.reject(Error(msg.error.message)) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  });
  return {
    ready,
    close: () => ws.close(),
    send: async (method, params = {}) => {
      await ready;
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(Error('CDP timeout ' + method));
        }, 20000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(expression, targetPage = page) {
  const r = await targetPage.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

async function wait(expression, label = expression, targetPage = page) {
  for (let i = 0; i < 160; i++) {
    if (await evaluate(`Boolean(${expression})`, targetPage)) return;
    await sleep(100);
  }
  throw Error(`Browser timeout ${label}; ` + (await evaluate('document.body.innerText.slice(-1800)', targetPage)));
}

async function click(text, selector = 'button', targetPage = page) {
  await wait(
    `[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length&&!e.disabled)`,
    'enabled button ' + text,
    targetPage
  );
  await evaluate(
    `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)}&&x.getClientRects().length);if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(text)});e.click();})()`,
    targetPage
  );
}

async function input(selector, value, targetPage = page) {
  await wait(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&(e.tagName!=='SELECT'||[...e.options].some(o=>o.value===${JSON.stringify(String(value))}));})()`,
    'ready input ' + selector,
    targetPage
  );
  await evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    targetPage
  );
}

async function navigate(url, targetPage = page) {
  await targetPage.send('Page.navigate', { url });
  await wait(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'`, 'navigation', targetPage);
}

async function screenshot(name, targetPage = page) {
  await fs.mkdir(evidence, { recursive: true });
  const r = await targetPage.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(evidence, name + '.png'), Buffer.from(r.data, 'base64'));
}

async function runR6BrowserChecks() {
  console.log('--- STARTING R6 ROLE GOVERNANCE BROWSER VERIFICATION ---');
  h = await startIsolated({ approvedIntake: true, coordinationMigration: true, accountRecoveryMigration: true });
  
  // 1. Chuẩn bị người dùng đa vai trò (CBTD + QUAN_LY)
  const password = 'R6MultiRoleTest123!';
  const cbtdRole = await h.db.role.upsert({ where: { code: 'CBTD' }, create: { code: 'CBTD', name: 'Cán bộ Tín dụng' }, update: {} });
  const quanLyRole = await h.db.role.upsert({ where: { code: 'QUAN_LY' }, create: { code: 'QUAN_LY', name: 'Quản lý Chi nhánh' }, update: {} });
  
  const multiUser = await h.db.user.create({
    data: {
      username: 'r6_officer_manager',
      email: 'r6_dual@example.test',
      fullName: 'Vũ Đa Vai Trò',
      passwordHash: await bcrypt.hash(password, 4),
      roles: {
        create: [
          { roleId: cbtdRole.id },
          { roleId: quanLyRole.id }
        ]
      }
    }
  });

  // 2. Khởi động Vite dev server nếu chưa chạy
  let viteLog = '';
  vite = spawn(
    process.execPath,
    [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
    { cwd: frontend, env: { ...process.env, VITE_API_URL: h.base }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  vite.stdout.on('data', (x) => (viteLog += x));
  vite.stderr.on('data', (x) => (viteLog += x));
  for (let i = 0; i < 100; i++) {
    if (vite.exitCode !== null) throw Error('Vite stopped: ' + viteLog.slice(-1500));
    try {
      if ((await fetch(site)).ok) break;
    } catch {}
    await sleep(100);
  }

  // 3. Khởi động Chrome Headless với CDP
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'sme-r6-chrome-'));
  chrome = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' }
  );
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) break;
    } catch {}
    await sleep(100);
  }
  assert.ok(port, 'Chrome ready');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  page = connection(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await page.ready;
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 1000, deviceScaleFactor: 1, mobile: false });

  // -------------------------------------------------------------
  // KỊCH BẢN 1: Đăng nhập tài khoản đa vai trò & Hiển thị Role Switcher
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 1: Login multi-role user and inspect Role Switcher ---');
  await navigate(site + '/');
  await evaluate('localStorage.clear(); sessionStorage.clear();');
  await navigate(site + '/?r6_test=' + randomUUID());
  await wait('document.querySelector(".login-card input[autocomplete=username]")', 'staff login');
  await input('.login-card input[autocomplete=username]', multiUser.username);
  await input('.login-card input[type=password]', password);
  await click('Đăng nhập');
  await wait('document.querySelector(".account-trigger")', 'workspace signed in');
  
  // Mở popup tài khoản
  await evaluate('document.querySelector(".account-trigger").click()');
  await wait('document.querySelector(".account-role-switcher")', 'role switcher visible');
  check(await evaluate('document.querySelectorAll(".account-role-switcher button[role=radio]").length === 2'), '2 role radio options displayed');
  check(await evaluate('/cán bộ tín dụng/i.test(document.querySelector(".account-role-switcher").textContent)'), 'CBTD shown');
  check(await evaluate('/quản lý chi nhánh/i.test(document.querySelector(".account-role-switcher").textContent)'), 'QUAN_LY shown');

  // -------------------------------------------------------------
  // KỊCH BẢN 2: Hủy chuyển vai trò khi có xác nhận (Cancel)
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Cancel role switch via confirmation dialog ---');
  let confirmDialogTriggered = false;
  await evaluate(`
    window.__r6_confirm_called = false;
    window.confirm = (msg) => {
      window.__r6_confirm_called = true;
      window.__r6_confirm_msg = msg;
      return false; // Người dùng bấm Hủy
    };
  `);
  // Click chọn vai trò QUAN_LY
  await evaluate(`
    (() => {
      const radios = [...document.querySelectorAll(".account-role-switcher button[role=radio]")];
      const qlRadio = radios.find(r => r.textContent.includes("Quản lý"));
      if (qlRadio) qlRadio.click();
    })()
  `);
  check(await evaluate('window.__r6_confirm_called === true'), 'window.confirm was called on switch attempt');
  check(await evaluate('window.__r6_confirm_msg.includes("hủy bỏ mọi nội dung chưa lưu")'), 'Warning mentions discarding unsaved work');
  check(await evaluate('window.__r6_confirm_msg.includes("không tự động lưu hoặc gửi thay")'), 'Warning mentions system will not auto-save');
  check(await evaluate('localStorage.getItem("sme_active_role") === "CBTD"'), 'activeRole remains CBTD after cancel');
  await screenshot('r6-01a-switch-canceled');

  // -------------------------------------------------------------
  // KỊCH BẢN 3: Xác nhận chuyển vai trò (Confirm) & Workspace remounts
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Confirm role switch and verify workspace remount ---');
  await evaluate('window.confirm = () => true;'); // Người dùng bấm Đồng ý
  await evaluate(`
    (() => {
      const radios = [...document.querySelectorAll(".account-role-switcher button[role=radio]")];
      const qlRadio = radios.find(r => r.textContent.includes("Quản lý"));
      if (qlRadio) qlRadio.click();
    })()
  `);
  await wait('localStorage.getItem("sme_active_role") === "QUAN_LY"', 'role switched to QUAN_LY in storage');
  check(await evaluate('localStorage.getItem("sme_active_role") === "QUAN_LY"'), 'storage updated to QUAN_LY');
  // Workspace cập nhật sang vai trò Quản lý
  await wait('/quản lý/i.test(document.querySelector(".account-trigger")?.textContent)', 'Navbar displays Quản lý Chi nhánh');
  await screenshot('r6-01b-switch-confirmed');

  // -------------------------------------------------------------
  // KỊCH BẢN 4: Hai tab đồng bộ qua Storage Event
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Two-tab cross-tab synchronization ---');
  const tab2Created = await page.send('Target.createTarget', { url: site + '/' });
  let tab2Page;
  try {
    let target;
    for (let i = 0; i < 50; i++) {
      target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find((t) => t.id === tab2Created.targetId);
      if (target) break;
      await sleep(100);
    }
    tab2Page = connection(target.webSocketDebuggerUrl);
    await tab2Page.ready;
    await tab2Page.send('Runtime.enable');
    await tab2Page.send('Page.enable');
    await wait('document.querySelector(".account-trigger")', 'tab 2 workspace signed in', tab2Page);
    check(await evaluate('/quản lý/i.test(document.querySelector(".account-trigger")?.textContent)', tab2Page), 'Tab 2 opens with QUAN_LY');

    // Ở Tab 1: chuyển lại sang CBTD
    await evaluate('document.querySelector(".account-trigger").click()');
    await wait('document.querySelector(".account-role-switcher")', 'role switcher in tab 1');
    await evaluate(`
      (() => {
        const radios = [...document.querySelectorAll(".account-role-switcher button[role=radio]")];
        const cbtdRadio = radios.find(r => /cán bộ/i.test(r.textContent));
        if (cbtdRadio) cbtdRadio.click();
      })()
    `);
    await wait('localStorage.getItem("sme_active_role") === "CBTD"', 'Tab 1 switched to CBTD');

    // Kiểm tra Tab 2: Lắng nghe storage event và tự động chuyển sang CBTD mà không cần reload
    await wait('/cán bộ/i.test(document.querySelector(".account-trigger")?.textContent)', 'Tab 2 auto-updated to CBTD', tab2Page);
    check(await evaluate('/cán bộ/i.test(document.querySelector(".account-trigger")?.textContent)', tab2Page), 'Tab 2 synchronized via storage event');
    await screenshot('r6-02-cross-tab-sync', tab2Page);
  } finally {
    tab2Page?.close();
    await page.send('Target.closeTarget', { targetId: tab2Created.targetId });
  }

  // -------------------------------------------------------------
  // KỊCH BẢN 5: Thu hồi quyền tại DB & 403 ACTIVE_ROLE_INVALID Phục hồi phiên an toàn
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Revoke active role in DB, trigger 403 ACTIVE_ROLE_INVALID and safe session recovery ---');
  // Người dùng hiện đang ở vai trò CBTD trên client. Admin tước vai trò CBTD tại DB:
  await h.db.userRole.deleteMany({
    where: {
      userId: multiUser.id,
      role: { code: 'CBTD' }
    }
  });
  console.log('Revoked CBTD role from user in DB. User now only has QUAN_LY.');

  // Client thực hiện thao tác gọi API có X-Active-Role: CBTD qua app client
  await evaluate(`
    const refreshBtn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Làm mới"));
    if (refreshBtn) refreshBtn.click();
    else document.querySelector("button[data-tab=loans]")?.click();
  `);

  // Chờ AuthContext bắt sự kiện sme-role-invalidated, gọi /auth/me, nhận ra CBTD đã mất, tự chuyển sang QUAN_LY và hiển thị session-recovery-banner
  await wait('document.querySelector(".session-recovery-banner")', 'session recovery banner rendered');
  check(await evaluate('document.querySelector(".session-recovery-banner") !== null'), 'session-recovery-banner is visible');
  check(await evaluate('document.querySelector(".session-recovery-banner").textContent.includes("Vai trò trước đó không còn hiệu lực")'), 'Banner explains revoked role');
  check(await evaluate('localStorage.getItem("sme_active_role") === "QUAN_LY"'), 'Safe fallback: switched to remaining QUAN_LY role');
  await screenshot('r6-03-revocation-recovery-banner');

  // Đóng banner
  await evaluate('document.querySelector(".session-recovery-banner button")?.click()');
  await wait('document.querySelector(".session-recovery-banner") === null', 'banner dismissed');

  console.log('\n--- ALL R6 BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  return {
    pass: true,
    checks,
    screenshots: [
      'r6-01a-switch-canceled.png',
      'r6-01b-switch-confirmed.png',
      'r6-02-cross-tab-sync.png',
      'r6-03-revocation-recovery-banner.png'
    ]
  };
}

async function main() {
  let result;
  try {
    result = await runR6BrowserChecks();
    const outPath = path.join(evidence, 'r6-browser-acceptance.json');
    await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (page) page.close();
    if (chrome) chrome.kill();
    if (vite) vite.kill();
    if (profile) await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
    if (h) await h.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('R6_BROWSER_FAILED:', err);
  process.exitCode = 1;
});
