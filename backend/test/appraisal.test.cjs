const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('reflect-metadata');

const { AppraisalController } = require('../dist/modules/appraisal/appraisal.controller');
const { AppraisalService } = require('../dist/modules/appraisal/appraisal.service');
const { assertIndependent, assertReportDecision, digest } = require('../dist/modules/appraisal/appraisal.logic');

const BRANCH_POLICY = 'SME_BRANCH_20261031_V1';
const validUUID = () => crypto.randomUUID();

function mockLoan(overrides = {}) {
  return {
    id: 'loan-1',
    applicationCode: 'HS-2026-001',
    businessPolicyVersion: BRANCH_POLICY,
    currentStage: 'TIEP_NHAN',
    currentStatus: 'CHECKED',
    isDocumentComplete: true,
    proposedAmount: 5000000000,
    officialAmount: 5000000000,
    loanPurpose: 'Vốn lưu động sản xuất',
    loanType: 'VON_LUU_DONG',
    loanTermMonths: 12,
    companyId: 'comp-1',
    assignedTo: 'cbtd-1',
    intakeOfficerId: 'cbtd-intake',
    completedAt: null,
    coordinationRestrictions: null,
    ...overrides,
  };
}

function mockAppraisalFixture(initialReport = null) {
  const state = {
    loan: mockLoan(),
    report: initialReport ? { ...initialReport, versions: initialReport.versions || [], events: initialReport.events || [] } : null,
    versions: initialReport?.versions ? [...initialReport.versions] : [],
    events: initialReport?.events ? [...initialReport.events] : [],
    transitions: [],
    predictions: 0,
    notifications: [],
    locks: [],
  };

  const tx = {
    $queryRaw: async (query, ...params) => {
      state.locks.push({ query: String(query), params });
      return [];
    },
    loanApplication: {
      findUnique: async ({ where }) => (where.id === state.loan.id ? state.loan : null),
    },
    company: {
      findUnique: async ({ where }) => ({ id: where.id, companyName: 'Công ty Test', taxCode: '0101234567' }),
    },
    document: {
      findMany: async () => [],
    },
    supplementRequest: {
      findMany: async () => [],
      count: async () => 0,
    },
    user: {
      findMany: async () => [{ id: 'tq-1' }, { id: 'tq-2' }],
    },
    internalNotification: {
      create: async ({ data }) => {
        state.notifications.push(data);
        return { id: 'notif-1', ...data };
      },
    },
    appraisalReport: {
      findUnique: async () => state.report,
      create: async ({ data }) => {
        state.report = { id: 'rep-1', revision: 0, status: 'DRAFT', draft: data.draft || {}, versions: [], events: [], ...data };
        return state.report;
      },
      update: async ({ data }) => {
        if (data.revision && data.revision.increment) {
          state.report.revision += data.revision.increment;
          delete data.revision;
        }
        Object.assign(state.report, data);
        return state.report;
      },
    },
    appraisalReportVersion: {
      count: async () => state.versions.length,
      create: async ({ data }) => {
        const v = { id: `ver-${state.versions.length + 1}`, submittedAt: new Date().toISOString(), ...data };
        state.versions.push(v);
        if (state.report) state.report.versions = [...state.versions];
        return v;
      },
    },
    appraisalReportEvent: {
      findUnique: async ({ where }) => {
        const key = where.reportId_clientRequestId;
        return state.events.find(e => e.reportId === key.reportId && e.clientRequestId === key.clientRequestId) || null;
      },
      findFirst: async ({ where }) => {
        return state.events.find(e => e.actorId === where.actorId && (!where.kind || where.kind.in.includes(e.kind))) || null;
      },
      create: async ({ data }) => {
        const ev = { id: `ev-${state.events.length + 1}`, createdAt: new Date(), ...data };
        state.events.push(ev);
        if (state.report) state.report.events = [...state.events];
        return ev;
      },
    },
    assignmentChangeRequest: {
      findFirst: async () => null,
      findMany: async () => [],
    },
  };

  const prisma = {
    $transaction: async (fn) => fn(tx),
    appraisalReport: {
      findUnique: async () => state.report,
    },
    loanApplication: tx.loanApplication,
    appraisalReportEvent: tx.appraisalReportEvent,
  };

  const workflow = {
    transitionStage: async (id, dto, actor, date, txArg) => {
      state.transitions.push({ id, dto, actor });
    },
  };

  const prediction = {
    predictForApplication: async (id) => {
      state.predictions++;
    },
  };

  const service = new AppraisalService(prisma, workflow, prediction);
  const controller = new AppraisalController(service);

  return { state, tx, prisma, workflow, prediction, service, controller };
}

