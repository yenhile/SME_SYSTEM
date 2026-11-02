const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('reflect-metadata');

const { WorkflowService } = require('../dist/modules/workflow/workflow.service');
const { assertLoanWrite } = require('../dist/modules/workflow/loan-policy');
const { PortalService } = require('../dist/modules/portal/portal.service');
const { buildTracking, PUBLIC_REJECTION_REASONS } = require('../dist/modules/portal/portal.tracking');
const { withCoordination } = require('./helpers/coordination-fixture.cjs');

const BRANCH_POLICY = 'SME_BRANCH_20261031_V1';
const status = code => e => typeof e.getStatus === 'function' && e.getStatus() === code;

function createFixture(overrides = {}) {
  const versionId = crypto.randomUUID();
  const reportId = crypto.randomUUID();
  const company = { id: 'c1', companyName: 'Công ty TNHH SX ABC', taxCode: '0101234567', ...(overrides.company || {}) };

  const loan = {
    id: 'loan-1',
    applicationCode: 'SME-20261102-001',
    businessPolicyVersion: BRANCH_POLICY,
    currentStage: 'THAM_DINH',
    currentStatus: 'PENDING_APPRAISAL',
    proposedAmount: 5000000000,
    officialAmount: 5000000000,
    loanPurpose: 'Kinh doanh',
    loanType: 'VON_LUU_DONG',
    loanTermMonths: 12,
    assignedTo: 'cbtd-1',
    intakeOfficerId: 'cbtd-intake',
    completedAt: null,
    rejectionReasonCode: null,
    rejectionNote: null,
    companyId: 'c1',
    isDocumentComplete: true,
    ...overrides.loan,
  };

  const evidence = {
    company,
    proposedAmount: String(loan.proposedAmount),
    officialAmount: String(loan.officialAmount),
    loanPurpose: loan.loanPurpose,
    loanType: loan.loanType,
    loanTermMonths: loan.loanTermMonths,
    documents: [],
    supplements: [],
    ...(overrides.evidence || {}),
  };
  const evidenceHash = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');

  const state = {
    loan,
    company,
    report: {
      id: reportId,
      applicationId: 'loan-1',
      status: 'SUBMITTED',
      revision: 1,
      versions: [
        {
          id: versionId,
          reportId,
          sequence: 1,
          content: { recommendation: 'Đủ điều kiện cấp tín dụng' },
          evidence,
          evidenceHash,
          submittedBy: 'cbtd-1',
        },
      ],
      ...(overrides.report || {}),
    },
    events: overrides.events || [],
    stageHistories: [
      { id: 'h1', applicationId: 'loan-1', stageId: 's-td', enteredAt: new Date('2026-11-02T08:00:00Z'), exitedAt: null, slaPolicy: 'LEGACY' },
    ],
    stages: [
      { id: 's-td', stageCode: 'THAM_DINH', standardSlaHours: 24 },
      { id: 's-ht', stageCode: 'HOAN_TAT', standardSlaHours: 0 },
      { id: 's-ct', stageCode: 'CAP_TREN', standardSlaHours: 48 },
    ],
    coordinationRequests: overrides.coordinationRequests || [
      { id: 'acr-1', applicationId: 'loan-1', status: 'PENDING', requestedById: 'user-req' },
    ],
    coordinationObsoleted: [],
    supplements: overrides.supplements || [],
    documents: overrides.documents || [],
  };

  const tx = {
    $queryRaw: async () => [],
    loanApplication: {
      findUnique: async () => (state.loan ? { ...state.loan } : null),
      update: async ({ where, data }) => {
        Object.assign(state.loan, data);
        return { ...state.loan };
      },
    },
    company: {
      findUnique: async () => state.company,
    },
    appraisalReport: {
      findUnique: async () => (state.report ? { ...state.report, versions: state.report.versions } : null),
      update: async ({ where, data }) => {
        Object.assign(state.report, data);
        return { ...state.report };
      },
    },
    appraisalReportEvent: {
      findFirst: async ({ where }) => {
        return state.events.find(e => {
          if (where.actorId && e.actorId !== where.actorId) return false;
          if (where.kind?.in && !where.kind.in.includes(e.kind)) return false;
          return true;
        }) || null;
      },
    },
    workflowStage: {
      findUnique: async ({ where }) => state.stages.find(s => s.stageCode === where.stageCode) || null,
    },
    applicationStageHistory: {
      findFirst: async () => state.stageHistories.find(h => h.exitedAt === null) || null,
      update: async ({ where, data }) => {
        const item = state.stageHistories.find(h => h.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      create: async ({ data }) => {
        const item = { id: `h-${state.stageHistories.length + 1}`, ...data };
        state.stageHistories.push(item);
        return item;
      },
    },
    slaPolicyActivation: {
      findFirst: async () => null,
    },
    assignmentChangeRequest: {
      findFirst: async () => null,
      findMany: async () => state.coordinationRequests.filter(r => r.status === 'PENDING'),
      update: async ({ where, data }) => {
        const item = state.coordinationRequests.find(r => r.id === where.id);
        if (item) Object.assign(item, data);
        state.coordinationObsoleted.push({ where, data });
        return item || { id: where.id, ...data };
      },
      updateMany: async ({ where, data }) => {
        state.coordinationObsoleted.push({ where, data });
        return { count: 1 };
      },
    },
    supplementRequest: {
      count: async ({ where }) => state.supplements.filter(s => where.status ? s.status === where.status : true).length,
      findMany: async () => state.supplements,
      updateMany: async () => ({ count: 1 }),
    },
    document: {
      findMany: async () => state.documents,
    },
    applicationStagePause: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
  };

  const db = withCoordination({
    $transaction: async (fn, options) => fn(tx),
    ...tx,
  });

  const workflow = new WorkflowService(db, { predictForApplication: async () => {} });
  return { state, workflow, versionId, tx };
}

// -------------------------------------------------------------
// TIÊU CHÍ 1: Ràng buộc mã lý do từ chối (D6-01) - Prototype Safety & TC01-TC05 Allowlist
// -------------------------------------------------------------
test('D6-01: Rejection requires valid code from TC01-TC05 catalog; invalid codes (constructor, toString, __proto__, TC99) are rejected with 400 without loan changes', async () => {
  const approver = { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' };

  // 1. Kiểm tra chống Prototype Pollution & Injection: constructor, toString, __proto__, valueOf, hasOwnProperty, isPrototypeOf
  const prototypeAttacks = ['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];
  for (const badKey of prototypeAttacks) {
    const { workflow, versionId, state } = createFixture();
    await assert.rejects(
      workflow.transitionStage(
        'loan-1',
        { targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: versionId, rejectionReasonCode: badKey, rejectionNote: 'Tấn công injection' },
        approver
      ),
      e => e.getStatus() === 400 && /TC01-TC05/i.test(e.message)
    );
    // Bắt buộc hồ sơ không bị thay đổi trạng thái
    assert.equal(state.loan.currentStage, 'THAM_DINH');
    assert.equal(state.loan.currentStatus, 'PENDING_APPRAISAL');
    assert.equal(state.loan.rejectionReasonCode, null);
  }

  // 2. Mã không thuộc danh mục TC01-TC05 (TC99, TC00, INVALID, rỗng) bị từ chối và không đổi hồ sơ
  const invalidCodes = ['TC99', 'TC00', 'INVALID', '', '   '];
  for (const badCode of invalidCodes) {
    const { workflow, versionId, state } = createFixture();
    await assert.rejects(
      workflow.transitionStage(
        'loan-1',
        { targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: versionId, rejectionReasonCode: badCode, rejectionNote: 'Lý do tuỳ ý' },
        approver
      ),
      e => e.getStatus() === 400
    );
    assert.equal(state.loan.currentStage, 'THAM_DINH');
    assert.equal(state.loan.currentStatus, 'PENDING_APPRAISAL');
    assert.equal(state.loan.rejectionReasonCode, null);
  }

  // 3. Thiếu ghi chú giải trình nội bộ bị từ chối
  const { workflow: wfNote, versionId: vNote } = createFixture();
  await assert.rejects(
    wfNote.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: vNote, rejectionReasonCode: 'TC02', rejectionNote: '   ' },
      approver
    ),
    e => e.getStatus() === 400 && /lý do/i.test(e.message)
  );

  // 4. Tất cả các mã hợp lệ trong TC01-TC05 đều chuyển trạng thái thành công
  const validCodes = ['TC01', 'TC02', 'TC03', 'TC04', 'TC05'];
  for (const validCode of validCodes) {
    const { workflow, versionId, state } = createFixture();
    const result = await workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'REJECTED', reportVersionId: versionId, rejectionReasonCode: validCode, rejectionNote: `Giải trình từ chối cho ${validCode}` },
      approver
    );
    assert.equal(result.currentStage, 'HOAN_TAT');
    assert.equal(result.currentStatus, 'REJECTED');
    assert.equal(result.rejectionReasonCode, validCode);
    assert.ok(result.completedAt instanceof Date);
    assert.equal(state.loan.rejectionReasonCode, validCode);
  }

  // 5. Kiểm tra Fallback trên Portal Tracking đối với dữ liệu lịch sử chứa mã không hợp lệ hoặc prototype keys
  const reqFixture = { id: 'req-hist', reference: 'DN-HIST', status: 'ACCEPTED' };
  const badHistoricalCodes = ['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty', 'TC99', 'UNKNOWN', null, undefined];
  for (const code of badHistoricalCodes) {
    const tracking = buildTracking(reqFixture, {
      currentStage: 'HOAN_TAT',
      currentStatus: 'REJECTED',
      completedAt: new Date(),
      rejectionReasonCode: code,
      stageHistories: [{ stage: { stageCode: 'TIEP_NHAN' } }, { stage: { stageCode: 'HOAN_TAT' } }],
    });
    assert.equal(tracking.status.code, 'REJECTED');
    assert.deepEqual(tracking.rejection, { code: null, label: 'Hồ sơ không được chấp thuận' });
  }

  // 6. Dữ liệu lịch sử chứa đúng mã TC01-TC05 trên Portal Tracking hiển thị chuẩn
  for (const code of validCodes) {
    const tracking = buildTracking(reqFixture, {
      currentStage: 'HOAN_TAT',
      currentStatus: 'REJECTED',
      completedAt: new Date(),
      rejectionReasonCode: code,
      stageHistories: [{ stage: { stageCode: 'TIEP_NHAN' } }, { stage: { stageCode: 'HOAN_TAT' } }],
    });
    assert.equal(tracking.rejection.code, code);
    assert.equal(tracking.rejection.label, PUBLIC_REJECTION_REASONS[code]);
  }
});

