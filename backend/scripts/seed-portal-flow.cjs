/* Dựng hồ sơ mẫu ĐI QUA CỔNG DOANH NGHIỆP đến kết quả cuối cùng, chỉ bằng API của hệ thống đang chạy (không ghi thẳng DB).
 *
 *   DEMO_PASSWORD=<mật khẩu cán bộ> node scripts/seed-portal-flow.cjs
 *   API_URL (mặc định http://localhost:3001/api), MAILBOX_URL (mặc định http://localhost:8025)
 *
 * Yêu cầu: backend + ml-service + hộp thư nội bộ đang chạy, PORTAL_V2_ROLLOUT_ENABLED=true, đã chạy seed:demo (có 7 tài khoản cán bộ).
 * Mỗi lần chạy tạo thêm 3 doanh nghiệp mô phỏng (mã số thuế bắt đầu 99, tên có "[MÔ PHỎNG]") với 6 đề nghị ở các chặng khác nhau:
 *   1 được phê duyệt, 1 bị từ chối (TC02), 1 đang thẩm định, 1 đã tiếp nhận (đang kiểm tra), 1 chờ phân công, 1 bản nháp.
 * Đây là dữ liệu MÔ PHỎNG, tách khỏi bộ hồ sơ dùng huấn luyện mô hình. Không chạy khi NODE_ENV=production.
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PDFDocument } = require('pdf-lib');

if (process.env.NODE_ENV === 'production') { console.error('Không chạy trên production.'); process.exit(1); }
const API = process.env.API_URL || 'http://localhost:3001/api';
const MAIL = process.env.MAILBOX_URL || 'http://localhost:8025';
const STAFF_PASSWORD = process.env.DEMO_PASSWORD;
if (!STAFF_PASSWORD) { console.error('Cần đặt DEMO_PASSWORD (mật khẩu các tài khoản cán bộ).'); process.exit(1); }
const DN_PASSWORD = process.env.PORTAL_DEMO_PASSWORD || 'MoPhong#2026Dn';
const YEAR = String(new Date().getFullYear() - 1);
const RUN = Date.now().toString().slice(-6);

async function call(path, actor, body, method) {
  const headers = {};
  if (actor?.token) headers.Authorization = `Bearer ${actor.token}`;
  if (actor?.role) headers['X-Active-Role'] = actor.role;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(API + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers, body: payload, signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
function ok(res, label) {
  assert.ok(res.status >= 200 && res.status < 300, `${label}: HTTP ${res.status} ${JSON.stringify(res.data)?.slice(0, 300)}`);
  return res.data;
}
async function staff(username) {
  const data = ok(await call('/auth/login', {}, { username, password: STAFF_PASSWORD }), `đăng nhập ${username}`);
  const role = data.user?.roles?.[0] ?? data.roles?.[0];
  return { token: data.accessToken, role, id: data.user.id, name: data.user.fullName };
}
async function pdf(text) {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]).drawText(text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^ -~]/g, ""), { x: 20, y: 250 });
  return Buffer.from(await doc.save());
}
async function registerEnterprise(index, contactName) {
  const email = `mo.phong.${RUN}.${index}@example.test`;
  ok(await call('/portal/auth/register', {}, { email, password: DN_PASSWORD, contactName, phone: `09${RUN}${index}0`.slice(0, 11) }), 'đăng ký DN');
  let code;
  for (let i = 0; i < 20 && !code; i++) {
    await new Promise(r => setTimeout(r, 500));
    const list = await (await fetch(`${MAIL}/api/v1/messages`)).json();
    const mail = list.messages.find(m => m.To.some(t => t.Address === email));
    if (mail) code = ((await (await fetch(`${MAIL}/api/v1/message/${mail.ID}`)).json()).Text || '').match(/\b\d{6}\b/)?.[0];
  }
  assert.ok(code, `không thấy mã xác minh gửi tới ${email} trong hộp thư nội bộ`);
  ok(await call('/portal/auth/verify-email', {}, { email, code }), 'xác minh email');
  const login = ok(await call('/portal/auth/login', {}, { email, password: DN_PASSWORD }), 'đăng nhập DN');
  return { token: login.accessToken, email };
}
const COVERAGE = [
  ['A', ['A_BUSINESS_REGISTRATION', 'A_CHARTER', 'A_REPRESENTATIVE_AUTHORITY', 'A_REPRESENTATIVE_ID'].map(documentTypeCode => ({ documentTypeCode }))],
  ['B', [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: YEAR, components: ['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW_STATEMENT', 'NOTES'] }]],
  ['C', [{ documentTypeCode: 'C_PRODUCTION_PLAN' }, { documentTypeCode: 'C_PURCHASE_ORDER' }]],
  ['D', [{ documentTypeCode: 'D_LOAN_REQUEST' }, { documentTypeCode: 'D_CAPITAL_PLAN' }]],
];
async function createRequest(dn, spec, { submit }) {
  const data = {
    taxCode: spec.taxCode, companyName: spec.companyName, industry: spec.industry, establishedYear: spec.year,
    annualRevenue: spec.revenue, charterCapital: spec.capital, representativeName: spec.rep, phone: '0912345678', address: spec.address,
    loanPurpose: spec.purpose, loanType: 'VAY_VON_LUU_DONG', proposedAmount: spec.amount, loanTermMonths: spec.term,
    businessScope: 'MANUFACTURING', revenuePeriod: YEAR, representative: { mode: 'LEGAL_REPRESENTATIVE' },
    submissionDeclaration: { accepted: true, version: 'portal-enterprise-submission-v1' }, hasExistingDebt: false, collateral: { mode: 'NONE_REQUESTED' },
  };
  let req = ok(await call('/portal/requests', dn, { formVersion: 2, clientRequestId: randomUUID(), data }), 'tạo đề nghị');
  if (!submit) return req;
  const file = await pdf(`Chung tu mo phong ${spec.companyName}`);
  for (const [group, coverage] of COVERAGE) {
    const fd = new FormData();
    fd.append('documentGroup', group); fd.append('coverage', JSON.stringify(coverage)); fd.append('clientUploadId', randomUUID());
    fd.append('expectedRevision', String(req.revision)); fd.append('file', new Blob([file], { type: 'application/pdf' }), `mo-phong-${group}.pdf`);
    req = ok(await call(`/portal/requests/${req.id}/documents`, dn, fd), `tải nhóm ${group}`);
  }
  const finance = req.documents.find(d => d.documentGroup === 'B');
  req = ok(await call(`/portal/requests/${req.id}`, dn, { expectedRevision: req.revision, data: { ...req.data, annualRevenueBasis: { documentId: finance.id, fullYearCompleted: true } } }, 'PUT'), 'liên kết nguồn doanh thu');
  return ok(await call(`/portal/requests/${req.id}/submit`, dn, { expectedRevision: req.revision, documentIds: req.documents.map(d => d.id) }), 'gửi đề nghị');
}
async function assign(request, manager, officer) {
  const cur = ok(await call(`/portal-intakes/${request.id}`, manager), 'xem đề nghị');
  return ok(await call(`/portal-intakes/${request.id}/assign`, manager, {
    officerId: officer.id, expectedAssignedTo: null, expectedRevision: cur.revision, expectedAssignmentVersion: 0, clientRequestId: randomUUID(), note: 'Phân công kiểm tra tiếp nhận (hồ sơ mô phỏng)',
  }), 'phân công');
}
async function accept(request, officer) {
  const cycle = ok(await call(`/portal-intakes/${request.id}/intake-cycle`, officer), 'xem chu kỳ tiếp nhận');
  for (const item of cycle.checklist) {
    const cur = ok(await call(`/portal-intakes/${request.id}`, officer), 'xem đề nghị');
    ok(await call(`/portal-intakes/${request.id}/review`, officer, { submissionId: cycle.currentSubmissionId, itemId: item.id, decision: 'ACCEPTED', clientRequestId: randomUUID(), expectedRevision: cur.revision }), `duyệt ${item.id}`);
  }
  const cur = ok(await call(`/portal-intakes/${request.id}`, officer), 'xem đề nghị');
  const done = ok(await call(`/portal-intakes/${request.id}/accept`, officer, { submissionId: cycle.currentSubmissionId, confirmExistingCompany: true, confirmExistingCompanyFinancials: true, expectedRevision: cur.revision }), 'tiếp nhận');
  assert.ok(done.loanId, 'chưa tạo hồ sơ vay');
  return done.loanId;
}
async function submitAppraisal(loanId, officer, spec) {
  ok(await call(`/loan-applications/${loanId}/set-amount`, officer, { officialAmount: spec.amount }, 'PUT'), 'xác định hạn mức');
  ok(await call(`/loan-applications/${loanId}/check-documents`, officer, { isComplete: true }, 'PUT'), 'xác nhận đủ chứng từ');
  const content = {
    legalAssessment: 'Pháp lý doanh nghiệp đầy đủ, người đại diện đúng thẩm quyền (hồ sơ mô phỏng).',
    businessAssessment: `Hoạt động ổn định trong ngành ${spec.industry} từ năm ${spec.year} (hồ sơ mô phỏng).`,
    financialAssessment: 'Doanh thu và vốn điều lệ phù hợp quy mô khoản vay (hồ sơ mô phỏng).',
    repaymentSource: 'Dòng tiền từ hợp đồng đầu ra hiện có (hồ sơ mô phỏng).',
    collateralAssessment: 'Vay vốn lưu động, không yêu cầu tài sản bảo đảm.',
    risks: 'Rủi ro biến động giá nguyên vật liệu đầu vào.',
    recommendation: spec.recommend,
    proposedInterestRate: '8.5',
    proposedConditions: 'Giải ngân theo tiến độ đơn hàng và sao kê tài khoản định kỳ.',
  };
  ok(await call(`/appraisals/${loanId}/draft`, officer, { content, clientRequestId: randomUUID(), expectedRevision: 0 }, 'PUT'), 'lưu nháp tờ trình');
  const report = ok(await call(`/appraisals/${loanId}/submit`, officer, { content, clientRequestId: randomUUID(), expectedRevision: 1 }), 'trình tờ trình');
  return report.versions?.[0]?.id;
}
const spec = (n, over) => ({
  taxCode: `99${RUN}${n}0`.slice(0, 10), companyName: `[MÔ PHỎNG] Công ty ${over.name}`, industry: over.industry, year: over.year, revenue: over.revenue,
  capital: over.capital, rep: over.rep, address: over.address, purpose: over.purpose, amount: over.amount, term: 12, recommend: over.recommend || 'Đề xuất cấp hạn mức vốn lưu động.',
});

(async () => {
  const manager = await staff('nhung.nguyen'), cbtdA = await staff('nam.hoang'), cbtdB = await staff('mai.bui'), appraiser = await staff('ha.le');
  const a = spec(1, { name: 'TNHH Cơ khí Tân Hưng', industry: 'Cơ khí - Chế tạo', year: 2017, revenue: 6200000000, capital: 2500000000, rep: 'Nguyễn Văn Hưng', address: 'Quận 12, TP.HCM', purpose: 'Mua thép và vật tư gia công đơn hàng quý 1', amount: 1200000000, recommend: 'Đề xuất phê duyệt hạn mức 1,2 tỷ đồng, thời hạn 12 tháng.' });
  const b = spec(2, { name: 'Dệt may Bình Minh', industry: 'Dệt may', year: 2019, revenue: 3100000000, capital: 1200000000, rep: 'Trần Thị Minh', address: 'Quận Bình Tân, TP.HCM', purpose: 'Mua vải và phụ liệu cho đơn xuất khẩu', amount: 900000000, recommend: 'Đề xuất từ chối do dòng tiền chưa đáp ứng.' });
  const c = spec(3, { name: 'Bao bì Phát Đạt', industry: 'Bao bì', year: 2020, revenue: 4500000000, capital: 1800000000, rep: 'Lê Quốc Đạt', address: 'TP. Thủ Đức, TP.HCM', purpose: 'Bổ sung vốn lưu động mua giấy kraft', amount: 1500000000 });
  const d = spec(4, { name: 'Thực phẩm An Gia', industry: 'Chế biến thực phẩm', year: 2018, revenue: 5200000000, capital: 2000000000, rep: 'Phạm Thị Gia', address: 'Quận Gò Vấp, TP.HCM', purpose: 'Mua nguyên liệu chế biến theo mùa vụ', amount: 800000000 });

  const dn1 = await registerEnterprise(1, 'Nguyễn Văn Hưng'), dn2 = await registerEnterprise(2, 'Trần Thị Minh'), dn3 = await registerEnterprise(3, 'Lê Quốc Đạt');
  const log = [];

  // 1. Phê duyệt
  let r = await createRequest(dn1, a, { submit: true });
  await assign(r, manager, cbtdA);
  let loan = await accept(r, cbtdA);
  let versionId = await submitAppraisal(loan, cbtdA, a);
  ok(await call(`/workflow/${loan}/transition`, appraiser, { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', approvedAmount: 1000000000, interestRate: 8.5, reportVersionId: versionId, notes: 'Đồng ý phê duyệt theo tờ trình (hồ sơ mô phỏng).' }), 'phê duyệt');
  let st = ok(await call(`/portal/requests/${r.id}/status`, dn1), 'tiến độ'); assert.equal(st.status.code, 'APPROVED');
  log.push(`${r.reference}: ${st.status.label}`);

  // 2. Từ chối
  r = await createRequest(dn2, b, { submit: true });
  await assign(r, manager, cbtdB);
  loan = await accept(r, cbtdB);
  versionId = await submitAppraisal(loan, cbtdB, b);
  ok(await call(`/workflow/${loan}/transition`, appraiser, { targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: versionId, rejectionReasonCode: 'TC02', rejectionNote: 'Dòng tiền chưa đáp ứng điều kiện chính sách tín dụng (hồ sơ mô phỏng).' }), 'từ chối');
  st = ok(await call(`/portal/requests/${r.id}/status`, dn2), 'tiến độ'); assert.equal(st.status.code, 'REJECTED');
  log.push(`${r.reference}: ${st.status.label} — ${st.rejection?.label}`);

  // 3. Đang thẩm định
  r = await createRequest(dn3, c, { submit: true });
  await assign(r, manager, cbtdA);
  loan = await accept(r, cbtdA);
  await submitAppraisal(loan, cbtdA, c);
  st = ok(await call(`/portal/requests/${r.id}/status`, dn3), 'tiến độ'); log.push(`${r.reference}: ${st.status.label}`);

  // 4. Đã tiếp nhận, đang kiểm tra hồ sơ
  r = await createRequest(dn3, d, { submit: true });
  await assign(r, manager, cbtdB);
  await accept(r, cbtdB);
  st = ok(await call(`/portal/requests/${r.id}/status`, dn3), 'tiến độ'); log.push(`${r.reference}: ${st.status.label}`);

  // 5. Chờ phân công
  r = await createRequest(dn1, { ...c, taxCode: `98${RUN}50`.slice(0, 10), companyName: '[MÔ PHỎNG] Công ty TNHH Cơ khí Tân Hưng (đề nghị thứ hai)', amount: 600000000 }, { submit: true });
  log.push(`${r.reference}: chờ phân công`);

  // 6. Bản nháp
  r = await createRequest(dn2, { ...d, taxCode: `98${RUN}60`.slice(0, 10), companyName: '[MÔ PHỎNG] Công ty TNHH Dệt may Bình Minh (bản nháp)', amount: 400000000 }, { submit: false });
  log.push(`${r.reference}: bản nháp`);

  console.log(`Đã dựng ${log.length} đề nghị mô phỏng qua cổng doanh nghiệp:\n- ${log.join('\n- ')}`);
  console.log(`Doanh nghiệp đăng nhập cổng bằng: mo.phong.${RUN}.1 / .2 / .3 @example.test (mật khẩu: biến PORTAL_DEMO_PASSWORD hoặc giá trị mặc định trong script).`);
})().catch(e => { console.error('seed-portal-flow lỗi:', e.message || e); process.exit(1); });