function fullAnalysisContent(overrides = {}) {
  return {
    legalAssessment: 'Doanh nghiệp có tư cách pháp nhân đầy đủ theo GPKD.',
    businessAssessment: 'Doanh thu sản xuất ổn định trong 2 năm tài chính gần nhất.',
    financialAssessment: 'Tỷ số thanh toán hiện hành đạt 1.8, nợ vay ở mức an toàn.',
    repaymentSource: 'Dòng tiền từ các hợp đồng cung ứng đã ký kết.',
    collateralAssessment: 'Không áp dụng theo chính sách cấp tín dụng tín chấp SME.',
    risks: 'Rủi ro biến động giá nguyên vật liệu được kiểm soát qua hợp đồng kỳ hạn.',
    recommendation: 'Đề xuất phê duyệt hạn mức 5.000.000.000 VNĐ.',
    proposedConditions: 'Duy trì số dư tài khoản tiền gửi tại chi nhánh.',
    ...overrides,
  };
}

test('1. D5-01: GET /appraisals/:applicationId returns HTTP 204 No Content when no report exists, without writing to DB', async () => {
  const { controller, state } = mockAppraisalFixture(null);
  let capturedStatus = 200;
  const mockRes = {
    status: (code) => {
      capturedStatus = code;
      return mockRes;
    },
  };

  const result = await controller.view('loan-1', mockRes);
  assert.equal(capturedStatus, 204, 'Must set HTTP 204 when appraisal report does not exist');
  assert.equal(result, undefined, 'Must return undefined/null body for 204');
  assert.equal(state.report, null, 'Must NOT create any appraisal_report record during GET');
  assert.equal(state.events.length, 0, 'Must NOT write events during GET');
});

test('2. D5-02 & D5-05: Draft saving (DRAFT_SAVED) validates revision and stores draft in DRAFT status', async () => {
  const { service, state } = mockAppraisalFixture(null);
  const clientRequestId = validUUID();
  const partialContent = { legalAssessment: 'Đang xem xét pháp lý ban đầu' };

  const saved = await service.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId,
    content: partialContent,
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  assert.equal(saved.status, 'DRAFT');
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.draft, {
    legalAssessment: 'Đang xem xét pháp lý ban đầu',
    businessAssessment: '',
    financialAssessment: '',
    repaymentSource: '',
    collateralAssessment: '',
    risks: '',
    recommendation: '',
    proposedConditions: '',
  });

  // Stale revision conflict check
  await assert.rejects(
    service.mutate('loan-1', 'DRAFT_SAVED', {
      expectedRevision: 0, // Stale! Revision is now 1
      clientRequestId: validUUID(),
      content: partialContent,
    }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    (err) => err.status === 409 && /Tờ trình đã thay đổi/.test(err.message),
    'Must throw ConflictException on expectedRevision mismatch'
  );
});

test('3. D5-05: Idempotency & Gửi lặp: replaying same clientRequestId with matching hash returns without duplicating', async () => {
  const { service, state } = mockAppraisalFixture(null);
  const clientRequestId = validUUID();
  const content = { legalAssessment: 'Nội dung chuẩn' };

  // First call
  await service.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId,
    content,
  }, { id: 'cbtd-1', activeRole: 'CBTD' });
  assert.equal(state.events.length, 1);

  // Replay with identical clientRequestId and content
  await service.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId,
    content,
  }, { id: 'cbtd-1', activeRole: 'CBTD' });
  assert.equal(state.events.length, 1, 'Replay with same clientRequestId must not create duplicate event');

  // Same clientRequestId with altered content must throw ConflictException
  await assert.rejects(
    service.mutate('loan-1', 'DRAFT_SAVED', {
      expectedRevision: 0,
      clientRequestId,
      content: { legalAssessment: 'Nội dung gian lận' },
    }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    (err) => err.status === 409 && /Mã thao tác đã được dùng với nội dung khác/.test(err.message),
    'Must reject reusing clientRequestId with different payload'
  );
});