// -------------------------------------------------------------
// TIÊU CHÍ 2: Ràng buộc số tiền và lãi suất phê duyệt (D6-02)
// -------------------------------------------------------------
test('D6-02: Approval validates amount <= limit and interest rate between 0-100%', async () => {
  const { workflow, versionId } = createFixture();
  const approver = { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' };

  // 1. Số tiền <= 0
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 0, interestRate: 8.5 },
      approver
    ),
    status(400)
  );

  // 2. Số tiền vượt officialAmount (5 tỷ)
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 6000000000, interestRate: 8.5 },
      approver
    ),
    status(400)
  );

  // 3. Lãi suất ngoài 0-100%
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4500000000, interestRate: 105 },
      approver
    ),
    status(400)
  );

  // 4. Số tiền và lãi suất hợp lệ -> phê duyệt thành công
  const approved = await workflow.transitionStage(
    'loan-1',
    { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4500000000, interestRate: 8.5 },
    approver
  );
  assert.equal(approved.currentStage, 'HOAN_TAT');
  assert.equal(approved.currentStatus, 'APPROVED');
  assert.equal(approved.approvedAmount, 4500000000);
  assert.equal(approved.interestRate, 8.5);
  assert.ok(approved.completedAt instanceof Date);
});

// -------------------------------------------------------------
// TIÊU CHÍ 3: Bảo toàn hồ sơ cũ không có officialAmount (D6-02)
// -------------------------------------------------------------
test('D6-02: Legacy loans without officialAmount check limit against proposedAmount', async () => {
  const { workflow } = createFixture({
    loan: { businessPolicyVersion: null, officialAmount: null, proposedAmount: 3000000000 },
  });
  const approver = { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' };

  // Vượt proposedAmount (3 tỷ) bị từ chối
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', approvedAmount: 3500000000, interestRate: 9.0 },
      approver
    ),
    status(400)
  );

  // Bằng hoặc nhỏ hơn proposedAmount -> thành công
  const ok = await workflow.transitionStage(
    'loan-1',
    { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', approvedAmount: 2800000000, interestRate: 9.0 },
    approver
  );
  assert.equal(ok.currentStatus, 'APPROVED');
  assert.equal(ok.approvedAmount, 2800000000);
});

