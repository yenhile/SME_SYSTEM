/* Dựng dữ liệu DEMO: 7 tài khoản mô phỏng + 194 hồ sơ trong quá khứ kèm lịch sử SLA (PA1) + dự báo cho hồ sơ đang mở.
 *
 * Chạy sau `npm run prisma:push`, `npm run prisma:seed` (seed bật PA1 và đặt định mức) và `npm run build`:
 *     npm run seed:demo            (thêm dữ liệu demo nếu chưa có)
 *     npm run seed:demo -- --reset (gỡ dữ liệu demo cũ rồi dựng lại)
 *
 * - Đây là dữ liệu MÔ PHỎNG, không phải dữ liệu thật và không dùng để huấn luyện mô hình.
 * - Giờ xử lý lấy từ backend/prisma/demo-cases.json (hồ sơ giả lập). Thời điểm vào/ra từng công đoạn tính bằng đúng hàm giờ làm việc
 *   của backend (lịch VN-2026), định mức SLA đọc từ bảng workflow_stages nên đổi định mức rồi chạy lại với --reset là khớp.
 * - Mật khẩu tài khoản mô phỏng: biến DEMO_PASSWORD; không đặt thì sinh ngẫu nhiên và in ra một lần. Không chạy khi NODE_ENV=production.
 * - Số giờ đã dùng của hồ sơ mở tính tại lúc chạy; đồng hồ SLA vẫn chạy tiếp nên TRƯỚC MỖI BUỔI DEMO chạy lại `npm run seed:demo -- --reset`.
 * - Công ty demo có taxCode bắt đầu bằng DEMO. Gỡ thủ công:
 *     DELETE FROM loan_applications WHERE company_id IN (SELECT id FROM companies WHERE tax_code LIKE 'DEMO%');
 *     DELETE FROM companies WHERE tax_code LIKE 'DEMO%';
 *   (tài khoản mô phỏng không bị gỡ bởi --reset; tắt/xóa trong màn quản trị người dùng nếu cần)
 * - Lịch 2026 kết thúc 31/12/2026: chạy sau ngày đó cần lịch mới.
 */
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');
const DIST = path.resolve(__dirname, '..', 'dist');
const { AppModule } = require(path.join(DIST, 'app.module'));
const { PrismaService } = require(path.join(DIST, 'prisma.service'));
const { UsersService } = require(path.join(DIST, 'modules/users/users.service'));
const { PredictionService } = require(path.join(DIST, 'modules/prediction/prediction.service'));
const { calendarByVersion, computeStageClosing } = require(path.join(DIST, 'modules/workflow/sla/sla-policy'));
const { workingDeadline, workingHoursBetween } = require(path.join(DIST, 'modules/workflow/sla/working-time'));
const { BRANCH_POLICY } = require(path.join(DIST, 'modules/workflow/loan-policy'));
const { reportEvidence, digest } = require(path.join(DIST, 'modules/appraisal/appraisal.logic'));

const CAL_VERSION = 'VN-20260101-20261231-v1';
const cal = calendarByVersion(CAL_VERSION);
const NOW = new Date();
const H = 3600000;
const RESET = process.argv.includes('--reset');
if (process.env.NODE_ENV === 'production') { console.error('seed:demo không chạy trên môi trường production.'); process.exit(1); }
// Mật khẩu lấy từ DEMO_PASSWORD; không đặt thì sinh ngẫu nhiên và in ra một lần (không ghi cố định trong mã nguồn/tài liệu).
const GENERATED_PASSWORD = !process.env.DEMO_PASSWORD;
const PASSWORD = process.env.DEMO_PASSWORD || require('node:crypto').randomBytes(9).toString('base64url') + 'aA1';
const N_DONE = 179;   // + 15 hồ sơ đang mở = 194

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261107);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + (b - a) * rnd();

