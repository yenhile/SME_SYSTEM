/* SLA PA1 mốc 1 — kiểm chứng thật trên PostgreSQL trong schema riêng portal_v2_it_* (startIsolated xác minh đích và tự dọn).
 * Không seed/reset public. Thời gian thao tác là đồng hồ cố định truyền vào dịch vụ; không đổi đồng hồ hệ thống.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fsp = require('node:fs/promises');
const { startIsolated } = require('./check-portal-v2-intake.cjs');

const root = path.resolve(__dirname, '..');
const vn = (date, time) => new Date(`${date}T${time}:00+07:00`);

function applySlaSql() {
  const run = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--file', path.join(root, 'prisma/sla-pa1.sql'), '--schema', path.join(root, 'prisma/schema.prisma')],
    { cwd: root, env: { ...process.env }, encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(run.status, 0, 'SQL PA1 failed; output withheld');
}

async function runChecks(h) {
  const { db, app } = h;
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks++; };
  const eq = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };
  const near = (actual, expected, message) => { assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`); checks++; };
  const { WorkflowService } = require('../dist/modules/workflow/workflow.service');
  const { LoanApplicationsService } = require('../dist/modules/loan-applications/loan-applications.service');
  const { AssignmentsService } = require('../dist/modules/assignments/assignments.service');
  const { SIMULATED_CALENDAR_V1 } = require('../dist/modules/workflow/sla/working-time');
  const workflow = app.get(WorkflowService, { strict: false });
  const loans = app.get(LoanApplicationsService, { strict: false });
  const assignments = app.get(AssignmentsService, { strict: false });

  // Chỉ mục "một khoảng dừng mở" nằm trong SQL nâng cấp (db push không tạo được chỉ mục có điều kiện): áp trước khi kiểm tra.
  applySlaSql();

  const roles = {};
  for (const code of ['CBTD', 'THAM_QUYEN', 'QUAN_LY']) roles[code] = await db.role.create({ data: { code, name: `Synthetic ${code}` } });
  const user = (name, code) => db.user.create({ data: { username: `sla_${name}`, email: `${name}@example.test`, fullName: `Synthetic ${name}`, passwordHash: 'synthetic-unused', roles: { create: { roleId: roles[code].id } } } });
  const cbtd = await user('cbtd', 'CBTD');
  const cbtd2 = await user('cbtd2', 'CBTD');
  const approver = await user('approver', 'THAM_QUYEN');
  const manager = await user('manager', 'QUAN_LY');
  for (const [i, [code, sla]] of [['TIEP_NHAN', 4], ['THAM_DINH', 24], ['CAP_TREN', 16], ['HOAN_TAT', 4]].entries()) {
    await db.workflowStage.create({ data: { stageCode: code, stageName: code, standardSlaHours: sla, orderIndex: i + 1 } });
  }

  const asCbtd = u => ({ id: u.id, activeRole: 'CBTD' });
  let seq = 0;
  const newLoan = async clock => {
    const result = await loans.create({
      taxCode: `78${String(++seq).padStart(8, '0')}`, companyName: `Synthetic SLA ${seq}`, industry: 'Sản xuất', establishedYear: 2020, annualRevenue: 5e9,
      charterCapital: 1e9, representativeName: 'Synthetic Representative', phone: '0900000000', address: 'Synthetic address',
      loanPurpose: 'Synthetic working capital', loanType: 'VAY_VON_LUU_DONG', proposedAmount: 1e9, loanTermMonths: 12,
    }, cbtd.id, clock);
    return result.loan;
  };
  const history = loanId => db.applicationStageHistory.findMany({ where: { applicationId: loanId }, include: { stage: true }, orderBy: [{ enteredAt: 'asc' }, { id: 'asc' }] });
  const toAppraisal = async (loan, clock, actor = cbtd) => {
    await loans.checkDocuments(loan.id, true);
    return workflow.transitionStage(loan.id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, asCbtd(actor), clock);
  };
  const stage = (rows, code) => rows.find(r => r.stage.stageCode === code);

  // 1. Chưa có mốc kích hoạt: công đoạn mới mở theo cách cũ.
  const legacy = await newLoan(vn('2026-10-20', '09:00'));
  let rows = await history(legacy.id);
  eq(rows[0].slaPolicy, null, 'before T0: legacy policy');
  eq(rows[0].slaCalendarVersion, null, 'before T0: no calendar');

  // 2. Ghi nhận T0 = đầu kỳ lịch mô phỏng. Công đoạn mở trước T0 giữ cách tính cũ.
  const t0 = vn('2026-10-26', '08:00');
  await db.slaPolicyActivation.create({ data: { policyCode: 'PA1', calendarVersion: SIMULATED_CALENDAR_V1.version, activatedAt: t0, note: 'Synthetic T0' } });
  await toAppraisal(legacy, vn('2026-10-28', '10:00'));
  rows = await history(legacy.id);
  const oldStage = stage(rows, 'TIEP_NHAN');
  eq(oldStage.slaPolicy, null, 'stage opened before T0 keeps legacy policy');
  near(oldStage.actualDurationHours, 193, 'legacy actual hours are real 24/7 hours (8 days + 1h)');
  near(oldStage.netWorkDurationHours, 193, 'legacy net hours unchanged');
  eq(oldStage.isDelayed, true, 'legacy delayed against 4h standard');
  const newOnOld = stage(rows, 'THAM_DINH');
  eq(newOnOld.slaPolicy, 'PA1', 'new stage on an old loan uses PA1 from T0');
  eq(newOnOld.slaCalendarVersion, SIMULATED_CALENDAR_V1.version, 'calendar version stored on new stage');

  // 3. C.9.5(1) nghỉ trưa: 11:00 -> 14:00 = 2 giờ; hoàn tất công đoạn sau đó, không phát sinh khoảng dừng.
  const lunch = await newLoan(vn('2026-10-27', '11:00'));
  eq((await history(lunch.id))[0].slaPolicy, 'PA1', 'stage opened after T0 uses PA1');
  await toAppraisal(lunch, vn('2026-10-27', '14:00'));
  rows = await history(lunch.id);
  near(stage(rows, 'TIEP_NHAN').actualDurationHours, 2, 'lunch break: actual working hours');
  near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 2, 'lunch break: net working hours');
  near(stage(rows, 'TIEP_NHAN').pausedDurationHours, 0, 'lunch break: no pause');
  eq(stage(rows, 'TIEP_NHAN').isDelayed, false, 'lunch break: within 4h standard');
  const approved = await workflow.transitionStage(lunch.id, { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', approvedAmount: 1e9, interestRate: 8 },
    { id: approver.id, activeRole: 'THAM_QUYEN' }, vn('2026-10-27', '15:00'));
  eq(approved.currentStatus, 'APPROVED', 'approval completes the loan');
  rows = await history(lunch.id);
  near(stage(rows, 'THAM_DINH').netWorkDurationHours, 1, 'appraisal stage working hours (14:00-15:00)');
  eq(stage(rows, 'HOAN_TAT').slaPolicy, 'PA1', 'terminal stage row records the policy');
  near(stage(rows, 'HOAN_TAT').netWorkDurationHours, 0, 'terminal stage has no duration');

  // 4. C.9.5(2) ngày nghỉ nối cuối tuần: 16:00 29/10 -> 09:00 02/11 = 2 giờ.
  const holiday = await newLoan(vn('2026-10-29', '16:00'));
  await toAppraisal(holiday, vn('2026-11-02', '09:00'));
  rows = await history(holiday.id);
  near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 2, 'simulated holiday + weekend: 2 working hours');

  // 5. Giá trị 0 giờ thực.
  const instant = await newLoan(vn('2026-10-27', '10:00'));
  await toAppraisal(instant, vn('2026-10-27', '10:00'));
  rows = await history(instant.id);
  near(stage(rows, 'TIEP_NHAN').actualDurationHours, 0, 'zero real hours: actual');
  near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 0, 'zero real hours: net');

  // 6. Điều chuyển không đặt lại đồng hồ: công đoạn giữ nguyên thời điểm vào và cách tính.
  const moved = await newLoan(vn('2026-10-27', '09:00'));
  const before = (await history(moved.id))[0];
  await assignments.reassign(moved.id, { newOfficerId: cbtd2.id, reason: 'Synthetic reassignment' }, manager.id);
  const after = (await history(moved.id))[0];
  eq(after.enteredAt.getTime(), before.enteredAt.getTime(), 'reassignment keeps the stage entry time');
  eq(after.slaPolicy, 'PA1', 'reassignment keeps the stage policy');
  await toAppraisal(moved, vn('2026-10-27', '12:00'), cbtd2);
  near(stage(await history(moved.id), 'TIEP_NHAN').netWorkDurationHours, 3, 'time used before reassignment is kept (09:00-12:00)');

  // 7. Ngoài kỳ lịch: không tự quay về 24/7; thao tác bị từ chối và dữ liệu không đổi.
  await assert.rejects(newLoan(vn('2026-11-09', '10:00')), e => /không bao phủ/.test(e.message)); checks++;
  const edge = await newLoan(vn('2026-11-06', '15:00'));
  await loans.checkDocuments(edge.id, true);
  await assert.rejects(
    workflow.transitionStage(edge.id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, asCbtd(cbtd), vn('2026-11-09', '10:00')),
    e => /không bao phủ/.test(e.message)); checks++;
  rows = await history(edge.id);
  eq(rows.length, 1, 'rejected transition leaves a single stage row');
  eq(rows[0].exitedAt, null, 'rejected transition leaves the stage open');
  eq((await db.loanApplication.findUnique({ where: { id: edge.id } })).currentStage, 'TIEP_NHAN', 'rejected transition leaves the loan stage');

  // ===== Mốc 2: vòng bổ sung =====
  const { PortalSupplementsService } = require('../dist/modules/supplements/portal-supplements.service');
  const { SupplementsService } = require('../dist/modules/supplements/supplements.service');
  const { SupplementRemindersService } = require('../dist/modules/supplements/supplement-reminders.service');
  const { PDFDocument } = require('pdf-lib');
  const portalSupplements = app.get(PortalSupplementsService, { strict: false });
  const supplements = app.get(SupplementsService, { strict: false });
  const reminders = app.get(SupplementRemindersService, { strict: false });
  // Không gửi email thật trong kiểm thử (tránh tác động ngoài schema thử).
  let emailsSent = 0;
  reminders.mailer.sendSupplementReminder = async () => { emailsSent++; };
  const uploadDir = path.join(root, 'uploads', 'supplements');
  const uploadsBefore = new Set(await fsp.readdir(uploadDir).catch(() => []));
  const uploadsDirExisted = await fsp.stat(uploadDir).then(() => true, () => false);
  try {
    const pdf = async text => { const d = await PDFDocument.create(); d.addPage([200, 200]).drawText(text); return Buffer.from(await d.save()); };
    const asManager = { id: manager.id, activeRole: 'QUAN_LY' };
    const portalFor = async loan => {
      const account = await db.portalAccount.create({ data: { email: `sla${loan.id.slice(0, 8)}@example.test`, passwordHash: 'synthetic-unused', contactName: 'Synthetic', phone: '0900000000', verifiedAt: new Date() } });
      const request = await db.portalRequest.create({ data: { reference: `SLA-${loan.id.slice(0, 8)}`, accountId: account.id, status: 'ACCEPTED', loanId: loan.id, assignedTo: cbtd.id, data: {} } });
      return { account, request };
    };
    const revisionOf = async id => (await db.supplementRequest.findUnique({ where: { id } })).portalSupplement.revision;
    const pausesOf = loanId => db.applicationStagePause.findMany({ where: { history: { applicationId: loanId } }, orderBy: { startedAt: 'asc' } });
    const openPauses = async loanId => (await pausesOf(loanId)).filter(p => p.endedAt === null);
    const createStructured = (loan, clock, count = 2) => {
      const types = ['A_CHARTER', 'A_BUSINESS_REGISTRATION', 'A_REPRESENTATIVE_AUTHORITY'].slice(0, count);
      return supplements.createSupplementRequest(loan.id, {
        requestContent: 'Synthetic structured supplement', clientRequestId: randomUUID(),
        items: types.map(code => ({ documentGroup: 'A', documentTypeCode: code, reason: 'Synthetic reason' })),
      }, cbtd.id, 'CBTD', clock);
    };
    const upload = async (portal, supplementId, itemId, text, supersedesId) => {
      const buffer = await pdf(text);
      const view = await portalSupplements.upload(portal.request.id, portal.account.id, supplementId, itemId,
        { buffer, originalname: `${text}.pdf`, size: buffer.length, mimetype: 'application/pdf' },
        { expectedRevision: String(await revisionOf(supplementId)), clientUploadId: randomUUID(), ...(supersedesId ? { supersedesId } : {}) });
      return view.files.filter(f => f.itemId === itemId).at(-1);
    };
    const respondAll = async (portal, supplementId, fileIds, clock) => {
      const body = { expectedRevision: await revisionOf(supplementId), clientRequestId: randomUUID(), documentIds: fileIds };
      await portalSupplements.respond(portal.request.id, portal.account.id, supplementId, body, clock);
      return body;
    };
    const review = async (supplementId, itemId, accepted) => portalSupplements.review(supplementId, itemId,
      { expectedRevision: await revisionOf(supplementId), clientRequestId: randomUUID(), accepted, message: accepted ? 'Đạt' : 'Cần thay tài liệu' }, { id: cbtd.id, activeRole: 'CBTD' });
    const blockedTransition = (loan, clock) => assert.rejects(
      workflow.transitionStage(loan.id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, asCbtd(cbtd), clock), e => e.getStatus() === 400);

    // --- 9. C.9.5(3) vòng bổ sung đầy đủ trên công đoạn PA1 ---
    const loop = await newLoan(vn('2026-10-27', '09:00'));
    const loopPortal = await portalFor(loop);
    const supp = await createStructured(loop, vn('2026-10-27', '10:00'));
    eq((await db.loanApplication.findUnique({ where: { id: loop.id } })).currentStatus, 'SUPPLEMENT_REQUIRED', 'supplement request blocks the loan');
    let pauses = await pausesOf(loop.id);
    eq(pauses.length, 1, 'creating a supplement opens exactly one pause');
    eq(pauses[0].startedAt.getTime(), vn('2026-10-27', '10:00').getTime(), 'pause starts at the request time');
    await blockedTransition(loop, vn('2026-10-27', '10:30')); checks++;
    const itemIds = supp.items.map(i => i.id);
    const fileA = await upload(loopPortal, supp.id, itemIds[0], 'first-A');
    eq((await openPauses(loop.id)).length, 1, 'a partial upload does not restart the SLA');
    const fileB = await upload(loopPortal, supp.id, itemIds[1], 'first-B');
    const firstRespond = await respondAll(loopPortal, supp.id, [fileA.id, fileB.id], vn('2026-10-27', '14:00'));
    pauses = await pausesOf(loop.id);
    eq((await openPauses(loop.id)).length, 0, 'a full formal response restarts the SLA');
    eq(pauses[0].endedAt.getTime(), vn('2026-10-27', '14:00').getTime(), 'pause ends at the response time');
    // Gửi lặp/mất phản hồi: cùng mã thao tác, phát lại ở thời điểm khác, không đổi khoảng dừng.
    await portalSupplements.respond(loopPortal.request.id, loopPortal.account.id, supp.id, firstRespond, vn('2026-10-27', '14:30'));
    pauses = await pausesOf(loop.id);
    eq(pauses.length, 1, 'a replayed response creates no pause');
    eq(pauses[0].endedAt.getTime(), vn('2026-10-27', '14:00').getTime(), 'a replayed response does not move the pause end');
    // Ngân hàng kiểm tra vẫn tính giờ: đánh dấu từng mục không dừng SLA.
    await review(supp.id, itemIds[0], false);
    await review(supp.id, itemIds[1], true);
    eq((await openPauses(loop.id)).length, 0, 'marking items does not pause the SLA');
    await blockedTransition(loop, vn('2026-10-27', '15:30')); checks++;
    // Gửi danh sách sửa tổng hợp: dừng mới; hai lần đồng thời chỉ một lần thành công; phát lại không tạo thêm.
    const revision = await revisionOf(supp.id);
    const returnId = randomUUID();
    const actor = { id: cbtd.id, activeRole: 'CBTD' };
    const attempts = await Promise.allSettled([
      portalSupplements.returnCorrections(supp.id, { expectedRevision: revision, clientRequestId: returnId }, actor, vn('2026-10-27', '16:00')),
      portalSupplements.returnCorrections(supp.id, { expectedRevision: revision, clientRequestId: randomUUID() }, actor, vn('2026-10-27', '16:00')),
    ]);
    eq(attempts.filter(a => a.status === 'fulfilled').length, 1, 'concurrent returns: exactly one succeeds');
    pauses = await pausesOf(loop.id);
    eq(pauses.length, 2, 'the return opens exactly one new pause');
    eq(pauses[1].endedAt, null, 'the new pause is open');
    eq(pauses[1].startedAt.getTime(), vn('2026-10-27', '16:00').getTime(), 'new pause starts when the list is sent');
    if (attempts[0].status === 'fulfilled') {
      await portalSupplements.returnCorrections(supp.id, { expectedRevision: revision, clientRequestId: returnId }, actor, vn('2026-10-27', '17:00'));
      eq((await pausesOf(loop.id)).length, 2, 'replaying the return creates no extra pause');
    }
    // Doanh nghiệp sửa và gửi lại hôm sau.
    const fileA2 = await upload(loopPortal, supp.id, itemIds[0], 'second-A', fileA.id);
    await respondAll(loopPortal, supp.id, [fileA2.id], vn('2026-10-28', '09:00'));
    eq((await openPauses(loop.id)).length, 0, 'the second response restarts the SLA');
    await review(supp.id, itemIds[0], true);
    const resolved = await supplements.resolveSupplementRequest(supp.id, { clientRequestId: randomUUID(), expectedRevision: await revisionOf(supp.id) }, cbtd.id, 'CBTD', vn('2026-10-28', '11:00'));
    eq(resolved.status, 'RESOLVED', 'bank completes the supplement');
    eq((await db.loanApplication.findUnique({ where: { id: loop.id } })).currentStatus, 'RECEIVED', 'loan returns to reception status');
    eq((await pausesOf(loop.id)).length, 2, 'completion adds no second pause');
    await toAppraisal(loop, vn('2026-10-28', '12:00'));
    rows = await history(loop.id);
    // Công đoạn mở 09:00 27/10, đóng 12:00 28/10: giờ làm việc = 7 (09-12, 13-17) + 4 (08-12) = 11.
    // Dừng 10:00-14:00 = 3 giờ làm việc; dừng 16:00 27/10 -> 09:00 28/10 = 1 + 1 = 2; tổng dừng 5; ròng 6.
    near(stage(rows, 'TIEP_NHAN').actualDurationHours, 11, 'supplement loop: working hours in the stage');
    near(stage(rows, 'TIEP_NHAN').pausedDurationHours, 5, 'supplement loop: working hours waiting for the enterprise');
    near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 6, 'supplement loop: net bank working hours');
    eq(stage(rows, 'TIEP_NHAN').isDelayed, true, 'supplement loop: net 6h exceeds the 4h standard');

    // --- 10. Yêu cầu bổ sung nhập tay (quy trình cũ) trên công đoạn PA1: khoảng dừng đóng khi hoàn tất ---
    const free = await newLoan(vn('2026-10-27', '09:00'));
    const freeSupp = await supplements.createSupplementRequest(free.id, { requestContent: 'Synthetic free text' }, cbtd.id, 'CBTD', vn('2026-10-27', '10:00'));
    eq((await openPauses(free.id)).length, 1, 'free-text supplement on a PA1 stage opens a pause');
    await supplements.resolveSupplementRequest(freeSupp.id, {}, cbtd.id, 'CBTD', vn('2026-10-27', '15:00'));
    eq((await openPauses(free.id)).length, 0, 'resolving closes the pause');
    await toAppraisal(free, vn('2026-10-27', '17:00'));
    rows = await history(free.id);
    // Mở 09:00, đóng 17:00 cùng ngày: 7 giờ làm việc; dừng 10:00-15:00 = 2 + 2 = 4; ròng 3.
    near(stage(rows, 'TIEP_NHAN').actualDurationHours, 7, 'free-text supplement: working hours in the stage');
    near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 3, 'free-text supplement: 7 working hours minus 4 paused');
    near(stage(rows, 'TIEP_NHAN').pausedDurationHours, 4, 'free-text supplement: paused working hours');

    // --- 11. Công đoạn cũ giữ cách tính cũ kể cả khi có bổ sung đang mở sau T0 ---
    const old = await newLoan(vn('2026-10-21', '09:00'));
    eq((await history(old.id))[0].slaPolicy, null, 'old loan stage is legacy');
    const oldSupp = await supplements.createSupplementRequest(old.id, { requestContent: 'Synthetic legacy supplement' }, cbtd.id, 'CBTD', vn('2026-10-28', '10:00'));
    eq((await pausesOf(old.id)).length, 0, 'a legacy stage gets no PA1 pause rows');
    await supplements.resolveSupplementRequest(oldSupp.id, {}, cbtd.id, 'CBTD', vn('2026-10-28', '12:00'));
    await toAppraisal(old, vn('2026-10-28', '17:00'));
    rows = await history(old.id);
    near(stage(rows, 'TIEP_NHAN').actualDurationHours, 176, 'legacy stage: real 24/7 hours (7 days + 8h)');
    near(stage(rows, 'TIEP_NHAN').pausedDurationHours, 2, 'legacy stage: paused real hours unchanged');
    near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 174, 'legacy stage: net real hours');

    // --- 12. C.9.5(4) nhắc/quá hạn theo bên đang chờ, và đóng quá hạn ---
    const bank = await newLoan(vn('2026-10-26', '09:00'));
    const bankPortal = await portalFor(bank);
    const bankSupp = await createStructured(bank, vn('2026-10-26', '10:00'), 1);
    const bankFile = await upload(bankPortal, bankSupp.id, bankSupp.items[0].id, 'bank-wait');
    await respondAll(bankPortal, bankSupp.id, [bankFile.id], vn('2026-10-27', '10:00'));
    const late = await newLoan(vn('2026-10-26', '09:00'));
    await portalFor(late);
    const lateSupp = await createStructured(late, vn('2026-10-26', '10:00'), 1);
    eq(emailsSent, 0, 'no reminder email before the scan');
    // Mốc nhắc ngày 5 rơi Thứ Bảy 31/10 nên lùi sang Thứ Hai 02/11 10:00; quá hạn ngày 10 là Thứ Năm 05/11 10:00.
    let scan = await reminders.scan(vn('2026-11-02', '11:00'));
    eq(scan.reminded, 1, 'day 5: only the request still waiting for the enterprise is reminded');
    eq(scan.overdue, 0, 'day 5: nothing overdue yet');
    scan = await reminders.scan(vn('2026-11-05', '11:00'));
    eq(scan.overdue, 1, 'day 10: only the request still waiting for the enterprise is overdue');
    eq((await db.supplementRequest.findUnique({ where: { id: bankSupp.id } })).overdueAt, null, 'bank-waiting request is never marked overdue');
    ok((await db.supplementRequest.findUnique({ where: { id: lateSupp.id } })).overdueAt, 'enterprise-waiting request is marked overdue');
    await assert.rejects(workflow.closeOverdueSupplement(bank.id, { reason: 'Synthetic' }, asManager, vn('2026-11-05', '12:00')),
      e => e.getStatus() === 400 && /chưa quá hạn/.test(e.message)); checks++;
    eq((await db.loanApplication.findUnique({ where: { id: bank.id } })).currentStatus, 'SUPPLEMENT_REQUIRED', 'bank-waiting loan is not closed');
    const closed = await workflow.closeOverdueSupplement(late.id, { reason: 'Synthetic no response' }, asManager, vn('2026-11-05', '11:00'));
    eq(closed.currentStatus, 'CLOSED_TIMEOUT', 'manager closes the enterprise-overdue loan');
    rows = await history(late.id);
    near(stage(rows, 'TIEP_NHAN').actualDurationHours, 58, 'closed overdue: working hours 26/10 09:00 -> 05/11 11:00');
    near(stage(rows, 'TIEP_NHAN').netWorkDurationHours, 1, 'closed overdue: only 09:00-10:00 before the request counts');
    eq(stage(rows, 'TIEP_NHAN').isDelayed, false, 'closed overdue: 1h net is within the standard');
    eq((await openPauses(late.id)).length, 0, 'closing ends the open pause');
    eq(stage(rows, 'HOAN_TAT').slaPolicy, 'PA1', 'terminal row of the closed loan records the policy');

    // ===== Chứng từ đổi sau khi đã xác nhận đủ: hủy xác nhận (giao dịch thật) =====
    const { DocumentsService } = require('../dist/modules/documents/documents.service');
    const documentsService = app.get(DocumentsService, { strict: false });
    const confirmed = await newLoan(vn('2026-10-27', '09:00'));
    await loans.checkDocuments(confirmed.id, true);
    let state = await db.loanApplication.findUnique({ where: { id: confirmed.id } });
    eq(state.currentStatus, 'CHECKED', 'documents: loan confirmed complete');
    const addedDoc = await documentsService.create(confirmed.id, { documentType: 'PHAP_LY', fileName: 'synthetic.pdf', fileSize: 10, mimeType: 'application/pdf', filePath: 'seed/synthetic.pdf' }, cbtd.id);
    state = await db.loanApplication.findUnique({ where: { id: confirmed.id } });
    eq(state.isDocumentComplete, false, 'documents: adding a document withdraws the confirmation');
    eq(state.currentStatus, 'RECEIVED', 'documents: loan returns to RECEIVED after a document change');
    await assert.rejects(workflow.transitionStage(confirmed.id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, asCbtd(cbtd), vn('2026-10-27', '12:00')), e => e.getStatus() === 400); checks++;
    await loans.checkDocuments(confirmed.id, true);
    await documentsService.delete(addedDoc.id);
    state = await db.loanApplication.findUnique({ where: { id: confirmed.id } });
    eq(state.isDocumentComplete, false, 'documents: deleting a document withdraws the confirmation');
    eq(await db.document.count({ where: { id: addedDoc.id } }), 0, 'documents: the document was removed');
    await loans.checkDocuments(confirmed.id, true);
    await toAppraisal(confirmed, vn('2026-10-27', '12:00')).catch(() => null);
    eq((await db.loanApplication.findUnique({ where: { id: confirmed.id } })).currentStage, 'THAM_DINH', 'documents: after confirming again the loan moves on');
    const lateDoc = await documentsService.create(confirmed.id, { documentType: 'KHAC', fileName: 'late.pdf', fileSize: 10, mimeType: 'application/pdf', filePath: 'seed/late.pdf' }, approver.id);
    state = await db.loanApplication.findUnique({ where: { id: confirmed.id } });
    eq(state.currentStatus, 'PENDING_APPRAISAL', 'documents: a document added at appraisal does not touch the loan status');
    ok(lateDoc.id, 'documents: appraisal-stage document stored');

    // ===== Mốc 3: hiển thị, Dashboard, dự báo =====
    const { DashboardService } = require('../dist/modules/dashboard/dashboard.service');
    const { PredictionService } = require('../dist/modules/prediction/prediction.service');
    const dashboardService = app.get(DashboardService, { strict: false });
    const predictionService = app.get(PredictionService, { strict: false });

    // --- 13. Quy tắc ML: bỏ qua khi công đoạn Tiếp nhận tính theo PA1; giữ nguyên khi tính theo cách cũ ---
    eq(await db.delayPrediction.count({ where: { applicationId: loop.id } }), 0, 'PA1 loan: no prediction was ever stored (ML skipped after transition and resolve)');
    const skipped = await predictionService.predictForApplication(loop.id);
    eq(skipped.unavailable, true, 'PA1 loan: manual prediction reports unavailable');
    eq(skipped.reason, 'PA1_INCOMPATIBLE', 'PA1 loan: manual prediction names the reason');
    eq(await db.delayPrediction.count({ where: { applicationId: loop.id } }), 0, 'PA1 loan: manual prediction stores nothing');
    ok(await db.delayPrediction.count({ where: { applicationId: old.id } }) >= 1, 'legacy-first loan keeps getting real predictions (ML service)');

    // --- 14. Chi tiết hồ sơ: trạng thái SLA và số giờ đang chạy ---
    const loopView = await loans.findOne(loop.id, vn('2026-10-28', '15:00'));
    eq(loopView.predictionStatus, 'INCOMPATIBLE_PA1', 'detail: prediction status for a PA1 loan');
    eq(loopView.slaState.policy, 'PA1', 'detail: open appraisal stage uses PA1');
    eq(loopView.slaState.waiting, null, 'detail: nobody is waited for outside a supplement');
    near(loopView.liveSla.actualDurationHours, 2, 'detail: live working hours since 12:00 (13:00-15:00)');
    const oldView = await loans.findOne(old.id, vn('2026-10-28', '18:00'));
    eq(oldView.predictionStatus, 'AVAILABLE', 'detail: legacy-first loan has a real prediction');
    eq(oldView.stageHistories[0].slaPolicy, null, 'detail: closed legacy stage still reads as legacy');
    const waiting = await newLoan(vn('2026-11-02', '09:00'));
    await portalFor(waiting);
    await createStructured(waiting, vn('2026-11-02', '10:00'), 1);
    const waitingView = await loans.findOne(waiting.id, vn('2026-11-02', '11:00'));
    eq(waitingView.slaState.waiting, 'ENTERPRISE', 'detail: PA1 loan with an open pause waits for the enterprise');
    eq(waitingView.slaState.slaRunning, false, 'detail: the SLA clock is stopped while the enterprise is waited for');
    near(waitingView.liveSla.actualDurationHours, 2, 'detail: live working hours in the stage');
    near(waitingView.liveSla.pausedDurationHours, 1, 'detail: live paused hours');
    near(waitingView.liveSla.netWorkDurationHours, 1, 'detail: live net hours');
    const bankView = await loans.findOne(bank.id, vn('2026-11-05', '12:00'));
    eq(bankView.slaState.waiting, 'BANK', 'detail: fully answered supplement means the bank is checking');
    eq(bankView.slaState.slaRunning, true, 'detail: the SLA clock runs while the bank checks');
    const outside = await loans.findOne(bank.id, vn('2026-11-12', '12:00'));
    ok(/không bao phủ/.test(outside.liveSla.error), 'detail: outside the calendar a message is shown instead of a number');

    // --- 15. Dashboard: tách số liệu cách cũ và PA1; không bịa dự báo; danh sách quá hạn có bên đang chờ ---
    const overview = await dashboardService.getOverviewStats();
    const exited = await db.applicationStageHistory.findMany({ where: { exitedAt: { not: null } }, select: { slaPolicy: true, isDelayed: true } });
    const legacyRows = exited.filter(r => r.slaPolicy === null), pa1Rows = exited.filter(r => r.slaPolicy === 'PA1');
    eq(overview.totalCompletedStages, legacyRows.length, 'overview: legacy counters exclude PA1 stages');
    eq(overview.totalCompletedStagesPa1, pa1Rows.length, 'overview: PA1 stages are counted separately');
    eq(overview.delayedStagesPa1, pa1Rows.filter(r => r.isDelayed).length, 'overview: PA1 delayed stages');
    ok(pa1Rows.length > 0 && typeof overview.slaOnTimeRatePa1 === 'number', 'overview: PA1 on-time rate is reported');
    const bottlenecks = await dashboardService.getSlaBottleneckAnalysis();
    const reception = bottlenecks.find(b => b.stageCode === 'TIEP_NHAN');
    const receptionRows = await db.applicationStageHistory.findMany({ where: { exitedAt: { not: null }, stage: { stageCode: 'TIEP_NHAN' } }, select: { slaPolicy: true } });
    eq(reception.totalHandled, receptionRows.filter(r => r.slaPolicy === null).length, 'bottleneck: legacy figures exclude PA1');
    eq(reception.pa1.totalHandled, receptionRows.filter(r => r.slaPolicy === 'PA1').length, 'bottleneck: PA1 figures are separate');
    const warnings = await dashboardService.getEarlyWarningList();
    const waitingWarning = warnings.find(w => w.id === waiting.id);
    eq(waitingWarning.riskLevel, null, 'early warning: no invented risk level');
    eq(waitingWarning.delayProbability, null, 'early warning: no invented probability');
    eq(waitingWarning.predictionStatus, 'INCOMPATIBLE_PA1', 'early warning: names the PA1 reason');
    await db.supplementRequest.update({ where: { id: bankSupp.id }, data: { overdueAt: vn('2026-11-05', '10:00') } }); // dấu vết quá hạn đã ghi trước khi doanh nghiệp gửi đủ
    const overdueList = await dashboardService.getOverdueSupplements(vn('2026-11-06', '10:00'));
    eq(overdueList.find(item => item.id === bankSupp.id).waitingOn, 'BANK', 'overdue list: shows the bank is the party waited for');
  } finally {
    const created = (await fsp.readdir(uploadDir).catch(() => [])).filter(f => !uploadsBefore.has(f));
    for (const file of created) { if (/^[0-9a-f-]{36}$/i.test(file)) await fsp.unlink(path.join(uploadDir, file)).catch(() => undefined); }
    if (!uploadsDirExisted) await fsp.rmdir(uploadDir).catch(() => undefined);
  }

  // 8. SQL nâng cấp: giữ nguyên dữ liệu cũ, chạy lặp được, và chặn hai khoảng dừng cùng mở.
  const snapshot = async () => JSON.stringify(await db.$queryRawUnsafe(`SELECT to_jsonb(h) - 'sla_policy' - 'sla_calendar_version' AS row FROM application_stage_history h ORDER BY id`));
  const legacyRows = await snapshot();
  ok(JSON.parse(legacyRows).length >= 10, 'fixture has stage history rows');
  await db.$executeRawUnsafe('DROP TABLE application_stage_pauses');
  await db.$executeRawUnsafe('DROP TABLE sla_policy_activations');
  await db.$executeRawUnsafe('ALTER TABLE application_stage_history DROP COLUMN sla_policy, DROP COLUMN sla_calendar_version');
  for (let repeat = 0; repeat < 2; repeat++) applySlaSql();
  eq(await snapshot(), legacyRows, 'upgrade SQL keeps existing stage history data');
  const nulls = await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM application_stage_history WHERE sla_policy IS NOT NULL OR sla_calendar_version IS NOT NULL');
  eq(nulls[0].n, 0, 'upgraded rows read as legacy (null policy)');
  const target = (await history(legacy.id))[0].id;
  const insertPause = (ended) => db.$executeRawUnsafe(
    'INSERT INTO application_stage_pauses(id,history_id,started_at,ended_at,reason) VALUES ($1,$2,$3,$4,$5)', randomUUID(), target, vn('2026-10-27', '09:00'), ended, 'SYNTHETIC');
  await insertPause(null);
  await assert.rejects(insertPause(null), e => /23505|already exists|unique|duplicate/i.test(String(e.message))); checks++;
  await insertPause(vn('2026-10-27', '10:00'));
  eq((await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM application_stage_pauses WHERE history_id=$1', target))[0].n, 2, 'closed pauses can coexist with one open pause');

  return { pass: true, checks, schema: h.schema };
}

async function main() {
  let h;
  try {
    h = await startIsolated();
    console.log(JSON.stringify(await runChecks(h)));
  } finally {
    if (h) console.log(JSON.stringify({ cleanup: await h.close() }));
  }
}
if (require.main === module) main().catch(e => { console.error('SLA_PA1_FAILED:', e.message); process.exitCode = 1; });
module.exports = { runChecks };