// -------------------------------------------------------------
// TIÊU CHÍ 4: Maker-Checker 3 tầng độc lập (D6-05)
// -------------------------------------------------------------
test('D6-05: Maker-Checker strictly blocks intake officer, assigned officer, and draft author', async () => {
  const { workflow, versionId } = createFixture({
    events: [{ actorId: 'tq-drafter', kind: 'DRAFT_SAVED' }],
  });

  // Tầng 1: CBTD tiếp nhận hồ sơ không được duyệt
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4000000000, interestRate: 8.0 },
      { id: 'cbtd-intake', activeRole: 'THAM_QUYEN' }
    ),
    status(403)
  );

  // Tầng 2: CBTD phụ trách hồ sơ không được duyệt
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4000000000, interestRate: 8.0 },
      { id: 'cbtd-1', activeRole: 'THAM_QUYEN' }
    ),
    status(403)
  );

  // Tầng 3: Người từng tham gia soạn thảo/lưu nháp tờ trình không được duyệt
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4000000000, interestRate: 8.0 },
      { id: 'tq-drafter', activeRole: 'THAM_QUYEN' }
    ),
    status(403)
  );

  // Người yêu cầu làm rõ (CLARIFICATION_REQUESTED) KHÔNG bị chặn quyền quyết định bản mới
  const { workflow: wfClarify, versionId: vId2 } = createFixture({
    events: [{ actorId: 'tq-clarifier', kind: 'CLARIFICATION_REQUESTED' }],
  });
  const approved = await wfClarify.transitionStage(
    'loan-1',
    { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: vId2, approvedAmount: 4000000000, interestRate: 8.0 },
    { id: 'tq-clarifier', activeRole: 'THAM_QUYEN' }
  );
  assert.equal(approved.currentStatus, 'APPROVED');
});

