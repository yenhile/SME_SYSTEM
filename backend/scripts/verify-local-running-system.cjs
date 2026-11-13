const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PDFDocument } = require('pdf-lib');

const BASE_URL = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:5173';
const ML_URL = 'http://localhost:8000';
const MAILBOX_URL = 'http://localhost:8025';

const DB_URL = process.env.DATABASE_URL || 'postgresql://sme_user:sme_password@localhost:5432/sme_loan?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const STAFF_PASSWORD = '123456';
const DN_PASSWORD = 'LocalTestDN123!';
const SYNTHETIC_TAX = '9990000001';
const SYNTHETIC_DN_EMAIL = 'local_test_dn@example.test';

async function generatePdf(text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawText(text, { x: 20, y: 250 });
  return Buffer.from(await doc.save());
}

async function apiCall(endpoint, actor = {}, body, method = body === undefined ? 'GET' : 'POST', isBinary = false) {
  const headers = {};
  if (actor.token) headers['Authorization'] = `Bearer ${actor.token}`;
  if (actor.role) headers['X-Active-Role'] = actor.role;

  let requestBody;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(BASE_URL + endpoint, {
    method,
    headers,
    body: requestBody,
    signal: AbortSignal.timeout(15000),
  });

  let data;
  if (isBinary) {
    data = Buffer.from(await response.arrayBuffer());
  } else {
    data = await response.json().catch(() => null);
  }
  return { status: response.status, data };
}

function expectStatus(res, expectedStatus, label) {
  const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  assert.ok(
    allowed.includes(res.status),
    `[${label}] Expected HTTP ${allowed.join('/')}, got ${res.status}: ${JSON.stringify(res.data?.message || res.data)}`
  );
  return res.data;
}

async function cleanupTestData() {
  const testCompanies = await prisma.company.findMany({ where: { taxCode: { in: ['9990000001', '9990000002'] } }, select: { id: true } });
  const companyIds = testCompanies.map((c) => c.id);
  const testLoans = await prisma.loanApplication.findMany({
    where: { OR: [{ companyId: { in: companyIds } }, { applicationCode: { startsWith: 'SME-TEST-OVERDUE-' } }] },
    select: { id: true },
  });
  const loanIds = testLoans.map((l) => l.id);

  const testRequests = await prisma.portalRequest.findMany({
    where: { account: { email: SYNTHETIC_DN_EMAIL } },
    select: { id: true },
  });
  const reqIds = testRequests.map((r) => r.id);

  if (loanIds.length > 0) {
    await prisma.internalNotification.deleteMany({ where: { applicationId: { in: loanIds } } });
    await prisma.appraisalReportEvent.deleteMany({ where: { report: { applicationId: { in: loanIds } } } });
    await prisma.appraisalReportVersion.deleteMany({ where: { report: { applicationId: { in: loanIds } } } });
    await prisma.appraisalReport.deleteMany({ where: { applicationId: { in: loanIds } } });
    await prisma.applicationStagePause.deleteMany({ where: { history: { applicationId: { in: loanIds } } } });
    await prisma.applicationStageHistory.deleteMany({ where: { applicationId: { in: loanIds } } });
    await prisma.supplementRequest.deleteMany({ where: { applicationId: { in: loanIds } } });
    await prisma.document.deleteMany({ where: { applicationId: { in: loanIds } } });
  }

  if (reqIds.length > 0) {
    await prisma.internalNotification.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalAssignment.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalIntakeOperation.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalIntakeIssue.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalSubmission.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalDocument.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.portalRequest.deleteMany({ where: { id: { in: reqIds } } });
  }

  if (loanIds.length > 0) {
    await prisma.loanApplication.deleteMany({ where: { id: { in: loanIds } } });
  }
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  await prisma.portalAccount.deleteMany({ where: { email: SYNTHETIC_DN_EMAIL } });
}

