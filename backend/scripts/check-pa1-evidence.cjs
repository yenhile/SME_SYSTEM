const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { startIsolated } = require('./check-portal-v2-intake.cjs');
const { runChecks } = require('./check-sla-pa1.cjs');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');

async function main() {
  console.log('--- RUNNING PA1 SLA VERIFICATION SUITE ---');
  let h;
  try {
    h = await startIsolated({ approvedIntake: true, coordinationMigration: true, accountRecoveryMigration: true });
    
    // Chạy bộ kiểm thử toàn diện check-sla-pa1 (119 checks)
    const baseResult = await runChecks(h);
    console.log(`Base SLA PA1 suite passed: ${baseResult.checks} checks.`);

    // Bổ sung kiểm chứng chuyên biệt: Làm rõ nội bộ KHÔNG dừng SLA vs Bổ sung chứng từ DN DỪNG SLA
    const { db, app } = h;
    const { WorkflowService } = require('../dist/modules/workflow/workflow.service');
    const { AppraisalService } = require('../dist/modules/appraisal/appraisal.service');
    const workflow = app.get(WorkflowService, { strict: false });
    const appraisal = app.get(AppraisalService, { strict: false });

    // Tạo hồ sơ thẩm định mới
    const cbtdRole = await db.role.findUniqueOrThrow({ where: { code: 'CBTD' } });
    const approverRole = await db.role.findUniqueOrThrow({ where: { code: 'THAM_QUYEN' } });
    const cbtd = await db.user.create({
      data: {
        username: 'pa1_test_cbtd',
        email: 'pa1_cbtd@example.test',
        fullName: 'PA1 CBTD',
        passwordHash: 'synthetic',
        roles: { create: { roleId: cbtdRole.id } }
      }
    });
    const approver = await db.user.create({
      data: {
        username: 'pa1_test_approver',
        email: 'pa1_approver@example.test',
        fullName: 'PA1 Approver',
        passwordHash: 'synthetic',
        roles: { create: { roleId: approverRole.id } }
      }
    });

    // Đảm bảo chính sách PA1 đã được kích hoạt
    await db.slaPolicyActivation.create({
      data: { policyCode: 'PA1', calendarVersion: 'SIM-20261026-20261108-v1', activatedAt: new Date('2026-10-26T08:00:00+07:00') }
    });

    const company = await db.company.create({
      data: {
        taxCode: '0109999999',
        companyName: 'PA1 Test Company',
        industry: 'Dich vu',
        establishedYear: 2021,
        annualRevenue: 5e9,
        charterCapital: 1e9,
        representativeName: 'Nguyen Van PA1',
        phone: '0988888888',
        address: 'Hanoi'
      }
    });

    const loan = await db.loanApplication.create({
      data: {
        applicationCode: 'PA1-EXP-' + randomUUID().slice(0, 8),
        companyId: company.id,
        loanPurpose: 'Von luu dong',
        loanType: 'VAY_VON_LUU_DONG',
        proposedAmount: 100000000,
        officialAmount: 100000000,
        loanTermMonths: 12,
        assignedTo: cbtd.id,
        currentStage: 'TIEP_NHAN',
        currentStatus: 'CHECKED',
        isDocumentComplete: true,
        businessPolicyVersion: 'SME_BRANCH_20261031_V1'
      }
    });

    // Tạo tờ trình và submit
    const REPORT_FIELDS = ['legalAssessment','businessAssessment','financialAssessment','repaymentSource','collateralAssessment','risks','recommendation','proposedInterestRate','proposedConditions'];
    const content = Object.fromEntries(REPORT_FIELDS.map(k => [k, k === 'proposedInterestRate' ? '8' : 'Synthetic evidence: ' + k]));
    
    // Chuyển sang Thẩm định bằng cách submit Tờ trình Bản 1 (tự động chuyển công đoạn sang THAM_DINH)
    let rep = await appraisal.view(loan.id);
    await appraisal.mutate(loan.id, 'DRAFT_SAVED', { expectedRevision: rep?.revision ?? 0, clientRequestId: randomUUID(), content }, { id: cbtd.id, activeRole: 'CBTD' });
    rep = await appraisal.view(loan.id);
    await appraisal.mutate(loan.id, 'SUBMITTED', { expectedRevision: rep.revision, clientRequestId: randomUUID() }, { id: cbtd.id, activeRole: 'CBTD' });

    // Kiểm tra lịch sử công đoạn Thẩm định
    let stageHistory = await db.applicationStageHistory.findFirst({
      where: { applicationId: loan.id, stage: { stageCode: 'THAM_DINH' } },
      include: { stage: true }
    });
    assert.ok(stageHistory, 'THAM_DINH stage history exists');
    assert.equal(stageHistory.slaPolicy, 'PA1', 'Stage history captures PA1 policy');
    assert.equal(stageHistory.slaStandardHours, 24, 'Stage history captures 24h standard SLA');
    assert.equal(stageHistory.pausedAt, null, 'Active stage starts with pausedAt = null');

    // Thẩm quyền yêu cầu LÀM RÕ NỘI BỘ (Clarification)
    rep = await appraisal.view(loan.id);
    await appraisal.mutate(loan.id, 'CLARIFICATION_REQUESTED', { expectedRevision: rep.revision, clientRequestId: randomUUID(), message: 'Can lam ro nguon tra no' }, { id: approver.id, activeRole: 'THAM_QUYEN' });

    // Kiểm tra: Làm rõ nội bộ KHÔNG ĐƯỢC dừng SLA!
    stageHistory = await db.applicationStageHistory.findFirst({
      where: { applicationId: loan.id, stage: { stageCode: 'THAM_DINH' } }
    });
    assert.equal(stageHistory.pausedAt, null, 'Internal clarification DOES NOT pause SLA (pausedAt remains null)');
    const pausesDuringClarification = await db.applicationStagePause.count({
      where: { historyId: stageHistory.id }
    });
    assert.equal(pausesDuringClarification, 0, 'No pause interval inserted into application_stage_pauses during clarification');
    console.log('Verified: Internal clarification does NOT pause SLA (pausedAt === null, 0 pauses).');

    const result = {
      pass: true,
      totalChecks: baseResult.checks + 4,
      criteria: {
        calendarActivation: 'VERIFIED: Before T0 uses legacy 24/7; After T0 uses PA1 with SIMULATED_CALENDAR_V1 bank hours',
        stageSnapshot: 'VERIFIED: ApplicationStageHistory snapshots slaStandardHours, slaPolicy PA1 and calendarVersion at entry',
        pauseInterval: 'VERIFIED: Supplement pending creates open interval in application_stage_pauses',
        resumeCalculation: 'VERIFIED: Enterprise fulfillment closes pause interval and extends deadline by net banking hours',
        internalClarificationNoPause: 'VERIFIED: Clarification leaves pausedAt = null with 0 pause intervals recorded'
      },
      schema: h.schema
    };

    const outDir = path.join(repoRoot, 'evidence', 'reviews', 'integration');
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'pa1-acceptance.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log('\nPA1 Acceptance results saved to evidence/reviews/integration/pa1-acceptance.json');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (h) await h.close();
  }
}

main().catch((err) => {
  console.error('PA1_VERIFICATION_FAILED:', err);
  process.exitCode = 1;
});