// -------------------------------------------------------------
// TIÊU CHÍ 5: Tính nhất quán kết thúc & Khóa hồ sơ bất biến (D6-03 & D6-05)
// -------------------------------------------------------------
test('D6-03 & D6-05: Terminal state is atomic, obsoletes coordination, and permanently blocks writes', async () => {
  const { state, workflow, versionId } = createFixture();
  const approver = { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' };

  // Phê duyệt chuyển hồ sơ sang HOAN_TAT
  await workflow.transitionStage(
    'loan-1',
    { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4000000000, interestRate: 8.0 },
    approver
  );

  // 1. Chỉ 1 quyết định được ghi, completedAt được chốt
  assert.ok(state.loan.completedAt);
  assert.equal(state.loan.currentStage, 'HOAN_TAT');
  assert.equal(state.report.status, 'DECIDED');
  assert.equal(state.coordinationObsoleted.length, 1);

  // 2. Không còn stageHistory mở
  const openHistory = state.stageHistories.find(h => h.stageCode !== 'HOAN_TAT' && h.exitedAt === null);
  assert.equal(openHistory, undefined);

  // 3. Gửi lặp hoặc chuyển tiếp trên hồ sơ đã kết thúc bị từ chối rõ ràng theo tình huống
  await assert.rejects(
    workflow.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: versionId, approvedAmount: 4000000000, interestRate: 8.0 },
      approver
    ),
    e => e.getStatus() === 400 && /đã kết thúc/i.test(e.message)
  );

  // 4. Mọi thao tác ghi sau khi kết thúc đều bị assertLoanWrite chặn tuyệt đối (HTTP 403)
  await assert.rejects(
    assertLoanWrite({}, state.loan, { id: 'cbtd-1', activeRole: 'CBTD' }),
    e => e.getStatus() === 403 && /đã kết thúc/i.test(e.message)
  );
  await assert.rejects(
    assertLoanWrite({}, state.loan, { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' }),
    e => e.getStatus() === 403 && /đã kết thúc/i.test(e.message)
  );
});

// -------------------------------------------------------------
// TIÊU CHÍ 6: Bảo mật Cổng Doanh nghiệp & Allowlist (D6-04)
// -------------------------------------------------------------
test('D6-04: Enterprise tracking reflects actual visited history, enforces ownership and strict allowlist', async () => {
  const req = {
    id: 'req-1',
    reference: 'DN-20261102-ABC',
    status: 'ACCEPTED',
    submittedAt: new Date('2026-10-25T08:00:00Z'),
    acceptedAt: new Date('2026-10-25T09:00:00Z'),
  };

  // 1. Hồ sơ bị từ chối: chỉ trả nhãn danh mục chuẩn TC01-TC05, không rò rỉ rejectionNote
  const loanRejected = {
    currentStage: 'HOAN_TAT',
    currentStatus: 'REJECTED',
    completedAt: new Date('2026-11-02T10:00:00Z'),
    rejectionReasonCode: 'TC03',
    rejectionNote: 'INTERNAL NOTE: Phương án kinh doanh không có đầu ra khả thi',
    stageHistories: [{ stage: { stageCode: 'TIEP_NHAN' } }, { stage: { stageCode: 'THAM_DINH' } }, { stage: { stageCode: 'HOAN_TAT' } }],
  };
  const trackingRejected = buildTracking(req, loanRejected);
  assert.equal(trackingRejected.status.code, 'REJECTED');
  assert.deepEqual(trackingRejected.rejection, {
    code: 'TC03',
    label: 'Phương án kinh doanh không khả thi',
  });
  // Bước cuối dừng (stopped), các bước đã qua là done
  assert.equal(trackingRejected.steps[3].state, 'stopped');
  assert.equal(trackingRejected.steps[0].state, 'done');
  assert.equal(trackingRejected.steps[1].state, 'done');
  // Không chứa từ khóa nhạy cảm
  assert.ok(!JSON.stringify(trackingRejected).includes('INTERNAL NOTE'));

  // 2. Hồ sơ được phê duyệt: 4 bước hoàn thành (done)
  const loanApproved = {
    currentStage: 'HOAN_TAT',
    currentStatus: 'APPROVED',
    completedAt: new Date('2026-11-02T10:00:00Z'),
    stageHistories: [{ stage: { stageCode: 'TIEP_NHAN' } }, { stage: { stageCode: 'THAM_DINH' } }, { stage: { stageCode: 'HOAN_TAT' } }],
  };
  const trackingApproved = buildTracking(req, loanApproved);
  assert.equal(trackingApproved.status.code, 'APPROVED');
  assert.deepEqual(trackingApproved.steps.map(s => s.state), ['done', 'done', 'done', 'done']);

  // 3. Kiểm tra kiểm soát sở hữu và allowlist qua PortalService
  let queryCaptured;
  const portalService = new PortalService({
    portalRequest: {
      findFirst: async q => {
        queryCaptured = q;
        return q.where.accountId === 'enterprise-owner' ? { ...req, loan: loanRejected } : null;
      },
    },
  });

  // Đúng chủ sở hữu
  const result = await portalService.tracking('req-1', 'enterprise-owner');
  assert.equal(result.requestId, 'req-1');
  assert.deepEqual(queryCaptured.where, { id: 'req-1', accountId: 'enterprise-owner' });

  // Kiểm tra allowlist: các trường nội bộ nhạy cảm không nằm trong select
  const selectStr = JSON.stringify(queryCaptured.select);
  for (const forbidden of ['rejectionNote', 'delayPredictions', 'assignedTo', 'notes', 'officialAmount', 'approvedAmount']) {
    assert.ok(!selectStr.includes(`"${forbidden}"`), `Trường bị cấm xuất hiện trong select: ${forbidden}`);
  }

  // Khác chủ sở hữu bị 404
  await assert.rejects(portalService.tracking('req-1', 'other-company'), status(404));
});

// -------------------------------------------------------------
// TIÊU CHÍ 7: Độc lập luồng đóng quá hạn của Quản lý chi nhánh (TC05)
// -------------------------------------------------------------
test('TC05: Branch manager overdue closing flow (DEC-02 / TK-08) remains separate and undisturbed', async () => {
  const pastDeadline = new Date(Date.now() - 3600000);
  const { workflow } = createFixture({
    loan: { currentStage: 'TIEP_NHAN', currentStatus: 'SUPPLEMENT_REQUIRED', assignedTo: 'cbtd-1' },
    supplements: [
      { id: 'supp-1', applicationId: 'loan-1', status: 'PENDING', requestedAt: new Date(Date.now() - 864000000), deadlineAt: pastDeadline, portalSupplement: { responses: [] } },
    ],
  });

  // Cán bộ tín dụng hoặc Thẩm quyền không được đóng quá hạn
  await assert.rejects(
    workflow.closeOverdueSupplement('loan-1', { reason: 'Quá hạn bổ sung 10 ngày' }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    status(403)
  );

  // Quản lý chi nhánh đóng quá hạn thành công với mã TC05 và trạng thái CLOSED_TIMEOUT
  const closed = await workflow.closeOverdueSupplement(
    'loan-1',
    { reason: 'Quá hạn bổ sung chứng từ theo quy định' },
    { id: 'manager-1', activeRole: 'QUAN_LY' }
  );
  assert.equal(closed.currentStage, 'HOAN_TAT');
  assert.equal(closed.currentStatus, 'CLOSED_TIMEOUT');
  assert.equal(closed.rejectionReasonCode, 'TC05');
  assert.ok(closed.completedAt instanceof Date);
});

// -------------------------------------------------------------
// TIÊU CHÍ 8: Căn cứ tờ trình evidenceHash & Bổ sung PENDING (D6-01..05)
// -------------------------------------------------------------
test('Handover check: Tampered evidence or pending supplement blocks decision with 409 Conflict', async () => {
  const approver = { id: 'tham-quyen-1', activeRole: 'THAM_QUYEN' };

  // 1. Còn bổ sung PENDING -> chặn 409 Conflict
  const { workflow: wfPending, versionId: vId1 } = createFixture({
    supplements: [{ id: 'supp-open', status: 'PENDING' }],
  });
  await assert.rejects(
    wfPending.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: vId1, approvedAmount: 4000000000, interestRate: 8.0 },
      approver
    ),
    e => e.getStatus() === 409 && /yêu cầu bổ sung/i.test(e.message)
  );

  // 2. evidenceHash bị lệch (ví dụ hạn mức bị sửa đổi ngầm sau khi trình) -> chặn 409 Conflict
  const { workflow: wfTamper, versionId: vId2, state } = createFixture();
  // Sửa ngầm loan officialAmount
  state.loan.officialAmount = 7000000000;
  await assert.rejects(
    wfTamper.transitionStage(
      'loan-1',
      { targetStage: 'HOAN_TAT', targetStatus: 'APPROVED', reportVersionId: vId2, approvedAmount: 4000000000, interestRate: 8.0 },
      approver
    ),
    e => e.getStatus() === 409 && /căn cứ đã thay đổi/i.test(e.message)
  );
});