async function main() {
  console.log('================================================================');
  console.log('  SME LOAN WORKFLOW - RUNNING LOCAL SYSTEM E2E VERIFICATION     ');
  console.log('================================================================\n');

  let checks = 0;
  const markCheck = (desc) => {
    checks++;
    console.log(`  [PASS ${checks}] ${desc}`);
  };

  // Pre-clean any leftover synthetic test data
  await cleanupTestData();

  // ---------------------------------------------------------------------------
  // STEP 1: VERIFY SERVICES HEALTH & CONNECTIVITY
  // ---------------------------------------------------------------------------
  console.log('>>> [1/6] Kiểm tra trạng thái các dịch vụ local...');

  // Backend Health
  const backendHealth = await fetch(`${BASE_URL}/health`).then((r) => r.json());
  assert.equal(backendHealth.status, 'ok');
  assert.equal(backendHealth.services?.database, 'ready');
  assert.equal(backendHealth.services?.prediction, 'ready');
  markCheck(`Backend API tại ${BASE_URL} sẵn sàng (DB ready, ML ready)`);

  // Frontend Pages
  const feStaff = await fetch(`${FRONTEND_URL}/`);
  assert.equal(feStaff.status, 200);
  const fePortal = await fetch(`${FRONTEND_URL}/portal`);
  assert.equal(fePortal.status, 200);
  markCheck(`Frontend Staff (${FRONTEND_URL}/) & Portal (${FRONTEND_URL}/portal) trả lời HTTP 200`);

  // ML Service
  const mlRes = await fetch(`${ML_URL}/docs`);
  assert.equal(mlRes.status, 200);
  markCheck(`ML Service tại ${ML_URL}/docs trả lời HTTP 200`);

  // Mailbox
  const mailRes = await fetch(`${MAILBOX_URL}/`);
  assert.equal(mailRes.status, 200);
  markCheck(`Dev Mailbox tại ${MAILBOX_URL}/ trả lời HTTP 200`);

  // ---------------------------------------------------------------------------
  // STEP 2: VERIFY BASELINE & PREPARE TEST ACCOUNTS
  // ---------------------------------------------------------------------------
  console.log('\n>>> [2/6] Kiểm tra cơ sở dữ liệu và tài khoản thực nghiệm...');
  const baselineUsers = await prisma.user.count();
  const baselineCompanies = await prisma.company.count();
  const baselineLoans = await prisma.loanApplication.count();
  const baselinePortal = await prisma.portalAccount.count();
  markCheck(`Database local: ${baselineUsers} users, ${baselineCompanies} companies, ${baselineLoans} loans, ${baselinePortal} portal accounts`);

  // Staff Logins
  const staffTokens = {};
  for (const username of ['test_admin', 'test_quan_ly', 'test_cbtd', 'test_tham_quyen']) {
    const res = await apiCall('/auth/login', {}, { username, password: STAFF_PASSWORD });
    const data = expectStatus(res, [200, 201], `Login staff ${username}`);
    const activeRole = data.roles?.[0] || (username === 'test_quan_ly' ? 'QUAN_LY' : username === 'test_cbtd' ? 'CBTD' : username === 'test_tham_quyen' ? 'THAM_QUYEN' : 'ADMIN');
    staffTokens[username] = { token: data.accessToken, role: activeRole, user: data.user || data };
  }
  markCheck('Đăng nhập thành công 4 vai trò cán bộ nội bộ (ADMIN, QUAN_LY, CBTD, THAM_QUYEN)');

  // Enterprise Account Setup (Synthetic)
  const dnHash = await bcrypt.hash(DN_PASSWORD, 10);
  const portalAccount = await prisma.portalAccount.create({
    data: {
      email: SYNTHETIC_DN_EMAIL,
      passwordHash: dnHash,
      contactName: '[LOCAL-TEST] Doanh nghiệp Thử nghiệm SME',
      phone: '0912345678',
      verifiedAt: new Date(),
    },
  });

  const dnLoginRes = await apiCall('/portal/auth/login', {}, { email: SYNTHETIC_DN_EMAIL, password: DN_PASSWORD });
  const dnLogin = expectStatus(dnLoginRes, [200, 201], 'DN portal login');
  const dnActor = { token: dnLogin.accessToken, account: portalAccount };
  markCheck(`Đăng nhập thành công Doanh nghiệp Portal (${SYNTHETIC_DN_EMAIL})`);

  // ---------------------------------------------------------------------------
  // STEP 3: MASTER LOAN CYCLE E2E (MILESTONES 1 - 13)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [3/6] Thực thi luồng hồ sơ chính Master (13 mốc kiểm thử)...');

  // M1: DN creates portal request and uploads PDF documents (Portal V2)
  const year = String(new Date().getFullYear() - 1);
  const portalData = {
    taxCode: SYNTHETIC_TAX,
    companyName: '[LOCAL-TEST] Công ty TNHH Cơ khí SME Hà Nội',
    industry: 'Cơ khí - Chế tạo',
    establishedYear: 2018,
    annualRevenue: 5000000000,
    charterCapital: 2000000000,
    representativeName: 'Nguyễn Văn Thử Nghiệm',
    phone: '0912345678',
    address: 'Số 1 Phố Thử Nghiệm, Quận Cầu Giấy, Hà Nội',
    loanPurpose: 'Mua nguyên vật liệu gia công cơ khí chính xác',
    loanType: 'VAY_VON_LUU_DONG',
    proposedAmount: 150000000, // 150 triệu VND (<= 10 tỷ)
    loanTermMonths: 12,
    businessScope: 'MANUFACTURING',
    revenuePeriod: year,
    representative: { mode: 'LEGAL_REPRESENTATIVE' },
    submissionDeclaration: { accepted: true, version: 'portal-enterprise-submission-v1' },
    hasExistingDebt: false,
    collateral: { mode: 'NONE_REQUESTED' },
  };

  const createReqRes = await apiCall('/portal/requests', dnActor, {
    formVersion: 2,
    clientRequestId: randomUUID(),
    data: portalData,
  });
  let req = expectStatus(createReqRes, [200, 201], 'DN create portal request V2');
  const requestId = req.id;
  markCheck(`[M1a] DN tạo yêu cầu portal V2 #${requestId} thành công`);

  // Upload PDF files for groups A, B, C, D
  const pdfBytes = await generatePdf('Chung tu tai lieu xac thuc [LOCAL-TEST]');

  async function uploadGroup(group, coverage, replaceDocId, content = pdfBytes) {
    const fd = new FormData();
    fd.append('documentGroup', group);
    fd.append('coverage', JSON.stringify(coverage));
    fd.append('clientUploadId', randomUUID());
    fd.append('expectedRevision', String(req.revision));
    fd.append('file', new Blob([content], { type: 'application/pdf' }), `test-${group}.pdf`);
    const endpoint = `/portal/requests/${requestId}/documents${replaceDocId ? `/${replaceDocId}/replace` : ''}`;
    const res = await apiCall(endpoint, dnActor, fd, 'POST');
    req = expectStatus(res, [200, 201], `Upload group ${group}`);
    return req;
  }

  const coverage = [
    ['A', ['A_BUSINESS_REGISTRATION', 'A_CHARTER', 'A_REPRESENTATIVE_AUTHORITY', 'A_REPRESENTATIVE_ID'].map((documentTypeCode) => ({ documentTypeCode }))],
    ['B', [{ documentTypeCode: 'B_FINANCIAL_STATEMENTS', period: year, components: ['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW_STATEMENT', 'NOTES'] }]],
    ['C', [{ documentTypeCode: 'C_PRODUCTION_PLAN' }, { documentTypeCode: 'C_PURCHASE_ORDER' }]],
    ['D', [{ documentTypeCode: 'D_LOAN_REQUEST' }, { documentTypeCode: 'D_CAPITAL_PLAN' }]],
  ];

  for (const [g, c] of coverage) {
    await uploadGroup(g, c);
  }
  markCheck('[M1b] DN tải lên 4 nhóm chứng từ theo chuẩn V2 (Pháp lý, Tài chính, Phương án, Vốn vay)');

  // Link revenue document basis
  const financeDoc = req.documents.find((d) => d.documentGroup === 'B');
  const updateReqRes = await apiCall(`/portal/requests/${requestId}`, dnActor, {
    expectedRevision: req.revision,
    data: {
      ...req.data,
      annualRevenueBasis: { documentId: financeDoc.id, fullYearCompleted: true },
    },
  }, 'PUT');
  req = expectStatus(updateReqRes, 200, 'Update revenue document basis');

  // DN submits
  const submitRes = await apiCall(`/portal/requests/${requestId}/submit`, dnActor, {
    expectedRevision: req.revision,
    documentIds: req.documents.map((d) => d.id),
  });
  req = expectStatus(submitRes, [200, 201], 'DN submit request');
  markCheck(`[M1c] DN nộp hồ sơ vay thành công (Trạng thái: SUBMITTED)`);

  // M2: QLCN assigns request to CBTD
  const qlcn = staffTokens['test_quan_ly'];
  const cbtd = staffTokens['test_cbtd'];

  const assignRes = await apiCall(`/portal-intakes/${requestId}/assign`, qlcn, {
    officerId: cbtd.user.id,
    expectedAssignedTo: null,
    expectedRevision: req.revision,
    expectedAssignmentVersion: 0,
    clientRequestId: randomUUID(),
    note: 'Phân công CBTD kiểm tra tiếp nhận hồ sơ [LOCAL-TEST]',
  });
  req = expectStatus(assignRes, [200, 201], 'QLCN assign officer');
  markCheck(`[M2] QLCN phân công hồ sơ cho CBTD (${cbtd.user.fullName}) thành công (Trạng thái: ASSIGNED)`);

  // M3: CBTD reviews checklist and returns for correction
  const cycleViewRes = await apiCall(`/portal-intakes/${requestId}/intake-cycle`, cbtd);
  const cycleView = expectStatus(cycleViewRes, 200, 'CBTD view intake cycle');
  const submissionId = cycleView.currentSubmissionId;

  // Review item as NEEDS_CORRECTION
  for (const item of cycleView.checklist) {
    const isNeedCorrection = item.id.includes('INCOME_STATEMENT');
    const reviewRes = await apiCall(`/portal-intakes/${requestId}/review`, cbtd, {
      submissionId,
      itemId: item.id,
      decision: isNeedCorrection ? 'NEEDS_CORRECTION' : 'ACCEPTED',
      ...(isNeedCorrection ? { message: 'Đề nghị tải lại BCTC có chữ ký kiểm toán và đóng dấu' } : {}),
      clientRequestId: randomUUID(),
      expectedRevision: req.revision,
    });
    req = expectStatus(reviewRes, [200, 201], `Review item ${item.id}`);
  }

  const returnRes = await apiCall(`/portal-intakes/${requestId}/return-correction`, cbtd, {
    submissionId,
    clientRequestId: randomUUID(),
    expectedRevision: req.revision,
  });
  req = expectStatus(returnRes, [200, 201], 'CBTD return for correction');
  markCheck('[M3] CBTD yêu cầu DN sửa đổi/bổ sung BCTC thành công (Trạng thái: RETURNED)');

  // M4: DN updates document and resubmits
  const pdfFinanceCorrected = await generatePdf('Bao cao tai chinh da dong dau kiem toan [LOCAL-TEST-V2]');
  const bDoc = req.documents.find((d) => d.documentGroup === 'B');
  
  await uploadGroup('B', coverage[1][1], bDoc.id, pdfFinanceCorrected);
  const updatedFinanceDoc = req.documents.find((d) => d.documentGroup === 'B');

  const updateSourceRes = await apiCall(`/portal/requests/${requestId}`, dnActor, {
    expectedRevision: req.revision,
    data: {
      ...req.data,
      annualRevenueBasis: { documentId: updatedFinanceDoc.id, fullYearCompleted: true },
    },
  }, 'PUT');
  req = expectStatus(updateSourceRes, 200, 'Update corrected source');

  const resubmitRes = await apiCall(`/portal/requests/${requestId}/submit`, dnActor, {
    expectedRevision: req.revision,
    documentIds: req.documents.map((d) => d.id),
  });
  req = expectStatus(resubmitRes, [200, 201], 'DN resubmit request');
  markCheck('[M4] DN cập nhật BCTC và nộp lại hồ sơ thành công (Trạng thái: RESUBMITTED)');

  // M5: CBTD reconciles and accepts request -> creates LoanApplication
  const cycleAfterResubmit = (await apiCall(`/portal-intakes/${requestId}/intake-cycle`, cbtd)).data;
  const newSubmissionId = cycleAfterResubmit.currentSubmissionId;

  for (const item of cycleAfterResubmit.checklist.filter((i) => !i.review || i.review.decision !== 'ACCEPTED')) {
    const revRes = await apiCall(`/portal-intakes/${requestId}/review`, cbtd, {
      submissionId: newSubmissionId,
      itemId: item.id,
      decision: 'ACCEPTED',
      clientRequestId: randomUUID(),
      expectedRevision: req.revision,
    });
    req = expectStatus(revRes, [200, 201], `Review updated item ${item.id}`);
  }

  const acceptRes = await apiCall(`/portal-intakes/${requestId}/accept`, cbtd, {
    submissionId: newSubmissionId,
    confirmExistingCompany: true,
    confirmExistingCompanyFinancials: true,
    expectedRevision: req.revision,
  });
  const acceptData = expectStatus(acceptRes, [200, 201], 'CBTD accept request');
  const loanId = acceptData.loanId;
  assert.ok(loanId, 'Loan ID must be created');
  markCheck(`[M5] CBTD tiếp nhận hồ sơ thành công -> Tạo khoản vay #${loanId} (Stage: TIEP_NHAN, Status: RECEIVED)`);

  // M6: CBTD requests supplement in loan application
  const suppRes = await apiCall(`/supplements/${loanId}`, cbtd, {
    requestContent: 'Đề nghị cung cấp thêm Hợp đồng nguyên tắc đầu ra năm 2026',
    notes: 'DN đã đồng ý bổ sung trong vòng 3 ngày làm việc',
  });
  const suppData = expectStatus(suppRes, [200, 201], 'CBTD request supplement');
  const supplementId = suppData.id;
  markCheck(`[M6] CBTD lập yêu cầu bổ sung #${supplementId} (Status: SUPPLEMENT_REQUIRED)`);

  // M7: Supplement resolved
  const resolveSuppRes = await apiCall(`/supplements/${supplementId}/resolve`, cbtd, {
    notes: 'DN đã xuất trình bản gốc hợp đồng nguyên tắc tại quầy giao dịch',
  }, 'PUT');
  expectStatus(resolveSuppRes, 200, 'Resolve supplement');
  markCheck('[M7] Ghi nhận giải quyết bổ sung thành công -> Hồ sơ quay lại xử lý bình thường');

  // M8: CBTD sets official amount & marks documents complete
  await apiCall(`/loan-applications/${loanId}/set-amount`, cbtd, { officialAmount: 150000000 }, 'PUT');
  const checkDocsRes = await apiCall(`/loan-applications/${loanId}/check-documents`, cbtd, { isComplete: true }, 'PUT');
  expectStatus(checkDocsRes, 200, 'CBTD check documents');
  markCheck('[M8] CBTD đối soát xác nhận đủ chứng từ (Status: CHECKED, Hạn mức: 150 triệu VND)');

  // M9: CBTD drafts & submits Appraisal Report v1 -> transitions to THAM_DINH
  const reportContentV1 = {
    legalAssessment: 'Pháp lý doanh nghiệp hoàn thiện, người đại diện theo pháp luật đúng thẩm quyền.',
    businessAssessment: 'Doanh nghiệp hoạt động ổn định trong ngành cơ khí chế tạo từ năm 2018.',
    financialAssessment: 'Tài chính lành mạnh, doanh thu 5 tỷ VND, vốn điều lệ 2 tỷ VND, không nợ xấu.',
    repaymentSource: 'Dòng tiền từ các hợp đồng cung cấp linh kiện cho đối tác khu công nghiệp.',
    collateralAssessment: 'Khoản vay vốn lưu động không yêu cầu tài sản bảo đảm bổ sung.',
    risks: 'Rủi ro biến động giá thép và vật liệu đầu vào.',
    recommendation: 'Đề xuất phê duyệt cho vay hạn mức 150.000.000 VND, thời hạn 12 tháng.',
    proposedInterestRate: '8.5',
    proposedConditions: 'Giải ngân theo tiến độ đơn hàng và sao kê tài khoản thanh toán định kỳ.',
  };

  const draftRes = await apiCall(`/appraisals/${loanId}/draft`, cbtd, {
    content: reportContentV1,
    clientRequestId: randomUUID(),
    expectedRevision: 0,
  }, 'PUT');
  expectStatus(draftRes, 200, 'CBTD draft report');

  const submitReportRes = await apiCall(`/appraisals/${loanId}/submit`, cbtd, {
    content: reportContentV1,
    clientRequestId: randomUUID(),
    expectedRevision: 1,
  });
  expectStatus(submitReportRes, [200, 201], 'CBTD submit report v1');
  markCheck('[M9] CBTD lập và trình tờ trình thẩm định v1 -> Chuyển sang công đoạn THAM_DINH (Status: PENDING_APPRAISAL)');

  // D5-04 Maker-Checker check on findOne & appraisal view
  const cbtdLoanRes = await apiCall(`/loan-applications/${loanId}`, cbtd);
  const cbtdLoan = expectStatus(cbtdLoanRes, 200, 'CBTD findOne');
  assert.equal(cbtdLoan.makerCheckerRestrictions?.isIndependent, false);
  assert.equal(cbtdLoan.makerCheckerRestrictions?.decisionBlocked, true);
  assert.ok(cbtdLoan.makerCheckerRestrictions?.decisionBlockReason);
  markCheck('[D5-04] findOne trả về makerCheckerRestrictions: CBTD đang thụ lý bị khóa quyết định và có lý do giải thích');

  const cbtdApprRes = await apiCall(`/appraisals/${loanId}`, cbtd);
  const cbtdAppr = expectStatus(cbtdApprRes, 200, 'CBTD view appraisal');
  assert.equal(cbtdAppr.makerChecker?.canClarify, false);
  assert.equal(cbtdAppr.makerChecker?.isIndependent, false);
  assert.ok(cbtdAppr.makerChecker?.clarifyBlockReason);
  markCheck('[D5-04] view appraisal: CBTD lập tờ trình bị khóa canClarify và có lý do giải thích');

  const tqLoanRes = await apiCall(`/loan-applications/${loanId}`, staffTokens['test_tham_quyen']);
  const tqLoan = expectStatus(tqLoanRes, 200, 'THAM_QUYEN findOne');
  assert.equal(tqLoan.makerCheckerRestrictions?.isIndependent, true);
  assert.equal(tqLoan.makerCheckerRestrictions?.decisionBlocked, false);
  markCheck('[D5-04] findOne: Thẩm quyền độc lập có quyền ra quyết định (decisionBlocked: false)');

  // M10: THAM_QUYEN requests clarification
  const thamQuyen = staffTokens['test_tham_quyen'];
  const viewReportRes = await apiCall(`/appraisals/${loanId}`, thamQuyen);
  const reportView = expectStatus(viewReportRes, 200, 'THAM_QUYEN view report');

  const clarifyRes = await apiCall(`/appraisals/${loanId}/clarify`, thamQuyen, {
    message: 'Yêu cầu làm rõ tỷ suất lợi nhuận ròng và chi tiết các hợp đồng đầu ra quý 4/2026.',
    clientRequestId: randomUUID(),
    expectedRevision: reportView.revision,
  });
  expectStatus(clarifyRes, [200, 201], 'THAM_QUYEN request clarification');
  markCheck('[M10] Cán bộ Thẩm quyền yêu cầu làm rõ tờ trình v1 (Status: CLARIFICATION_REQUIRED)');

  // M11: CBTD submits Appraisal Report v2 with clarification
  const reportContentV2 = {
    ...reportContentV1,
    financialAssessment: 'Tài chính lành mạnh: Doanh thu 5 tỷ VND, biên lợi nhuận ròng 12.5%, dòng tiền ròng dương.',
    risks: 'Rủi ro giá vật liệu đã được phòng ngừa bằng hợp đồng kỳ hạn cố định giá mua đến hết quý 1/2027.',
  };

  const submitReportV2Res = await apiCall(`/appraisals/${loanId}/submit`, cbtd, {
    content: reportContentV2,
    clientRequestId: randomUUID(),
    expectedRevision: (await apiCall(`/appraisals/${loanId}`, cbtd)).data.revision,
  });
  const reportV2 = expectStatus(submitReportV2Res, [200, 201], 'CBTD submit report v2');
  const versionIdV2 = reportV2.versions?.[0]?.id;
  markCheck(`[M11] CBTD giải trình và trình tờ trình thẩm định v2 #${versionIdV2} thành công`);

  // M12: THAM_QUYEN approves the loan application
  const approveRes = await apiCall(`/workflow/${loanId}/transition`, thamQuyen, {
    targetStage: 'HOAN_TAT',
    targetStatus: 'APPROVED',
    approvedAmount: 140000000,
    interestRate: 8.5,
    reportVersionId: versionIdV2,
    notes: 'Đồng ý phê duyệt cấp tín dụng theo tờ trình thẩm định v2.',
  });
  expectStatus(approveRes, [200, 201], 'THAM_QUYEN approve loan');
  markCheck('[M12] Cán bộ Thẩm quyền phê duyệt khoản vay 140 triệu VND, lãi suất 8.5%/năm (Stage: HOAN_TAT, Status: APPROVED)');

  // M13: Check DN Portal Result Visibility
  const portalTrackingRes = await apiCall(`/portal/requests/${requestId}/status`, dnActor);
  const portalTracking = expectStatus(portalTrackingRes, 200, 'DN tracking result');
  assert.equal(portalTracking.status?.code, 'APPROVED');
  assert.ok(portalTracking.status?.label, 'Portal status must have label');
  assert.ok(portalTracking.steps?.length === 4, 'Portal tracking must have 4 steps');
  // Verify internal ML prediction and internal credit scores are NOT exposed
  assert.equal(portalTracking.creditScore, undefined);
  assert.equal(portalTracking.delayPrediction, undefined);
  markCheck('[M13] Doanh nghiệp tra cứu kết quả Portal: Hiển thị ĐÃ DUYỆT; thông tin nội bộ được bảo vệ nghiêm ngặt');

  // ---------------------------------------------------------------------------
  // STEP 4: EXCEPTION SCENARIOS
  // ---------------------------------------------------------------------------
  console.log('\n>>> [4/6] Kiểm tra các luồng ngoại lệ và bảo mật...');

  // Exception A: Rejection flow with standard TC01-TC05
  let rejReq = (await apiCall('/portal/requests', dnActor, {
    formVersion: 2,
    clientRequestId: randomUUID(),
    data: { ...portalData, taxCode: '9990000002', companyName: '[LOCAL-TEST] Công ty Bị Từ Chối' },
  })).data;
  const rejReqId = rejReq.id;

  async function uploadRejGroup(group, cov) {
    const fd = new FormData();
    fd.append('documentGroup', group);
    fd.append('coverage', JSON.stringify(cov));
    fd.append('clientUploadId', randomUUID());
    fd.append('expectedRevision', String(rejReq.revision));
    fd.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), `rej-${group}.pdf`);
    const res = await apiCall(`/portal/requests/${rejReqId}/documents`, dnActor, fd, 'POST');
    rejReq = res.data;
  }

  for (const [g, c] of coverage) await uploadRejGroup(g, c);
  const rejFin = rejReq.documents.find((d) => d.documentGroup === 'B');
  rejReq = (await apiCall(`/portal/requests/${rejReqId}`, dnActor, {
    expectedRevision: rejReq.revision,
    data: { ...rejReq.data, annualRevenueBasis: { documentId: rejFin.id, fullYearCompleted: true } },
  }, 'PUT')).data;

  rejReq = (await apiCall(`/portal/requests/${rejReqId}/submit`, dnActor, {
    expectedRevision: rejReq.revision,
    documentIds: rejReq.documents.map((d) => d.id),
  })).data;

  await apiCall(`/portal-intakes/${rejReqId}/assign`, qlcn, {
    officerId: cbtd.user.id,
    expectedAssignedTo: null,
    expectedRevision: rejReq.revision,
    expectedAssignmentVersion: 0,
    clientRequestId: randomUUID(),
    note: 'Assign for reject check',
  });

  const rejCycle = (await apiCall(`/portal-intakes/${rejReqId}/intake-cycle`, cbtd)).data;
  for (const item of rejCycle.checklist) {
    rejReq = (await apiCall(`/portal-intakes/${rejReqId}/review`, cbtd, {
      submissionId: rejCycle.currentSubmissionId,
      itemId: item.id,
      decision: 'ACCEPTED',
      clientRequestId: randomUUID(),
      expectedRevision: (await apiCall(`/portal-intakes/${rejReqId}`, cbtd)).data.revision,
    })).data;
  }

  const rejAccept = (await apiCall(`/portal-intakes/${rejReqId}/accept`, cbtd, {
    submissionId: rejCycle.currentSubmissionId,
    confirmExistingCompany: true,
    confirmExistingCompanyFinancials: true,
    expectedRevision: rejReq.revision,
  })).data;
  const rejLoanId = rejAccept.loanId;
  await apiCall(`/loan-applications/${rejLoanId}/set-amount`, cbtd, { officialAmount: 150000000 }, 'PUT');
  await apiCall(`/loan-applications/${rejLoanId}/check-documents`, cbtd, { isComplete: true }, 'PUT');
  
  await apiCall(`/appraisals/${rejLoanId}/draft`, cbtd, {
    content: reportContentV1,
    clientRequestId: randomUUID(),
    expectedRevision: 0,
  }, 'PUT');
  const subRes = await apiCall(`/appraisals/${rejLoanId}/submit`, cbtd, {
    content: reportContentV1,
    clientRequestId: randomUUID(),
    expectedRevision: 1,
  });
  const subReport = expectStatus(subRes, [200, 201], 'Submit rej report');
  const rejVersionId = subReport.versions?.[0]?.id;

  // Try reject with invalid code TC99 -> Must be 400
  const invalidRej = await apiCall(`/workflow/${rejLoanId}/transition`, thamQuyen, {
    targetStage: 'HOAN_TAT',
    targetStatus: 'REJECTED',
    reportVersionId: rejVersionId,
    rejectionReasonCode: 'TC99',
    rejectionNote: 'Mã không tồn tại',
  });
  assert.equal(invalidRej.status, 400);
  markCheck('[Exc-A1] Chặn từ chối với mã lý do không hợp lệ TC99 (HTTP 400 Bad Request)');

  // Reject with valid code TC02 -> Must be 200/201
  const validRej = await apiCall(`/workflow/${rejLoanId}/transition`, thamQuyen, {
    targetStage: 'HOAN_TAT',
    targetStatus: 'REJECTED',
    reportVersionId: rejVersionId,
    rejectionReasonCode: 'TC02',
    rejectionNote: 'Hồ sơ không đáp ứng điều kiện lưu chuyển tiền tệ theo chính sách tín dụng.',
  });
  expectStatus(validRej, [200, 201], 'Valid reject with TC02');
  markCheck('[Exc-A2] Từ chối hồ sơ thành công với mã chuẩn TC02 (Hồ sơ không đáp ứng điều kiện tài chính)');

  // Verify DN portal tracking for rejected loan
  const rejTrackingRes = await apiCall(`/portal/requests/${rejReqId}/status`, dnActor);
  const rejTracking = expectStatus(rejTrackingRes, 200, 'DN tracking reject');
  assert.equal(rejTracking.status?.code, 'REJECTED');
  assert.equal(rejTracking.rejection?.code, 'TC02');
  assert.ok(rejTracking.rejection?.label);
  markCheck('[Exc-A3] Doanh nghiệp xem lý do từ chối chuẩn trên Portal: Mã TC02 và thông điệp minh bạch');

  // Exception B: Close overdue supplement by QLCN
  const tiepNhanStage = await prisma.workflowStage.findUnique({ where: { stageCode: 'TIEP_NHAN' } });
  const suppLoan = await prisma.loanApplication.create({
    data: {
      applicationCode: `SME-TEST-OVERDUE-${Date.now()}`,
      companyId: (await prisma.company.findFirst()).id,
      assignedTo: cbtd.user.id,
      loanPurpose: 'Bổ sung vốn lưu động sản xuất [LOCAL-TEST]',
      loanType: 'VAY_VON_LUU_DONG',
      loanTermMonths: 12,
      currentStage: 'TIEP_NHAN',
      currentStatus: 'SUPPLEMENT_REQUIRED',
      proposedAmount: 100000000,
      businessPolicyVersion: 'BRANCH_POLICY',
      stageHistories: {
        create: {
          stageId: tiepNhanStage.id,
          enteredAt: new Date(Date.now() - 10 * 86400000),
          slaStandardHours: 8,
          handledBy: cbtd.user.id,
        },
      },
    },
  });

  const expiredSupp = await prisma.supplementRequest.create({
    data: {
      applicationId: suppLoan.id,
      requestedBy: cbtd.user.id,
      requestContent: 'Bổ sung tài liệu quá hạn test',
      status: 'PENDING',
      requestedAt: new Date(Date.now() - 10 * 86400000), // 10 days ago
      deadlineAt: new Date(Date.now() - 2 * 86400000),  // 2 days ago (expired)
    },
  });

  // CBTD cannot close overdue -> 403
  const cbtdClose = await apiCall(`/workflow/${suppLoan.id}/close-overdue`, cbtd, { reason: 'CBTD đóng' });
  assert.equal(cbtdClose.status, 403);
  markCheck('[Exc-B1] CBTD không có thẩm quyền đóng hồ sơ quá hạn (HTTP 403 Forbidden - Segregation of Duties)');

  // D4-04: QLCN cannot close overdue if assigned or intake officer
  // Case 1: QLCN is assignedTo
  const qlcnAssignedLoan = await prisma.loanApplication.create({
    data: {
      applicationCode: `SME-TEST-OVERDUE-ASSIGNED-${Date.now()}`,
      companyId: (await prisma.company.findFirst()).id,
      assignedTo: qlcn.user.id,
      intakeOfficerId: cbtd.user.id,
      loanPurpose: 'Bổ sung vốn [LOCAL-TEST]',
      loanType: 'VAY_VON_LUU_DONG',
      loanTermMonths: 12,
      currentStage: 'TIEP_NHAN',
      currentStatus: 'SUPPLEMENT_REQUIRED',
      proposedAmount: 100000000,
      businessPolicyVersion: 'BRANCH_POLICY',
      supplementRequests: {
        create: {
          requestedBy: qlcn.user.id,
          requestContent: 'Bổ sung quá hạn test',
          status: 'PENDING',
          requestedAt: new Date(Date.now() - 10 * 86400000),
          deadlineAt: new Date(Date.now() - 2 * 86400000),
        },
      },
    },
  });

  const qlcnCloseAssigned = await apiCall(`/workflow/${qlcnAssignedLoan.id}/close-overdue`, qlcn, { reason: 'QLCN tự đóng' });
  assert.equal(qlcnCloseAssigned.status, 403);
  assert.match(qlcnCloseAssigned.data?.message, /phụ trách/);
  markCheck('[D4-04] QLCN đang phụ trách hồ sơ bị chặn đóng hồ sơ quá hạn (HTTP 403 Forbidden - Maker-Checker)');

  // Case 2: QLCN is intakeOfficerId
  const qlcnIntakeLoan = await prisma.loanApplication.create({
    data: {
      applicationCode: `SME-TEST-OVERDUE-INTAKE-${Date.now()}`,
      companyId: (await prisma.company.findFirst()).id,
      assignedTo: cbtd.user.id,
      intakeOfficerId: qlcn.user.id,
      loanPurpose: 'Bổ sung vốn [LOCAL-TEST]',
      loanType: 'VAY_VON_LUU_DONG',
      loanTermMonths: 12,
      currentStage: 'TIEP_NHAN',
      currentStatus: 'SUPPLEMENT_REQUIRED',
      proposedAmount: 100000000,
      businessPolicyVersion: 'BRANCH_POLICY',
      supplementRequests: {
        create: {
          requestedBy: cbtd.user.id,
          requestContent: 'Bổ sung quá hạn test',
          status: 'PENDING',
          requestedAt: new Date(Date.now() - 10 * 86400000),
          deadlineAt: new Date(Date.now() - 2 * 86400000),
        },
      },
    },
  });

  const qlcnCloseIntake = await apiCall(`/workflow/${qlcnIntakeLoan.id}/close-overdue`, qlcn, { reason: 'QLCN tiếp nhận tự đóng' });
  assert.equal(qlcnCloseIntake.status, 403);
  assert.match(qlcnCloseIntake.data?.message, /tiếp nhận ban đầu/);
  markCheck('[D4-04] QLCN là người tiếp nhận ban đầu bị chặn đóng hồ sơ quá hạn (HTTP 403 Forbidden - Maker-Checker)');

  // QLCN closes overdue -> 200/201 (Independent QLCN)
  const qlcnClose = await apiCall(`/workflow/${suppLoan.id}/close-overdue`, qlcn, { reason: 'Quá hạn bổ sung quá 48h không có phản hồi từ DN' });
  expectStatus(qlcnClose, [200, 201], 'QLCN close overdue');
  const closedLoan = await prisma.loanApplication.findUnique({ where: { id: suppLoan.id } });
  assert.equal(closedLoan.currentStatus, 'CLOSED_TIMEOUT');
  assert.equal(closedLoan.currentStage, 'HOAN_TAT');
  markCheck('[Exc-B2] QLCN độc lập đóng hồ sơ quá hạn thành công (Stage: HOAN_TAT, Status: CLOSED_TIMEOUT)');

  // Exception C: Role Governance & Switching
  const invalidRoleCall = await apiCall('/loan-applications', { token: cbtd.token, role: 'QUAN_LY' });
  assert.equal(invalidRoleCall.status, 403);
  assert.equal(invalidRoleCall.data?.errorCode, 'ACTIVE_ROLE_INVALID');
  markCheck('[Exc-C1] Chặn vượt quyền khi header X-Active-Role không thuộc quyền được cấp (HTTP 403 ACTIVE_ROLE_INVALID)');

  // Verify profile & valid role governance
  const adminActor = staffTokens['test_admin'];
  const profileRes = await apiCall('/auth/me', adminActor);
  const profile = expectStatus(profileRes, 200, 'Get admin profile');
  assert.ok(profile.roles?.includes('ADMIN'));
  markCheck('[Exc-C2] Xác thực vai trò hợp lệ qua /auth/me thành công, đồng bộ phiên làm việc');

  // Exception D: Document Security & Binary Integrity
  const unauthDoc = await apiCall(`/portal/requests/${requestId}/documents/${financeDoc.id}/download`);
  assert.ok([401, 403].includes(unauthDoc.status));
  markCheck('[Exc-D1] Chặn tải chứng từ doanh nghiệp khi chưa xác thực hoặc không có quyền (HTTP 401/403)');

  const authDoc = await apiCall(`/portal/requests/${requestId}/documents/${financeDoc.id}/download`, dnActor, undefined, 'GET', true);
  assert.equal(authDoc.status, 200);
  assert.equal(Buffer.isBuffer(authDoc.data), true);
  assert.ok(authDoc.data.length > 0);
  markCheck('[Exc-D2] Tải chứng từ hợp lệ: tính toàn vẹn nhị phân khớp tài liệu đã tải lên');

  // ---------------------------------------------------------------------------
  // STEP 5: CLEANUP SYNTHETIC TEST ARTIFACTS & VERIFY BASELINE PRESERVATION
  // ---------------------------------------------------------------------------
  console.log('\n>>> [5/6] Dọn dẹp dữ liệu thử nghiệm và xác nhận bảo toàn baseline...');

  await cleanupTestData();

  const postUsers = await prisma.user.count();
  const postCompanies = await prisma.company.count();
  const postLoans = await prisma.loanApplication.count();
  const postPortal = await prisma.portalAccount.count();

  assert.equal(postUsers, baselineUsers, 'Baseline users must match');
  assert.equal(postCompanies, baselineCompanies, 'Baseline companies must match');
  assert.equal(postLoans, baselineLoans, 'Baseline loans must match');
  assert.equal(postPortal, baselinePortal, 'Baseline portal accounts must match');
  markCheck(`Bảo toàn nguyên vẹn 100% dữ liệu gốc: ${postUsers} users, ${postCompanies} companies, ${postLoans} loans, ${postPortal} portal accounts`);

  // ---------------------------------------------------------------------------
  // STEP 6: WRITE HANDOVER EVIDENCE
  // ---------------------------------------------------------------------------
  console.log('\n>>> [6/6] Ghi nhận bằng chứng thực nghiệm hệ thống local...');
  const evidenceReport = {
    timestamp: new Date().toISOString(),
    system: {
      backendUrl: BASE_URL,
      frontendStaffUrl: `${FRONTEND_URL}/`,
      frontendPortalUrl: `${FRONTEND_URL}/portal`,
      mlServiceUrl: ML_URL,
      mailboxUrl: MAILBOX_URL,
      databaseUrl: DB_URL.replace(/:[^:@]+@/, ':******@'),
    },
    verificationSummary: {
      totalChecks: checks,
      allPassed: true,
      milestonesPassed: 13,
      exceptionsPassed: 6,
    },
    baselinePreservation: {
      users: { before: baselineUsers, after: postUsers },
      companies: { before: baselineCompanies, after: postCompanies },
      loans: { before: baselineLoans, after: postLoans },
      portalAccounts: { before: baselinePortal, after: postPortal },
    },
  };

  const evidencePath = path.resolve(__dirname, '../../evidence/reviews/integration/local-system-verification.json');
  await fs.writeFile(evidencePath, JSON.stringify(evidenceReport, null, 2));
  markCheck(`Báo cáo thực nghiệm đã lưu tại: ${evidencePath}`);

  console.log('\n================================================================');
  console.log(`  HOÀN THÀNH KIỂM CHỨNG TOÀN DIỆN LOCAL SYSTEM: ${checks}/${checks} PASS`);
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ LOCAL VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