const ACCOUNTS = [
  ['khoa.tran', 'Trần Minh Khoa', ['ADMIN']], ['nhung.nguyen', 'Nguyễn Thị Hồng Nhung', ['QUAN_LY']],
  ['ha.le', 'Lê Thị Thu Hà', ['THAM_QUYEN']], ['huy.vu', 'Vũ Quang Huy', ['THAM_QUYEN']],
  ['nam.hoang', 'Hoàng Văn Nam', ['CBTD']], ['mai.bui', 'Bùi Thị Mai', ['CBTD']], ['thanh.ngo', 'Ngô Đức Thành', ['CBTD']],
];
const CBTD = ['nam.hoang', 'mai.bui', 'thanh.ngo'];
const OPEN_POOL = ['thanh.ngo', 'mai.bui', 'nam.hoang'];   // mỗi CBTD đang dùng có ít nhất một hồ sơ Tiếp nhận mở
const TQ = ['ha.le', 'huy.vu'];                              // 2 Thẩm quyền, khớp giá trị điển hình mô hình đã học
const W1 = ['Hòa Bình', 'Thành Đạt', 'Minh Phát', 'An Khang', 'Tân Phú', 'Đại Việt', 'Phú Gia', 'Hưng Thịnh', 'Bảo Long', 'Á Châu', 'Việt Tiến', 'Nam Sơn', 'Sao Mai', 'Hải Đăng', 'Kim Long', 'Trường An', 'Thiên Phúc', 'Lộc Phát', 'Quang Minh', 'Đông Dương'];
const W2 = ['Thực phẩm', 'Cơ khí', 'Xây dựng', 'Vận tải', 'Nội thất', 'Dệt may', 'Thương mại', 'Dịch vụ', 'Nông sản', 'Bao bì', 'Điện tử', 'Logistics', 'Vật liệu', 'Thủy sản'];
const WORDS_BY_INDUSTRY = { 'Sản xuất': ['Cơ khí', 'Bao bì', 'Dệt may', 'Nội thất', 'Vật liệu', 'Điện tử'], 'Chế biến thực phẩm': ['Thực phẩm', 'Thủy sản', 'Nông sản'], 'Cơ khí': ['Cơ khí', 'Vật liệu'], 'Thương mại - Dịch vụ': ['Thương mại', 'Dịch vụ'], 'Nông nghiệp': ['Nông sản', 'Thủy sản'], 'Vận tải kho bãi': ['Vận tải', 'Logistics'], 'Xây dựng': ['Xây dựng', 'Vật liệu'] };
const REPRESENTATIVES = ['Nguyễn Văn An', 'Trần Thị Bích', 'Lê Quốc Cường', 'Phạm Thị Dung', 'Hoàng Minh Đức', 'Vũ Thị Giang', 'Đặng Văn Hải', 'Bùi Thị Hương', 'Ngô Quang Khải', 'Đỗ Thị Lan', 'Phan Văn Minh', 'Trịnh Thị Ngọc'];
const ADDRESSES = ['Quận 1, TP.HCM', 'Quận 3, TP.HCM', 'Quận 7, TP.HCM', 'Quận Bình Thạnh, TP.HCM', 'Quận Tân Bình, TP.HCM', 'TP. Thủ Đức, TP.HCM', 'Quận Gò Vấp, TP.HCM'];
const INDUSTRY = { SAN_XUAT: ['Sản xuất', 'Chế biến thực phẩm', 'Cơ khí'], THUONG_MAI: ['Thương mại - Dịch vụ', 'Nông nghiệp'], DICH_VU: ['Thương mại - Dịch vụ', 'Vận tải kho bãi'], KHAC: ['Xây dựng'] };
const REPORT = {
  legalAssessment: 'Doanh nghiệp có đăng ký kinh doanh hợp lệ, người đại diện đủ thẩm quyền ký hợp đồng tín dụng (hồ sơ mô phỏng).',
  businessAssessment: 'Hoạt động ổn định, đầu ra tương đối đều; không có biến động lớn về khách hàng chính (hồ sơ mô phỏng).',
  financialAssessment: 'Doanh thu và lợi nhuận ba kỳ gần nhất tăng nhẹ; tỷ lệ nợ trên vốn chủ sở hữu trong ngưỡng chấp nhận (hồ sơ mô phỏng).',
  repaymentSource: 'Nguồn trả nợ chính từ doanh thu bán hàng; dòng tiền đủ bù đắp nghĩa vụ trả nợ gốc và lãi (hồ sơ mô phỏng).',
  collateralAssessment: 'Tài sản bảo đảm đề xuất có giá trị phù hợp; cần định giá lại trước giải ngân (hồ sơ mô phỏng).',
  risks: 'Rủi ro biến động giá nguyên vật liệu và chậm thu hồi công nợ (hồ sơ mô phỏng).',
  recommendation: 'Đề nghị cấp tín dụng theo hạn mức chính thức, kèm điều kiện giám sát dòng tiền (hồ sơ mô phỏng).',
  proposedConditions: 'Giải ngân theo tiến độ; báo cáo tài chính định kỳ hằng quý.',
};
const REJECT = [['TC01', 'Hồ sơ pháp lý chưa đáp ứng điều kiện vay'], ['TC02', 'Năng lực tài chính chưa đáp ứng'], ['TC03', 'Phương án sử dụng vốn chưa khả thi'], ['TC04', 'Tài sản bảo đảm chưa phù hợp'], ['TC05', 'Lịch sử tín dụng không đạt yêu cầu']];

