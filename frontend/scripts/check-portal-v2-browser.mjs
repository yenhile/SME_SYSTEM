// Real local browser + HTTP/PostgreSQL. Tagged synthetic fixtures only.
// No screenshots, recordings, mock APIs, seed or schema writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { PDFDocument } = require('pdf-lib');
const backend = path.resolve(new URL('../../backend/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const api = 'http://127.0.0.1:3000/api/portal';
const site = 'http://localhost:5173/portal';
const cdp = 'http://127.0.0.1:9333';
const tag = `v2_browser_${Date.now()}_${randomUUID().slice(0, 6)}`;
let prisma, target, ws, tempDir; const accountIds = []; const tempFiles = []; let checks = 0;
let pausedResponse;
const sockets = []; const promises = new Map(); let sequence = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const equal = (actual, expected, why = '') => { assert.deepEqual(actual, expected, why); checks++; };
async function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { promises.delete(id); reject(Error(`CDP timeout ${method}`)); }, 15000);
    promises.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
  return value.result.value;
}
async function wait(expression, label = expression, count = 100) {
  for (let i = 0; i < count; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
  throw Error(`Browser wait failed: ${label}. ` + await evaluate('document.body.innerText.slice(-1800)'));
}
async function click(text, selector = 'button') {
  await evaluate(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)} && x.getClientRects().length);if(!button||button.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)});button.click();})()`);
}
async function input(selector, value) {
  await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing input');const prototype=element.tagName==='SELECT'?HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(String(value))});element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
const field = (id, value) => input(`[id=${JSON.stringify('v2-' + id)}]`, value);
async function step(n) { await click(['Thông tin doanh nghiệp', 'Nhu cầu vay', 'Phương án vốn', 'Hồ sơ tài liệu', 'Rà soát đề nghị'][n - 1], '.v2-stepper button strong'); await wait(`document.querySelector('[aria-current="step"]')?.textContent.includes(${JSON.stringify(String(n))})`, `step ${n}`); }
async function saved() { await wait(`document.querySelector('.v2-save-status .saved') && !document.querySelector('.portal-wizard fieldset').disabled`, 'saved draft'); }
async function call(url, token, method = 'GET', body) {
  const r = await fetch(api + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function fixtureAccount() {
  const email = `${tag}_${accountIds.length}@example.test`;
  const account = await prisma.portalAccount.create({ data: { email, passwordHash: await bcrypt.hash('BrowserTest123', 10), contactName: tag, phone: '0900000000', verifiedAt: new Date() } });
  accountIds.push(account.id); return { account, email };
}
async function chooseFile(file) {
  const root = await send('DOM.getDocument');
  const element = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: '.portal-upload-editor input[type=file]' });
  assert.ok(element.nodeId); await send('DOM.setFileInputFiles', { nodeId: element.nodeId, files: [file] });
  await wait(`document.querySelector('.portal-upload-queue')`, 'file queued');
}
async function reload() {
  const origin = await evaluate('performance.timeOrigin');
  await send('Page.reload');
  await wait(`performance.timeOrigin!==${origin} && document.readyState==='complete'`, 'page reload committed');
}
async function cleanup() {
  if (target) await fetch(`${cdp}/json/close/${target.id}`).catch(() => {});
  for (const socket of sockets) socket.close();
  if (prisma) {
    const requests = await prisma.portalRequest.findMany({ where: { accountId: { in: accountIds } }, select: { id: true } });
    const ids = requests.map(x => x.id);
    const docs = await prisma.portalDocument.findMany({ where: { requestId: { in: ids } }, select: { filePath: true } });
    await prisma.$transaction(async tx => {
      await tx.internalNotification.deleteMany({ where: { requestId: { in: ids } } });
      await tx.portalDocument.updateMany({ where: { requestId: { in: ids } }, data: { supersedesId: null } });
      await tx.portalDocument.deleteMany({ where: { requestId: { in: ids } } });
      await tx.portalRequest.deleteMany({ where: { id: { in: ids } } });
      await tx.portalAccount.deleteMany({ where: { id: { in: accountIds } } });
    });
    for (const doc of docs) { assert.equal(path.basename(doc.filePath), doc.filePath); await fs.unlink(path.join(backend, 'uploads', doc.filePath)).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
    await prisma.$disconnect();
  }
  for (const file of tempFiles) await fs.unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; });
  if (tempDir) await fs.rmdir(tempDir);
}
try {
  const config = require('dotenv').parse(await fs.readFile(path.join(backend, '.env')));
  const db = new URL(config.DATABASE_URL); assert.ok(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname === '/sme_loan', 'Local development DB only');
  process.env.DATABASE_URL = config.DATABASE_URL; prisma = new PrismaClient();
  const { account, email } = await fixtureAccount();
  target = await (await fetch(`${cdp}/json/new?${encodeURIComponent(site)}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl); sockets.push(ws);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const value = JSON.parse(event.data); const task = promises.get(value.id); if (task) { promises.delete(value.id); value.error ? task.reject(Error(value.error.message)) : task.resolve(value.result); } else if (value.method === 'Fetch.requestPaused') void pausedResponse?.(value.params); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: site });
  await wait(`location.origin===${JSON.stringify(new URL(site).origin)} && document.readyState==='complete'`, 'portal origin ready');
  await evaluate('localStorage.clear();sessionStorage.clear()'); await send('Page.navigate', { url: site });
  await wait(`document.querySelector('.portal-auth input[type=email]')`, 'login');
  await input('.portal-auth input[type=email]', email); await input('.portal-auth input[type=password]', 'BrowserTest123'); await click('Đăng nhập');
  await wait(`document.querySelector('.v2-dashboard-stats')`, 'dashboard');
  const token = await evaluate(`localStorage.getItem('sme_portal_token')`);
  const cfg = await call('/requests/form-config', token); equal(cfg.data.previewEnabled, true); equal(cfg.data.canSubmit, false);
  await wait(`![...document.querySelectorAll('button')].find(x=>x.textContent.includes('Tạo đề nghị vay'))?.disabled`, 'V2 create enabled');
  await click('Tạo đề nghị vay'); await wait(`document.querySelector('.v2-stepper li.active')`, 'wizard');
  equal(await evaluate(`document.getElementById('v2-contactEmail').value`), email, 'contact autofill');
  equal(await evaluate(`document.querySelectorAll('.v2-stepper li').length`), 5);
  await field('companyName', 'SME Browser Manufacturing'); await field('taxCode', '0123456789'); await field('revenuePeriod', '2025');
  await click('Lưu nháp'); await saved();
  console.log('Browser: partial draft saved');
  let requests = (await call('/requests', token)).data; equal(requests.length, 1); const id = requests[0].id;
  equal(requests[0].formVersion, 2); equal(requests[0].data.revenuePeriod, '2025'); equal(requests[0].loanId, null);
  // Preserve unsaved valid edits across real refresh and re-authentication.
  await field('companyName', 'Unsaved restored company'); await reload();
  await wait(`document.getElementById('v2-companyName')?.value==='Unsaved restored company'`, 'unsaved recovery after refresh'); checks++;
  await click('Lưu nháp'); await saved();
  await step(2); await field('loanType', 'VAY_VON_LUU_DONG'); await field('proposedAmount', 8000000000); await field('loanTermMonths', 12); await field('loanPurpose', 'Materials for a production order');
  await field('collateral.mode', 'NONE_REQUESTED'); await field('hasExistingDebt', 'yes');
  equal(await evaluate(`document.getElementById('v2-collateral.description')===null`), true);
  await step(3); await click('Thêm hạng mục'); await field('capitalPlan.costs.0.name', 'Materials'); await field('capitalPlan.costs.0.amount', 10000000000); await field('capitalPlan.ownFunds', 2000000000);
  await click('Thêm hạng mục'); equal(await evaluate(`document.querySelectorAll('.v2-cost-row').length`), 2);
  await evaluate(`document.querySelector('[aria-label="Xóa hạng mục 2"]').click()`); equal(await evaluate(`document.querySelectorAll('.v2-cost-row').length`), 1);
  equal(await evaluate(`document.querySelector('.v2-finance-summary').innerText.includes('10.000.000.000')`), true);
  await field('capitalPlan.costs.0.amount', -1); await click('Lưu nháp'); await wait(`document.querySelector('.portal-alert')`, 'negative amount error'); equal(await evaluate(`document.querySelector('.v2-save-status .unsaved')!==null`), true);
  await field('capitalPlan.costs.0.amount', 10000000000); await click('Lưu nháp'); await saved();
  await step(4); equal(await evaluate(`document.querySelectorAll('.portal-document-manager .portal-doc-grid>section').length`), 6);
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sme-v2-browser-'));
  for (const name of ['original.pdf', 'replacement.pdf']) { const pdf = await PDFDocument.create(); pdf.addPage().drawText(`Synthetic ${tag} ${name}`); const file = path.join(tempDir, name); await fs.writeFile(file, await pdf.save()); tempFiles.push(file); }
  await click('Chọn tài liệu nhóm B'); await input('[aria-label="Loại tài liệu 1"]', 'B_FINANCIAL_STATEMENTS'); await input('[aria-label="Kỳ tài liệu 1"]', '2024'); await click('Thêm loại / kỳ'); await input('[aria-label="Loại tài liệu 2"]', 'B_FINANCIAL_STATEMENTS'); await input('[aria-label="Kỳ tài liệu 2"]', '2025');
  await chooseFile(tempFiles[0]); equal(await evaluate(`document.querySelectorAll('.portal-queue-item').length`), 1);
  await step(5); equal(await evaluate(`document.querySelector('.v2-review').innerText.includes('chưa hoàn tất upload')`), true);
  equal(await evaluate(`[...document.querySelectorAll('.v2-wizard-footer button')].find(x=>x.textContent.includes('Gửi đề nghị'))?.disabled`), true);
  await step(4);
  await send('Network.enable'); await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await click('Tải các tệp đang chờ'); await wait(`document.querySelector('.portal-queue-item')?.innerText.includes('Tải lên thất bại')`, 'upload failure retained');
  equal(await prisma.portalDocument.count({ where: { requestId: id } }), 0);
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  let loseResponse = true;
  pausedResponse = async event => {
    if (loseResponse && event.request.method === 'POST') { loseResponse = false; await send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'ConnectionClosed' }); }
    else await send('Fetch.continueRequest', { requestId: event.requestId });
  };
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/portal/requests/*/documents', requestStage: 'Response' }] });
  await click('Thử lại original.pdf'); await wait(`document.querySelector('.portal-queue-item')?.innerText.includes('Tải lên thất bại')`, 'committed upload response lost');
  await send('Fetch.disable'); equal(await prisma.portalDocument.count({ where: { requestId: id } }), 1);
  const secondTab = (await call(`/requests/${id}`, token)).data;
  equal((await call(`/requests/${id}`, token, 'PUT', { data: { ...secondTab.data, companyName: 'Other tab after upload' }, expectedRevision: secondTab.revision })).status, 200);
  await click('Thử lại original.pdf'); await wait(`document.querySelector('.v2-conflict') && document.querySelector('.v2-compare')`, 'retry cannot silently pair new revision with old form'); checks++;
  equal((await call(`/requests/${id}`, token)).data.data.companyName, 'Other tab after upload');
  await click('Dùng bản trên hệ thống'); await click('Thử lại original.pdf');
  await wait(`document.querySelectorAll('.portal-document-row').length===1 && !document.querySelector('.portal-upload-queue')`, 'upload retry complete');
  let current = (await call(`/requests/${id}`, token)).data; equal(current.documents.length, 1); equal(current.documents[0].coverage.length, 2); equal(current.documents[0].version, 1);
  await click('original.pdf', '.portal-document-row button'); await wait(`document.querySelector('.portal-preview iframe')?.src.startsWith('blob:')`, 'PDF preview'); checks++; await click('Đóng');
  await click('Thay thế'); await chooseFile(tempFiles[1]); await click('Tải các tệp đang chờ'); await wait(`document.querySelector('.portal-document-row')?.innerText.includes('Phiên bản 2') && !document.querySelector('.portal-upload-queue')`, 'replacement v2');
  await click('Lịch sử phiên bản'); await wait(`document.querySelectorAll('.portal-version-list li').length===2`, 'history retained'); checks++;
  await click('Rút tài liệu'); await wait(`document.querySelector('.portal-document-row')?.innerText.includes('Đã rút khỏi')`, 'withdraw');
  current = (await call(`/requests/${id}`, token)).data; equal(current.documents.length, 0); equal(await prisma.portalDocument.count({ where: { requestId: id } }), 2);
  await reload(); await wait(`document.querySelector('.portal-wizard')`, 'reopen after withdrawal'); await step(4); await wait(`document.querySelector('.portal-document-row')?.innerText.includes('Đã rút khỏi')`, 'withdrawn history after refresh'); checks++;
  await step(2); await field('collateral.mode', 'PROPOSED'); await wait(`document.getElementById('v2-collateral.description')`, 'conditional collateral'); await field('hasExistingDebt', 'no'); await step(4); equal(await prisma.portalDocument.count({ where: { requestId: id } }), 2, 'changing conditions retains history');
  // Revision conflict from a second real HTTP session, resolved in the UI.
  await step(1); current = (await call(`/requests/${id}`, token)).data;
  equal((await call(`/requests/${id}`, token, 'PUT', { data: { ...current.data, companyName: 'Server other tab' }, expectedRevision: current.revision })).status, 200);
  await field('companyName', 'Local conflicting edit'); await click('Lưu nháp'); await wait(`document.querySelector('.v2-conflict')`, 'conflict preserved'); equal(await evaluate(`document.getElementById('v2-companyName').value`), 'Local conflicting edit');
  await click('Xem bản mới nhất'); await wait(`document.querySelectorAll('.v2-compare section').length===2`, 'compare versions'); await click('Dùng bản trên hệ thống'); await wait(`document.getElementById('v2-companyName')?.value==='Server other tab'`, 'explicit conflict resolution'); checks++;
  // Logout/login preserves a draft's unsubmitted local edit in this tab.
  await field('companyName', 'Recovered after login'); await evaluate(`window.confirm=()=>true`); await click('Đăng xuất'); await wait(`document.querySelector('.portal-auth input[type=email]')`, 'logout'); await input('.portal-auth input[type=email]', email); await input('.portal-auth input[type=password]', 'BrowserTest123'); await click('Đăng nhập'); await wait(`document.getElementById('v2-companyName')?.value==='Recovered after login'`, 'login recovery'); checks++;
  await click('Lưu nháp'); await saved(); await step(5);
  equal((await call(`/requests/${id}/submit`, token, 'POST', {})).status, 409); equal((await call(`/requests/${id}`, token)).data.status, 'DRAFT');
  equal(await prisma.internalNotification.count({ where: { requestId: id } }), 0);
  for (const width of [1365, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const n of [1, 2, 3, 4, 5]) { await step(n); equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `no overflow ${width} step ${n}`); }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 900, deviceScaleFactor: 1, mobile: false });
  // Create retries and ownership use actual PostgreSQL, not source mocks.
  const key = randomUUID(); const retries = await Promise.all([call('/requests', token, 'POST', { formVersion: 2, clientRequestId: key, data: {} }), call('/requests', token, 'POST', { formVersion: 2, clientRequestId: key, data: {} })]); equal(retries.map(x => x.status), [201, 201]); equal(retries[0].data.id, retries[1].data.id); equal(await prisma.portalRequest.count({ where: { id: key } }), 1);
  const other = await fixtureAccount(); const otherToken = (await call('/auth/login', null, 'POST', { email: other.email, password: 'BrowserTest123' })).data.accessToken;
  equal((await call(`/requests/${id}`, otherToken)).status, 404);
  const file = await prisma.portalDocument.findFirst({ where: { requestId: id } }); equal((await call(`/requests/${id}/documents/${file.id}/versions`, otherToken)).status, 404);
  // V1 editor remains reachable and submits with the existing contract.
  const legacy = await call('/requests', token, 'POST', { data: { companyName: 'Legacy UI fixture' } }); equal(legacy.data.formVersion, 1);
  await click('Danh sách đề nghị'); await wait(`[...document.querySelectorAll('.portal-request-row')].some(x=>x.textContent.includes('Legacy UI fixture'))`, 'dashboard refreshed with V1');
  await evaluate(`(()=>{const row=[...document.querySelectorAll('.portal-request-row')].find(x=>x.textContent.includes('Legacy UI fixture'));if(!row)throw Error('Legacy missing');row.click();})()`); await wait(`document.querySelector('.portal-editor')`, 'V1 editor'); equal(await evaluate(`document.querySelector('.portal-wizard')===null`), true);
  console.log(JSON.stringify({ pass: true, checks, browser: 'CDP real Chrome', viewports: [1365, 375], screenshots: false, scope: 'Own fixtures, real HTTP/PostgreSQL, wizard/recovery/files/CAS/V1/policy lock' }));
} catch (error) { console.error(error.stack); if(ws?.readyState===1) console.error(await evaluate('document.body.innerText.slice(-1600)').catch(()=>'')); process.exitCode = 1; }
finally { try { await cleanup(); } catch (error) { console.error('Cleanup failed: ' + error.message); process.exitCode = 1; } }