test('4. D5-05: Submitting appraisal report validates all fields, creates immutable version, and triggers transition to THAM_DINH', async () => {
  const { service, state } = mockAppraisalFixture(null);
  const content = fullAnalysisContent();

  // Save draft first
  await service.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId: validUUID(),
    content,
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  // Submit report
  const submitted = await service.mutate('loan-1', 'SUBMITTED', {
    expectedRevision: 1,
    clientRequestId: validUUID(),
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(submitted.revision, 2);
  assert.equal(state.versions.length, 1);
  assert.equal(state.versions[0].sequence, 1);
  assert.ok(state.versions[0].evidenceHash, 'Must generate evidenceHash');
  assert.equal(state.versions[0].submittedBy, 'cbtd-1');

  // Stage transition triggered
  assert.equal(state.transitions.length, 1);
  assert.equal(state.transitions[0].dto.targetStage, 'THAM_DINH');
  assert.equal(state.transitions[0].dto.targetStatus, 'PENDING_APPRAISAL');

  // Internal notification sent to THAM_QUYEN officers
  assert.ok(state.notifications.some(n => n.title === 'Tờ trình chờ xem xét'));
});

test('5. D5-05: Submitting report is blocked if incomplete fields, documents incomplete, or pending supplement exists', async () => {
  // Case A: Missing required analysis field
  const { service: s1 } = mockAppraisalFixture(null);
  await s1.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId: validUUID(),
    content: { legalAssessment: 'Chỉ có pháp lý' },
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  await assert.rejects(
    s1.mutate('loan-1', 'SUBMITTED', {
      expectedRevision: 1,
      clientRequestId: validUUID(),
    }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    (err) => err.status === 400 && /Cần hoàn tất các phần phân tích/.test(err.message),
    'Must block submit when mandatory fields are blank'
  );

  // Case B: Documents not checked at TIEP_NHAN (isDocumentComplete: false)
  const { service: s2, state: state2 } = mockAppraisalFixture(null);
  state2.loan = mockLoan({ isDocumentComplete: false, currentStatus: 'RECEIVED' });
  await s2.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId: validUUID(),
    content: fullAnalysisContent(),
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  await assert.rejects(
    s2.mutate('loan-1', 'SUBMITTED', {
      expectedRevision: 1,
      clientRequestId: validUUID(),
    }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    (err) => err.status === 400 && /Cần xác nhận đủ chứng từ trước khi trình/.test(err.message),
    'Must block submit when loan documents are incomplete at TIEP_NHAN'
  );

  // Case C: Supplement is PENDING or status is SUPPLEMENT_REQUIRED
  const { service: s3, state: state3, tx: tx3 } = mockAppraisalFixture(null);
  tx3.supplementRequest.count = async () => 1; // 1 pending supplement request
  await s3.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 0,
    clientRequestId: validUUID(),
    content: fullAnalysisContent(),
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  await assert.rejects(
    s3.mutate('loan-1', 'SUBMITTED', {
      expectedRevision: 1,
      clientRequestId: validUUID(),
    }, { id: 'cbtd-1', activeRole: 'CBTD' }),
    (err) => err.status === 409 && /Cần hoàn tất bổ sung trước khi trình/.test(err.message),
    'Must block submit when there is a pending supplement request'
  );
});

test('6. D5-05: Clarification cycle: THAM_QUYEN requests clarification -> CLARIFICATION_REQUIRED, CBTD submits version 2', async () => {
  const { service, state } = mockAppraisalFixture(null);
  const content = fullAnalysisContent();

  // 1. CBTD saves and submits version 1
  await service.mutate('loan-1', 'DRAFT_SAVED', { expectedRevision: 0, clientRequestId: validUUID(), content }, { id: 'cbtd-1', activeRole: 'CBTD' });
  await service.mutate('loan-1', 'SUBMITTED', { expectedRevision: 1, clientRequestId: validUUID() }, { id: 'cbtd-1', activeRole: 'CBTD' });

  // 2. THAM_QUYEN requests clarification
  // Update loan stage to THAM_DINH for clarification check
  state.loan = mockLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' });

  const clarified = await service.mutate('loan-1', 'CLARIFICATION_REQUESTED', {
    expectedRevision: 2,
    clientRequestId: validUUID(),
    message: 'Cần làm rõ thêm nguồn trả nợ từ hợp đồng thứ hai.',
  }, { id: 'tq-independent', activeRole: 'THAM_QUYEN' });

  assert.equal(clarified.status, 'CLARIFICATION_REQUIRED');
  assert.equal(clarified.clarification.message, 'Cần làm rõ thêm nguồn trả nợ từ hợp đồng thứ hai.');
  assert.ok(state.notifications.some(n => n.title === 'Tờ trình cần làm rõ'));

  // 3. CBTD updates draft with clarification and submits version 2
  const revisedContent = { ...content, repaymentSource: 'Dòng tiền bổ sung hợp đồng HĐ-2026-B.' };
  await service.mutate('loan-1', 'DRAFT_SAVED', {
    expectedRevision: 3,
    clientRequestId: validUUID(),
    content: revisedContent,
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  const resubmitted = await service.mutate('loan-1', 'SUBMITTED', {
    expectedRevision: 4,
    clientRequestId: validUUID(),
  }, { id: 'cbtd-1', activeRole: 'CBTD' });

  assert.equal(resubmitted.status, 'SUBMITTED');
  assert.equal(state.versions.length, 2);
  assert.equal(state.versions[1].sequence, 2);
  assert.equal(state.versions[1].content.repaymentSource, 'Dòng tiền bổ sung hợp đồng HĐ-2026-B.');
});

test('7. D5-05: Maker-Checker 3 tiers: intake officer, assigned CBTD, and prior drafting participants are strictly forbidden from approving or clarifying', async () => {
  const { tx, state } = mockAppraisalFixture(null);
  const loan = mockLoan({ assignedTo: 'cbtd-drafter', intakeOfficerId: 'cbtd-intake' });

  // Tier 1: assigned officer cannot act as decision maker
  await assert.rejects(
    assertIndependent(tx, loan, { id: 'cbtd-drafter' }),
    (err) => err.status === 403 && /Người tiếp nhận hoặc lập tờ trình không được tự quyết định/.test(err.message),
    'Assigned CBTD must be blocked'
  );

  // Tier 2: intake officer cannot act as decision maker
  await assert.rejects(
    assertIndependent(tx, loan, { id: 'cbtd-intake' }),
    (err) => err.status === 403 && /Người tiếp nhận hoặc lập tờ trình không được tự quyết định/.test(err.message),
    'Intake officer must be blocked'
  );

  // Tier 3: user who participated in saving draft or submitting cannot act as decision maker
  state.events.push({ actorId: 'user-helper', kind: 'DRAFT_SAVED' });
  await assert.rejects(
    assertIndependent(tx, loan, { id: 'user-helper' }),
    (err) => err.status === 403 && /Bạn đã tham gia lập hoặc sửa tờ trình/.test(err.message),
    'Prior drafting participant must be blocked'
  );

  // Independent officer passes maker-checker
  await assert.doesNotReject(
    assertIndependent(tx, loan, { id: 'tq-completely-independent' }),
    'Completely independent officer must pass maker-checker'
  );
});

test('8. D5-05: Handover to Round 6 (assertReportDecision) enforces version match, no pending clarification, and detects evidenceHash changes', async () => {
  const { tx, state } = mockAppraisalFixture(null);
  const loan = mockLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' });

  const evidence = {
    company: { id: 'comp-1', companyName: 'Công ty Test', taxCode: '0101234567' },
    proposedAmount: '5000000000',
    officialAmount: '5000000000',
    loanPurpose: 'Vốn lưu động sản xuất',
    loanType: 'VON_LUU_DONG',
    loanTermMonths: 12,
    documents: [],
    supplements: [],
  };
  const correctHash = digest(evidence);

  state.report = {
    id: 'rep-1',
    applicationId: 'loan-1',
    status: 'SUBMITTED',
    versions: [
      { id: 'ver-1', sequence: 1, content: fullAnalysisContent(), evidence, evidenceHash: correctHash },
    ],
  };

  // 1. Success case: independent user, matching version, unchanged evidence
  const decision = await assertReportDecision(tx, loan, { id: 'tq-independent' }, 'ver-1');
  assert.equal(decision.version.id, 'ver-1');

  // 2. Failure case: versionId does not match (decision on stale version)
  await assert.rejects(
    assertReportDecision(tx, loan, { id: 'tq-independent' }, 'old-ver-0'),
    (err) => err.status === 409 && /Cần đọc và quyết định trên đúng bản tờ trình đã trình/.test(err.message),
    'Must reject decision on mismatched version'
  );

  // 3. Failure case: report is in CLARIFICATION_REQUIRED
  state.report.status = 'CLARIFICATION_REQUIRED';
  await assert.rejects(
    assertReportDecision(tx, loan, { id: 'tq-independent' }, 'ver-1'),
    (err) => err.status === 409 && /không còn yêu cầu làm rõ/.test(err.message),
    'Must reject decision when report requires clarification'
  );
  state.report.status = 'SUBMITTED';

  // 4. Failure case: evidence was secretly tampered with (e.g. loan officialAmount altered after submission)
  const tamperedLoan = { ...loan, officialAmount: 7000000000 };
  await assert.rejects(
    assertReportDecision(tx, tamperedLoan, { id: 'tq-independent' }, 'ver-1'),
    (err) => err.status === 409 && /Căn cứ đã thay đổi/.test(err.message),
    'Must detect evidenceHash mismatch and block decision'
  );
});

test('9. D5-04: AppraisalService.view returns makerChecker status based on actor relationship to loan/report', async () => {
  const { service, state } = mockAppraisalFixture({ id: 'rep-1', applicationId: 'loan-1', revision: 1, status: 'SUBMITTED', draft: {}, versions: [] });
  state.loan.assignedTo = 'cbtd-assigned';
  state.loan.intakeOfficerId = 'cbtd-intake';

  // 1. Assigned officer: blocked from clarify
  const viewAssigned = await service.view('loan-1', { id: 'cbtd-assigned' });
  assert.equal(viewAssigned.makerChecker.isIndependent, false);
  assert.equal(viewAssigned.makerChecker.canClarify, false);
  assert.match(viewAssigned.makerChecker.clarifyBlockReason, /phụ trách/);

  // 2. Intake officer: blocked from clarify
  const viewIntake = await service.view('loan-1', { id: 'cbtd-intake' });
  assert.equal(viewIntake.makerChecker.isIndependent, false);
  assert.equal(viewIntake.makerChecker.canClarify, false);
  assert.match(viewIntake.makerChecker.clarifyBlockReason, /tiếp nhận ban đầu/);

  // 3. User who drafted/submitted report: blocked from clarify
  state.events.push({ reportId: 'rep-1', actorId: 'helper-user', kind: 'DRAFT_SAVED' });
  const viewHelper = await service.view('loan-1', { id: 'helper-user' });
  assert.equal(viewHelper.makerChecker.isIndependent, false);
  assert.equal(viewHelper.makerChecker.canClarify, false);
  assert.match(viewHelper.makerChecker.clarifyBlockReason, /tham gia lập hoặc sửa/);

  // 4. Completely independent reviewer: allowed to clarify
  const viewIndep = await service.view('loan-1', { id: 'tq-independent' });
  assert.equal(viewIndep.makerChecker.isIndependent, true);
  assert.equal(viewIndep.makerChecker.canClarify, true);
  assert.equal(viewIndep.makerChecker.clarifyBlockReason, null);
});

test('10. ML: each submit and each clarification request refreshes the prediction; a replayed request does not add another', async () => {
  const { service, state } = mockAppraisalFixture(null);
  const content = fullAnalysisContent();
  const cbtd = { id: 'cbtd-1', activeRole: 'CBTD' };

  await service.mutate('loan-1', 'DRAFT_SAVED', { expectedRevision: 0, clientRequestId: validUUID(), content }, cbtd);
  assert.equal(state.predictions, 0, 'saving a draft is not a trigger');
  const submitId = validUUID();
  await service.mutate('loan-1', 'SUBMITTED', { expectedRevision: 1, clientRequestId: submitId }, cbtd);
  assert.equal(state.predictions, 1, 'first submit');
  await service.mutate('loan-1', 'SUBMITTED', { expectedRevision: 1, clientRequestId: submitId }, cbtd).catch(() => undefined);
  assert.equal(state.predictions, 1, 'replay of the same request');

  state.loan = mockLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' });
  await service.mutate('loan-1', 'CLARIFICATION_REQUESTED', { expectedRevision: 2, clientRequestId: validUUID(), message: 'Cần làm rõ nguồn trả nợ.' }, { id: 'tq-independent', activeRole: 'THAM_QUYEN' });
  assert.equal(state.predictions, 2, 'clarification request');
  await service.mutate('loan-1', 'DRAFT_SAVED', { expectedRevision: 3, clientRequestId: validUUID(), content: { ...content, repaymentSource: 'Bổ sung.' } }, cbtd);
  await service.mutate('loan-1', 'SUBMITTED', { expectedRevision: 4, clientRequestId: validUUID() }, cbtd);
  assert.equal(state.predictions, 3, 're-submit after clarification');
});
