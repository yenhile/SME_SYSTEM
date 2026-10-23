// Runs against a local seeded instance and removes only records created by this run.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const db = new PrismaClient();
const base = process.env.TEST_API_URL || 'http://localhost:3001/api';
const tag = `check_${randomUUID().replaceAll('-', '')}`;
const userIds = [], loanIds = [], companyIds = [];
let passed = 0;
async function call(path, session, method = 'GET', body, status = 200) {
  const headers = {};
  if (session) { headers.Authorization = `Bearer ${session.token}`; headers['X-Active-Role'] = session.role; }
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text();
  assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  passed++;
  return data;
}
async function login(username, password, role) {
  const result = await call('/auth/login', null, 'POST', { username, password }, 201);
  return { token: result.accessToken, role, user: result.user };
}
const loanDto = amount => ({ taxCode: tag, companyName: `Test ${tag}`, industry: 'Sản xuất', establishedYear: 2015, annualRevenue: 20000000000, charterCapital: 5000000000, representativeName: 'Test', phone: '0900000000', address: 'Test', loanPurpose: 'Integration check', loanType: 'VAY_VON_LUU_DONG', proposedAmount: amount, loanTermMonths: 12 });
const transition = (stage, status, other = {}) => ({ targetStage: stage, targetStatus: status, ...other });
async function main() {
  await call('/loan-applications', null, 'GET', undefined, 401);
  await call('/loan-applications', { token: 'demo_jwt_token_123', role: 'CBTD' }, 'GET', undefined, 401);
  await call('/auth/login', null, 'POST', { username: 'test_cbtd', password: 'incorrect' }, 401);
  const admin = await login('test_admin', '123456', 'ADMIN');
  const manager = await login('test_quan_ly', '123456', 'QUAN_LY');
  const other = await login('test_cbtd', '123456', 'CBTD');
  await call('/loan-applications', admin, 'GET', undefined, 403);
  await call('/admin/workflow-stages', other, 'GET', undefined, 403);
  await call('/users', other, 'GET', undefined, 403);
  await call('/dashboard/overview', other, 'GET', undefined, 403);
  await call('/users', admin, 'POST', { username: tag, password: 'Check@12345', fullName: tag, email: `${tag}@example.test`, roles: [] }, 400);
  const created = await call('/users', admin, 'POST', { username: tag, password: 'Check@12345', fullName: tag, email: `${tag}@example.test`, roles: ['CBTD', 'THAM_QUYEN'] }, 201);
  userIds.push(created.user.id);
  assert.deepEqual([...created.user.roles].sort(), ['CBTD', 'THAM_QUYEN']);
  const cbtd = await login(tag, 'Check@12345', 'CBTD');
  const risk = { ...cbtd, role: 'THAM_QUYEN' };
  const expired = new JwtService({ secret: process.env.JWT_SECRET || 'sme_loan_workflow_secret_key_2026' }).sign({ sub: cbtd.user.id }, { expiresIn: -1 });
  await call('/auth/me', { token: expired, role: 'CBTD' }, 'GET', undefined, 401);
  await call('/loan-applications', { ...cbtd, role: 'QUAN_LY' }, 'GET', undefined, 403);
  await call('/loan-applications', manager, 'POST', loanDto(500000000), 403);
  const createLoan = async amount => {
    const result = await call('/loan-applications', cbtd, 'POST', loanDto(amount), 201);
    loanIds.push(result.loan.id); if (!companyIds.includes(result.loan.companyId)) companyIds.push(result.loan.companyId);
    return result.loan;
  };
  const loan = await createLoan(500000000);
  const route = `/workflow/${loan.id}/transition`;
  await call(`/loan-applications/${loan.id}`, other, 'GET', undefined, 403);
  await call(route, cbtd, 'POST', transition('THAM_DINH', 'PENDING_APPRAISAL'), 400);
  const matches = await call(`/loan-applications?keyword=${tag}&stage=TIEP_NHAN&status=RECEIVED&myOnly=true`, cbtd);
  assert.equal(matches.length, 1); assert.equal(matches[0].id, loan.id);
  assert.equal((await call(`/loan-applications?keyword=${tag}&status=APPROVED`, cbtd)).length, 0);
  await call('/loan-applications?stage=INVALID', cbtd, 'GET', undefined, 400);
  const file = new FormData(); file.append('documentType', 'PHAP_LY'); file.append('file', new Blob(['document-content']), 'check.txt');
  const doc = await call(`/documents/${loan.id}`, cbtd, 'POST', file, 201);
  assert.equal(doc.fileSize, 16);
  assert.equal(await call(`/documents/${doc.id}/download`, cbtd), 'document-content');
  await call(`/documents/${doc.id}/download`, other, 'GET', undefined, 403);
  await call(`/documents/${doc.id}`, cbtd, 'DELETE');
  const supp = await call(`/supplements/${loan.id}`, cbtd, 'POST', { requestContent: 'Bổ sung chứng từ' }, 201);
  await call(route, cbtd, 'POST', transition('THAM_DINH', 'PENDING_APPRAISAL'), 400);
  await call(`/supplements/${supp.id}/resolve`, cbtd, 'PUT', { notes: 'Đã bổ sung' });
  await call(`/supplements/${supp.id}/resolve`, cbtd, 'PUT', {}, 400);
  await call(`/loan-applications/${loan.id}/check-documents`, cbtd, 'PUT', { isComplete: 'true' }, 400);
  await call(`/loan-applications/${loan.id}/check-documents`, cbtd, 'PUT', { isComplete: true });
  await call(`/loan-applications/${loan.id}/set-amount`, cbtd, 'PUT', { officialAmount: 500000000 });
  await call(route, cbtd, 'POST', transition('HOAN_TAT', 'APPROVED', { approvedAmount: 500000000, interestRate: 8 }), 400);
  const attempts = await Promise.all([1, 2].map(async () => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cbtd.token}`, 'X-Active-Role': 'CBTD' }, body: JSON.stringify(transition('THAM_DINH', 'PENDING_APPRAISAL')) });
    await response.text(); return response.status;
  }));
  assert.deepEqual(attempts.sort(), [201, 403]); passed++;
  await call(route, risk, 'POST', transition('TIEP_NHAN', 'RECEIVED'), 400);
  await call(route, risk, 'POST', transition('HOAN_TAT', 'APPROVED', { approvedAmount: 500000000, interestRate: 8 }), 201);
  const final = await call(`/loan-applications/${loan.id}`, risk);
  assert.equal(final.id, loan.id); assert.equal(final.currentStatus, 'APPROVED'); assert.equal(final.stageHistories.length, 3);
  assert(final.stageHistories.every(history => history.exitedAt));
  await call(route, risk, 'POST', transition('CAP_TREN', 'WAITING_HEAD_OFFICE'), 403);
  await call(`/loan-applications/${loan.id}/check-documents`, cbtd, 'PUT', { isComplete: false }, 403);
  const big = await createLoan(15000000000);
  await call(`/loan-applications/${big.id}/check-documents`, cbtd, 'PUT', { isComplete: true });
  await call(`/workflow/${big.id}/transition`, cbtd, 'POST', transition('THAM_DINH', 'PENDING_APPRAISAL'), 201);
  await call(`/workflow/${big.id}/transition`, risk, 'POST', transition('HOAN_TAT', 'APPROVED', { approvedAmount: 15000000000, interestRate: 8 }), 400);
  await call(`/workflow/${big.id}/transition`, risk, 'POST', transition('CAP_TREN', 'WAITING_HEAD_OFFICE'), 201);
  await call(`/workflow/${big.id}/transition`, risk, 'POST', transition('HOAN_TAT', 'REJECTED', { rejectionReasonCode: 'TC02', rejectionNote: 'Test rejection' }), 201);
  const sla = await call('/admin/workflow-stages', admin);
  await call(`/admin/workflow-stages/${sla[0].stageCode}`, admin, 'PUT', { stageName: sla[0].stageName, standardSlaHours: sla[0].standardSlaHours });
  const account = await call(`/users/${cbtd.user.id}`, admin);
  assert.equal(account.passwordHash, undefined);
  await call(`/users/${cbtd.user.id}`, admin, 'PUT', { roles: ['THAM_QUYEN'] });
  await call('/loan-applications', cbtd, 'GET', undefined, 403);
  await call(`/users/${cbtd.user.id}`, admin, 'PUT', { isActive: false });
  await call('/auth/me', risk, 'GET', undefined, 401);
  console.log(`PASS: ${passed} API checks; JWT, role selection/revocation, ownership, filters, files, supplements, transitions, escalation, admin.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await db.loanApplication.deleteMany({ where: { id: { in: loanIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