// ---------- dòng thời gian (giờ làm việc) ----------
function planPauses(start, c, waits) {
  const pauses = [];
  for (let k = 0; k < c.rounds; k++) {
    const ps = workingDeadline(start, c.tn * (0.2 + 0.55 * (k / Math.max(1, c.rounds))), cal, pauses);
    pauses.push({ start: ps, end: workingDeadline(ps, waits[k], cal) });
  }
  return pauses;
}
function forward(start, c, waits) {
  const pauses = planPauses(start, c, waits);
  const tnExit = workingDeadline(start, c.tn, cal, pauses);
  return { start, pauses, tnExit, tdEnter: tnExit, tdExit: workingDeadline(tnExit, c.td, cal) };
}
const splitWaits = (c) => {
  if (!c.rounds) return [];
  const w = Array.from({ length: c.rounds }, () => 0.5 + rnd()); const s = w.reduce((a, b) => a + b, 0);
  return w.map(x => Math.max(1, c.wait * x / s));
};
function solveStart(g, target) {   // g giảm dần theo thời điểm bắt đầu
  let lo = NOW.getTime() - 200 * 24 * H, hi = NOW.getTime();
  for (let i = 0; i < 48; i++) { const mid = Math.floor((lo + hi) / 2); if (g(new Date(mid)) > target) lo = mid; else hi = mid; }
  return new Date(hi);
}
function randomWorkStart(from, to) {
  for (let i = 0; i < 300; i++) {
    const d = new Date(from.getTime() + rnd() * (to.getTime() - from.getTime()));
    const day = new Date(d); day.setUTCHours(1, 0, 0, 0);   // 08:00 giờ Việt Nam
    if (workingHoursBetween(day, new Date(day.getTime() + 9 * H), cal) >= 7) return new Date(day.getTime() + Math.floor(between(0, 8)) * H + Math.floor(rnd() * 60) * 60000);
  }
  throw new Error('không tìm được ngày làm việc');
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'prisma', 'demo-cases.json'), 'utf8'));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const db = app.get(PrismaService, { strict: false });
  const usersService = app.get(UsersService, { strict: false });
  const prediction = app.get(PredictionService, { strict: false });

  // ----- điều kiện cần -----
  const stageRows = await db.workflowStage.findMany({ where: { stageCode: { in: ['TIEP_NHAN', 'THAM_DINH', 'HOAN_TAT'] } } });
  const stage = Object.fromEntries(stageRows.map(s => [s.stageCode, s]));
  if (!stage.TIEP_NHAN || !stage.THAM_DINH || !stage.HOAN_TAT) throw new Error('Chưa có công đoạn; chạy npm run prisma:seed trước.');
  const activation = await db.slaPolicyActivation.findFirst({ where: { policyCode: 'PA1', calendarVersion: CAL_VERSION } });
  if (!activation) throw new Error('PA1 chưa được kích hoạt với lịch ' + CAL_VERSION + '; chạy npm run prisma:seed trước.');
  const SLA = { TIEP_NHAN: stage.TIEP_NHAN.standardSlaHours, THAM_DINH: stage.THAM_DINH.standardSlaHours, HOAN_TAT: stage.HOAN_TAT.standardSlaHours };

  const existing = await db.company.count({ where: { taxCode: { startsWith: 'DEMO' } } });
  if (existing && !RESET) { console.log(`Đã có ${existing} công ty demo; bỏ qua. Dùng --reset để dựng lại.`); await app.close(); return; }
  if (existing) {
    await db.loanApplication.deleteMany({ where: { company: { taxCode: { startsWith: 'DEMO' } } } });
    await db.company.deleteMany({ where: { taxCode: { startsWith: 'DEMO' } } });
    console.log(`Đã gỡ dữ liệu demo cũ (${existing} công ty).`);
  }

  // ----- tài khoản -----
  let madeUsers = 0;
  for (const [username, fullName, roles] of ACCOUNTS) {
    if (await db.user.findUnique({ where: { username } })) continue;
    await usersService.create({ username, password: PASSWORD, fullName, email: `${username}@sme-demo.example`, branchName: 'Chi nhánh TP.HCM', roles });
    madeUsers++;
  }
  const users = Object.fromEntries((await db.user.findMany({ where: { username: { in: [...OPEN_POOL, ...TQ] } } })).map(u => [u.username, u.id]));

  // ----- kế hoạch hồ sơ: định mức mở theo tỷ lệ so với SLA hiện hành -----
  const tn = SLA.TIEP_NHAN, td = SLA.THAM_DINH;
  const open = [
    ['TN', 0.08 * tn, 'RECEIVED'], ['TN', 0.15 * tn, 'CHECKED'], ['TN', 0.26 * tn, 'CHECKED'], ['TN', 0.55 * tn, 'RECEIVED'], ['TN', 0.88 * tn, 'CHECKED'], ['TN', 0.96 * tn, 'RECEIVED'],
    ['TN_WAIT', 0.38 * tn, 'SUPPLEMENT_REQUIRED'], ['TN_WAIT', 0.65 * tn, 'SUPPLEMENT_REQUIRED'],
    ['TD', 0.08 * td, 'PENDING_APPRAISAL'], ['TD', 0.28 * td, 'PENDING_APPRAISAL'], ['TD', 0.48 * td, 'PENDING_APPRAISAL'], ['TD', 0.74 * td, 'PENDING_APPRAISAL'],
    ['TD', 0.83 * td, 'PENDING_APPRAISAL'], ['TD', 0.95 * td, 'PENDING_APPRAISAL'], ['TD', 1.1 * td, 'PENDING_APPRAISAL'],
  ];
  const plan = [
    ...fixture.slice(0, N_DONE).map(c => ({ c, kind: 'DONE' })),
    ...open.map(([kind, elapsed, status], i) => ({ c: fixture[N_DONE + i], kind, elapsed, status })),
  ];

  let companySeq = 100000, created = 0, tnRound = 0, tdRound = 0;
  const codeSeq = {}, openIds = [];
  const base = { slaPolicy: 'PA1', slaCalendarVersion: CAL_VERSION };
  for (const item of plan) {
    const { c, kind } = item;
    let tl;
    if (kind === 'DONE') {
      for (let t = 0; t < 60 && !tl; t++) {
        const cand = forward(randomWorkStart(new Date('2026-01-12T01:00:00Z'), new Date(NOW.getTime() - 25 * 24 * H)), c, splitWaits(c));
        if (cand.tdExit.getTime() < NOW.getTime() - 2 * 24 * H) tl = cand;
      }
      if (!tl) continue;
    } else if (kind === 'TN') {
      tl = { start: solveStart((s) => workingHoursBetween(s, NOW, cal), item.elapsed), pauses: [] };
    } else if (kind === 'TN_WAIT') {
      const P = new Date(NOW.getTime() - between(26, 60) * H);
      tl = { start: solveStart((s) => workingHoursBetween(s, P, cal), item.elapsed), pauses: [{ start: P, end: null }] };
    } else {
      const cc = { ...c, rounds: Math.min(c.rounds, 1) }, w = splitWaits(cc);
      tl = forward(solveStart((s) => workingHoursBetween(forward(s, cc, w).tdEnter, NOW, cal), item.elapsed), cc, w);
    }

    const owner = kind === 'DONE' ? pick(CBTD) : (kind === 'TD' ? OPEN_POOL[tdRound++ % OPEN_POOL.length] : OPEN_POOL[tnRound++ % OPEN_POOL.length]);
    const cbtd = owner, tq = pick(TQ.filter(x => x !== cbtd));
    const day = tl.start.toISOString().slice(0, 10).replace(/-/g, '');
    codeSeq[day] = (codeSeq[day] || 8000) + 1;
    const industry = pick(INDUSTRY[c.scope] || INDUSTRY.KHAC);
    const company = await db.company.create({ data: {
      taxCode: 'DEMO' + String(++companySeq), companyName: `Công ty TNHH ${pick(WORDS_BY_INDUSTRY[industry])} ${pick(W1)}`, industry,
      establishedYear: 2026 - c.years, annualRevenue: Math.round(c.revenue * 1e9), charterCapital: Math.round(c.revenue * 0.3e9),
      representativeName: pick(REPRESENTATIVES), phone: '09' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'), address: `${1 + Math.floor(rnd() * 200)} đường mô phỏng, ${pick(ADDRESSES)}`,
    } });
    const proposed = Math.round(c.amount * 1e9);
    const done = kind === 'DONE';
    const approved = done && rnd() < 0.78;
    const rej = pick(REJECT);
    const loan = await db.loanApplication.create({ data: {
      applicationCode: `SME-${day}-${codeSeq[day]}`, companyId: company.id, loanPurpose: pick(['Bổ sung vốn lưu động', 'Mua nguyên vật liệu', 'Mở rộng kho xưởng', 'Đầu tư máy móc thiết bị']),
      loanType: c.term >= 12 && c.amount > 3 ? 'VAY_DAU_TU_TSCD' : 'VAY_VON_LUU_DONG', proposedAmount: proposed, officialAmount: proposed, loanTermMonths: c.term,
      currentStage: done ? 'HOAN_TAT' : (kind === 'TD' ? 'THAM_DINH' : 'TIEP_NHAN'), currentStatus: done ? (approved ? 'APPROVED' : 'REJECTED') : item.status,
      assignedTo: users[cbtd], intakeOfficerId: users[cbtd], businessPolicyVersion: BRANCH_POLICY, isDocumentComplete: !done ? (item.status !== 'RECEIVED' && item.status !== 'SUPPLEMENT_REQUIRED') : true,
      supplementCount: kind === 'TN_WAIT' ? 1 : tl.pauses.length, createdAt: tl.start, completedAt: done ? tl.tdExit : null,
      ...(done && approved ? { approvedAmount: Math.round(proposed * between(0.8, 1)), interestRate: Math.round(between(7.5, 11.5) * 100) / 100 } : {}),
      ...(done && !approved ? { rejectionReasonCode: rej[0], rejectionNote: rej[1] } : {}),
    } });

    const closeStage = async (code, enteredAt, exitedAt, pauses, handledBy) => {
      const res = computeStageClosing({ enteredAt, pausedAt: null, pausedDurationHours: 0, slaStandardHours: SLA[code], ...base }, pauses, exitedAt);
      const h = await db.applicationStageHistory.create({ data: { applicationId: loan.id, stageId: stage[code].id, enteredAt, exitedAt, handledBy, slaStandardHours: SLA[code], ...base,
        actualDurationHours: res.actualDurationHours, pausedDurationHours: res.pausedDurationHours, netWorkDurationHours: res.netWorkDurationHours, isDelayed: res.isDelayed } });
      for (const p of pauses) await db.applicationStagePause.create({ data: { historyId: h.id, startedAt: p.start, endedAt: p.end, reason: 'Chờ doanh nghiệp bổ sung hồ sơ' } });
    };
    const supplements = async (pauses) => {
      for (const p of pauses) await db.supplementRequest.create({ data: { applicationId: loan.id, requestContent: 'Đề nghị doanh nghiệp bổ sung chứng từ còn thiếu', requestedBy: users[cbtd],
        requestedAt: p.start, deadlineAt: new Date(p.start.getTime() + 10 * 24 * H), resolvedAt: p.end, status: p.end ? 'RESOLVED' : 'PENDING' } });
    };
    if (done) {
      await closeStage('TIEP_NHAN', tl.start, tl.tnExit, tl.pauses, users[cbtd]); await supplements(tl.pauses);
      await closeStage('THAM_DINH', tl.tdEnter, tl.tdExit, [], users[tq]);
      await closeStage('HOAN_TAT', tl.tdExit, tl.tdExit, [], users[tq]);
    } else if (kind === 'TN' || kind === 'TN_WAIT') {
      const h = await db.applicationStageHistory.create({ data: { applicationId: loan.id, stageId: stage.TIEP_NHAN.id, enteredAt: tl.start, slaStandardHours: SLA.TIEP_NHAN, ...base,
        ...(kind === 'TN_WAIT' ? { pausedAt: tl.pauses[0].start } : {}) } });
      for (const p of tl.pauses) await db.applicationStagePause.create({ data: { historyId: h.id, startedAt: p.start, endedAt: p.end, reason: 'Chờ doanh nghiệp bổ sung hồ sơ' } });
      await supplements(tl.pauses);
    } else {
      await closeStage('TIEP_NHAN', tl.start, tl.tnExit, tl.pauses, users[cbtd]); await supplements(tl.pauses);
      await db.applicationStageHistory.create({ data: { applicationId: loan.id, stageId: stage.THAM_DINH.id, enteredAt: tl.tdEnter, slaStandardHours: SLA.THAM_DINH, ...base } });
      // Tờ trình đã trình cho Thẩm quyền; một hồ sơ đang chờ CBTD làm rõ để có đủ trạng thái.
      const clarifying = Math.abs(item.elapsed - 0.48 * td) < 1e-6;
      const fresh = await db.loanApplication.findUnique({ where: { id: loan.id } });
      const evidence = await reportEvidence(db, fresh);
      const report = await db.appraisalReport.create({ data: { applicationId: loan.id, status: clarifying ? 'CLARIFICATION_REQUIRED' : 'SUBMITTED', revision: clarifying ? 3 : 2, draft: REPORT,
        ...(clarifying ? { clarification: { message: 'Đề nghị làm rõ nguồn trả nợ và tình hình công nợ phải thu (hồ sơ mô phỏng).', actorId: users[tq], at: new Date().toISOString() } } : {}) } });
      await db.appraisalReportVersion.create({ data: { reportId: report.id, sequence: 1, content: REPORT, evidence, evidenceHash: digest(evidence), submittedBy: users[cbtd], submittedAt: tl.tdEnter } });
      await db.appraisalReportEvent.create({ data: { reportId: report.id, actorId: users[cbtd], kind: 'SUBMITTED', clientRequestId: 'demo-submit-' + loan.id, payloadHash: digest({ demo: loan.id }), payload: {}, createdAt: tl.tdEnter } });
      if (clarifying) await db.appraisalReportEvent.create({ data: { reportId: report.id, actorId: users[tq], kind: 'CLARIFICATION_REQUESTED', clientRequestId: 'demo-clarify-' + loan.id, payloadHash: digest({ demo: 'c' + loan.id }), payload: { message: 'Đề nghị làm rõ nguồn trả nợ và tình hình công nợ phải thu (hồ sơ mô phỏng).' }, createdAt: new Date(tl.tdEnter.getTime() + 0.6 * (NOW.getTime() - tl.tdEnter.getTime())) } });
    }
    if (!done) openIds.push(loan.id);
    created++;
  }

  let predicted = 0, skipped = 0;
  for (const id of openIds) {
    try { const r = await prediction.predictForApplication(id); r.unavailable ? skipped++ : predicted++; } catch { skipped++; }
  }
  if (madeUsers && GENERATED_PASSWORD) console.log(`Mật khẩu ${madeUsers} tài khoản mới (chỉ hiện lần này): ${PASSWORD}`);
  console.log(JSON.stringify({ sla: SLA, accountsCreated: madeUsers, casesCreated: created, openCases: openIds.length, predictions: predicted, predictionsSkipped: skipped,
    note: skipped ? 'Một số hồ sơ chưa có dự báo (ml-service chưa chạy?). Chạy lại dự báo sau từ màn hình hoặc đợi lượt chấm 08:00.' : undefined }, null, 1));
  await app.close();
}
main().catch(e => { console.error('seed-demo lỗi:', e.message || e); process.exit(1); });
