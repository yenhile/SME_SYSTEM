/* Phiên nghiệm thu SLA PA1 cho PO (C.9.3, C.9.6).
 * Dựng schema riêng portal_v2_it_* trong PostgreSQL Docker sme_loan (startIsolated xác minh đích và tự dọn), ghi mốc T0,
 * tạo các hồ sơ mẫu ở nhiều trạng thái, mở API (cổng 3002) và giao diện (cổng 5173, đổi bằng --web-port). Không đụng schema public.
 * Giao diện web dùng cổng 5173 như hệ thống (mặc định); cổng đó phải trống: dừng container giao diện Docker trước (`docker compose stop frontend`)
 * rồi bật lại sau phiên (`docker compose start frontend`). Đổi bằng --web-port=N. API của phiên ở cổng 3002 (cổng nền, không cần mở).
 * Chạy:  node backend/scripts/sla-pa1-session.cjs [--minutes=60] [--web-port=5173]   (cần DATABASE_URL trỏ localhost; xem HANDOVER C.9.8)
 * Phiên tự kết thúc khi hết hạn hoặc khi nhấn Ctrl+C: dừng máy chủ, xóa schema và các tệp tải lên của phiên.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { startIsolated } = require('./check-portal-v2-intake.cjs');

const root = path.resolve(__dirname, '..');
const frontend = path.resolve(root, '..', 'frontend');
const vn = (date, time) => new Date(`${date}T${time}:00+07:00`);
const minutes = Number((process.argv.find(a => a.startsWith('--minutes=')) || '--minutes=60').split('=')[1]);
const PASSWORD = 'SlaPa1Demo#2026';
const webPort = Number((process.argv.find(a => a.startsWith('--web-port=')) || '--web-port=5173').split('=')[1]);
const SITE = `http://localhost:${webPort}`;

function portBusy(port) {
  return new Promise(resolve => {
    const socket = require('node:net').connect({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function applySlaSql() {
  const run = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--file', path.join(root, 'prisma/sla-pa1.sql'), '--schema', path.join(root, 'prisma/schema.prisma')],
    { cwd: root, env: { ...process.env }, encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(run.status, 0, 'SQL PA1 failed; output withheld');
}

async function seed(h) {
  const { db, app } = h;
  const bcrypt = require('bcryptjs');
  const { PDFDocument } = require('pdf-lib');
  const { WorkflowService } = require('../dist/modules/workflow/workflow.service');
  const { LoanApplicationsService } = require('../dist/modules/loan-applications/loan-applications.service');
  const { SupplementsService } = require('../dist/modules/supplements/supplements.service');
  const { PortalSupplementsService } = require('../dist/modules/supplements/portal-supplements.service');
  const { SupplementRemindersService } = require('../dist/modules/supplements/supplement-reminders.service');
  const { SIMULATED_CALENDAR_V1 } = require('../dist/modules/workflow/sla/working-time');
  const workflow = app.get(WorkflowService, { strict: false });
  const loans = app.get(LoanApplicationsService, { strict: false });
  const supplements = app.get(SupplementsService, { strict: false });
  const portalSupplements = app.get(PortalSupplementsService, { strict: false });
  const reminders = app.get(SupplementRemindersService, { strict: false });
  reminders.mailer.sendSupplementReminder = async () => undefined; // không gửi email thật khi dựng dữ liệu

  applySlaSql();
  const hash = await bcrypt.hash(PASSWORD, 4);
  const roles = {};
  for (const code of ['ADMIN', 'QUAN_LY', 'CBTD', 'THAM_QUYEN']) roles[code] = await db.role.create({ data: { code, name: `Mô phỏng ${code}` } });
  const user = (name, code, fullName) => db.user.create({ data: { username: name, email: `${name}@example.test`, fullName, passwordHash: hash, roles: { create: { roleId: roles[code].id } } } });
  const staff = {
    admin: await user('sla_admin', 'ADMIN', 'Quản trị mô phỏng'),
    manager: await user('sla_quanly', 'QUAN_LY', 'Quản lý mô phỏng'),
    cbtd: await user('sla_cbtd', 'CBTD', 'CBTD mô phỏng'),
    approver: await user('sla_thamquyen', 'THAM_QUYEN', 'Thẩm quyền mô phỏng'),
  };
  for (const [i, [code, name, sla]] of [['TIEP_NHAN', 'Tiếp nhận hồ sơ', 4], ['THAM_DINH', 'Thẩm định', 24], ['CAP_TREN', 'Cấp trên', 48], ['HOAN_TAT', 'Hoàn tất', 8]].entries()) {
    await db.workflowStage.create({ data: { stageCode: code, stageName: name, standardSlaHours: sla, orderIndex: i + 1 } });
  }
  const account = await db.portalAccount.create({ data: { email: 'dn.sla@example.test', passwordHash: hash, contactName: 'Doanh nghiệp mô phỏng', phone: '0900000000', verifiedAt: new Date() } });
  // Mốc T0 của phiên thử: công đoạn mở từ T0 dùng PA1; công đoạn mở trước đó giữ cách tính cũ.
  const t0 = vn('2026-10-26', '08:00');
  await db.slaPolicyActivation.create({ data: { policyCode: 'PA1', calendarVersion: SIMULATED_CALENDAR_V1.version, activatedAt: t0, note: 'T0 của phiên nghiệm thu (mô phỏng)' } });

  let seq = 0;
  const cbtd = { id: staff.cbtd.id, activeRole: 'CBTD' };
  const newLoan = async (clock, label) => {
    const n = ++seq;
    const result = await loans.create({
      taxCode: `79${String(n).padStart(8, '0')}`, companyName: `[MÔ PHỎNG PA1] ${label}`, industry: 'Sản xuất', establishedYear: 2020, annualRevenue: 5e9, charterCapital: 1e9,
      representativeName: 'Người đại diện mô phỏng', phone: '0900000000', address: 'Địa chỉ mô phỏng', loanPurpose: 'Bổ sung vốn lưu động (mô phỏng)',
      loanType: 'VAY_VON_LUU_DONG', proposedAmount: 1e9, loanTermMonths: 12,
    }, staff.cbtd.id, clock);
    await db.portalRequest.create({ data: { reference: `SLA-DEMO-${n}`, accountId: account.id, status: 'ACCEPTED', loanId: result.loan.id, assignedTo: staff.cbtd.id, data: {} } });
    return result.loan;
  };
  const structured = (loan, clock, count) => supplements.createSupplementRequest(loan.id, {
    requestContent: 'Yêu cầu bổ sung mô phỏng', clientRequestId: randomUUID(),
    items: ['A_CHARTER', 'A_BUSINESS_REGISTRATION'].slice(0, count).map(code => ({ documentGroup: 'A', documentTypeCode: code, reason: 'Bổ sung tài liệu (mô phỏng)' })),
  }, staff.cbtd.id, 'CBTD', clock);
  const revisionOf = async id => (await db.supplementRequest.findUnique({ where: { id } })).portalSupplement.revision;
  const upload = async (loan, supp, itemId, text) => {
    const request = await db.portalRequest.findFirst({ where: { loanId: loan.id } });
    const doc = await PDFDocument.create(); doc.addPage([300, 200]).drawText(`SYNTHETIC ${text}`);
    const buffer = Buffer.from(await doc.save());
    const view = await portalSupplements.upload(request.id, account.id, supp.id, itemId, { buffer, originalname: `${text}.pdf`, size: buffer.length, mimetype: 'application/pdf' },
      { expectedRevision: String(await revisionOf(supp.id)), clientUploadId: randomUUID() });
    return view.files.filter(f => f.itemId === itemId).at(-1).id;
  };
  const respond = async (loan, supp, clock) => {
    const request = await db.portalRequest.findFirst({ where: { loanId: loan.id } });
    const ids = [];
    for (const item of supp.items) ids.push(await upload(loan, supp, item.id, item.documentTypeCode));
    await portalSupplements.respond(request.id, account.id, supp.id, { expectedRevision: await revisionOf(supp.id), clientRequestId: randomUUID(), documentIds: ids }, clock);
  };
  const review = async (supp, itemId, accepted) => portalSupplements.review(supp.id, itemId,
    { expectedRevision: await revisionOf(supp.id), clientRequestId: randomUUID(), accepted, message: accepted ? 'Đạt' : 'Cần thay tài liệu (mô phỏng)' }, cbtd);
  const code = loan => loan.applicationCode;
  const fixtures = [];
  const add = (loan, title, tryThis) => fixtures.push({ applicationCode: code(loan), title, tryThis });

  // Hồ sơ mở trước T0 (cách tính cũ).
  const f1 = await newLoan(vn('2026-10-21', '09:00'), 'S1 cách cũ đang chờ bổ sung');
  await supplements.createSupplementRequest(f1.id, { requestContent: 'Bổ sung nhập tay (cách cũ)' }, staff.cbtd.id, 'CBTD', vn('2026-10-28', '10:00'));
  add(f1, 'Công đoạn mở TRƯỚC T0, đang chờ bổ sung (nhập tay)', 'Chi tiết hồ sơ: cột "Cách tính" là Giờ thực (cách cũ); dán nhãn chờ bổ sung theo cách cũ');
  // PA1: đang chờ doanh nghiệp.
  const f2 = await newLoan(vn('2026-10-27', '09:00'), 'S2 PA1 chờ doanh nghiệp');
  await structured(f2, vn('2026-10-27', '10:00'), 2);
  add(f2, 'PA1, doanh nghiệp đang phải bổ sung', 'Chi tiết: "Đang chờ doanh nghiệp · SLA tạm dừng". Portal (dn.sla): tải một tệp thì SLA vẫn dừng; tải đủ và bấm gửi thì SLA chạy lại');
  // PA1: doanh nghiệp đã gửi đủ, ngân hàng đang kiểm tra.
  const f3 = await newLoan(vn('2026-10-27', '09:00'), 'S3 PA1 ngân hàng đang kiểm tra');
  const s3 = await structured(f3, vn('2026-10-27', '10:00'), 2);
  await respond(f3, s3, vn('2026-10-28', '09:00'));
  add(f3, 'PA1, doanh nghiệp đã gửi đủ, ngân hàng đang kiểm tra', 'Chi tiết: "Ngân hàng đang kiểm tra · SLA đang chạy". CBTD: đánh dấu từng mục (không làm SLA dừng)');
  // PA1: đã kiểm tra xong, sẵn sàng gửi danh sách sửa.
  const f4 = await newLoan(vn('2026-10-27', '09:00'), 'S4 PA1 sẵn sàng gửi danh sách sửa');
  const s4 = await structured(f4, vn('2026-10-27', '10:00'), 2);
  await respond(f4, s4, vn('2026-10-27', '14:00'));
  const s4view = await db.supplementRequest.findUnique({ where: { id: s4.id } });
  await review(s4, s4view.portalSupplement.items[0].id, false);
  await review(s4, s4view.portalSupplement.items[1].id, true);
  add(f4, 'PA1, đã kiểm tra xong, có mục cần sửa', 'CBTD: bấm "Gửi danh sách sửa cho doanh nghiệp" thì SLA dừng để chờ doanh nghiệp; sau đó doanh nghiệp tải lại và gửi thì SLA chạy lại');
  // Quá hạn thuộc doanh nghiệp (cách cũ) và quá hạn nhưng doanh nghiệp đã gửi đủ.
  const f5 = await newLoan(vn('2026-10-14', '09:00'), 'S5 quá hạn do doanh nghiệp');
  await structured(f5, vn('2026-10-18', '10:00'), 1);
  const f6 = await newLoan(vn('2026-10-14', '09:00'), 'S6 quá hạn nhưng doanh nghiệp đã gửi đủ');
  const s6 = await structured(f6, vn('2026-10-18', '10:00'), 1);
  await reminders.scan(vn('2026-10-28', '11:00')); // ghi dấu quá hạn cho cả hai (ngày 10 = 28/10)
  await respond(f6, s6, vn('2026-10-29', '15:00')); // doanh nghiệp gửi đủ SAU khi đã bị đánh dấu quá hạn
  add(f5, 'Quá hạn bổ sung do doanh nghiệp (công đoạn cách cũ)', 'Quản lý: Dashboard thấy "Chờ doanh nghiệp"; mở hồ sơ và "Đóng hồ sơ do quá hạn" được (có lý do)');
  add(f6, 'Đã bị đánh dấu quá hạn nhưng doanh nghiệp đã gửi đủ', 'Quản lý: Dashboard thấy "Chờ ngân hàng kiểm tra"; đóng hồ sơ phải bị từ chối; dấu vết quá hạn vẫn giữ');
  // PA1 ở công đoạn Thẩm định.
  const f7 = await newLoan(vn('2026-10-27', '09:00'), 'S7 PA1 đang thẩm định');
  await loans.checkDocuments(f7.id, true);
  await workflow.transitionStage(f7.id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, cbtd, vn('2026-10-28', '12:00'));
  add(f7, 'PA1 ở công đoạn Thẩm định', 'Thẩm quyền: thấy số giờ đang chạy theo giờ làm việc; dự báo hiện "Chưa có dự báo tương thích PA1"; chạy lại dự báo cũng báo như vậy');
  // PA1 quá hạn từ 05/11 (chỉ đóng được khi giờ thật đã tới hạn).
  const f8 = await newLoan(vn('2026-10-26', '09:00'), 'S8 PA1 sẽ quá hạn từ 05/11');
  await structured(f8, vn('2026-10-26', '10:00'), 1);
  add(f8, 'PA1, yêu cầu bổ sung từ 26/10; hạn ngày 10 là 05/11/2026', 'Chỉ quá hạn khi giờ thật từ 05/11 10:00; trước đó Quản lý bấm đóng sẽ bị từ chối "chưa quá hạn"');
  return { staff, fixtures, t0 };
}

async function main() {
  let h, vite, expired = false;
  const uploadDir = path.join(root, 'uploads', 'supplements');
  const before = new Set(await fsp.readdir(uploadDir).catch(() => []));
  const dirExisted = await fsp.stat(uploadDir).then(() => true, () => false);
  try {
    // Kiểm tra cổng trống TRƯỚC khi dựng bất cứ thứ gì, để không tạo schema hay dữ liệu khi không mở được giao diện.
    for (const port of [webPort, 3002]) {
      if (await portBusy(port)) throw new Error(`Cổng ${port} đang bận. Nếu là container giao diện Docker (cổng 5173): chạy \`docker compose stop frontend\` rồi thử lại, và bật lại sau phiên bằng \`docker compose start frontend\`.`);
    }
    process.env.SESSION_WEB_ORIGIN = SITE;
    h = await startIsolated();
    const { fixtures, t0 } = await seed(h);
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
      { cwd: frontend, env: { ...process.env, VITE_API_URL: h.base }, windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 150; i++) {
      if (vite.exitCode !== null) throw new Error('Vite stopped');
      try { if ((await fetch(SITE)).ok) break; } catch { /* chưa sẵn sàng */ }
      await new Promise(r => setTimeout(r, 100));
    }
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    console.log(JSON.stringify({
      sessionReady: true, schema: h.schema, expiresAt: expiresAt.toISOString(), site: SITE, portal: `${SITE}/portal`, api: h.base,
      accounts: { staff: ['sla_admin', 'sla_quanly', 'sla_cbtd', 'sla_thamquyen'], portal: 'dn.sla@example.test', syntheticPassword: PASSWORD },
      calendar: { version: 'SIM-20261026-20261108-v1', coverage: '26/10–08/11/2026', simulatedHoliday: '30/10/2026', t0: t0.toISOString(),
        note: 'Ngoài kỳ lịch, tạo hồ sơ và chuyển bước sẽ bị từ chối (không quay về tính 24/7).' },
      fixtures,
    }, null, 2));
    await new Promise(resolve => {
      const timer = setTimeout(() => { expired = true; resolve(); }, minutes * 60 * 1000);
      const stop = () => { clearTimeout(timer); resolve(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    });
  } finally {
    if (vite) vite.kill();
    if (h) console.log(JSON.stringify({ cleanup: await h.close(), reason: expired ? 'expired' : 'stopped' }));
    const created = (await fsp.readdir(uploadDir).catch(() => [])).filter(f => !before.has(f));
    for (const file of created) { if (/^[0-9a-f-]{36}$/i.test(file)) await fsp.unlink(path.join(uploadDir, file)).catch(() => undefined); }
    if (!dirExisted) await fsp.rmdir(uploadDir).catch(() => undefined);
  }
}
main().catch(e => { console.error('SLA_PA1_SESSION_FAILED:', e.message); process.exitCode = 1; });
