import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewNotices, reviewField, reviewStatus } from './review.ts';

test('field notices are Vietnamese, mapped to their step and deduplicated across assessment sources', () => {
  const assessment = {
    issues: [{ path: 'representative.mode', step: 1, code: 'MISSING_DATA', message: 'Cần cung cấp: Tư cách người gửi.' }],
    formErrors: ['Thiếu thông tin: representative.mode', 'Thiếu thông tin điều kiện: representative.mode', 'Thiếu thông tin: annualRevenueBasis.documentId'],
    requirements: [],
  };
  const notices = reviewNotices({ approvedIntakeAssessment: assessment });
  assert.equal(notices.length, 2);
  assert.equal(notices.find(n => n.path === 'annualRevenueBasis.documentId').step, 4);
  assert.ok(notices.every(n => !/representative\.|annualRevenueBasis/.test(n.message)));
});

test('missing documents count requirements rather than files and deferred/inapplicable items do not become blockers', () => {
  const notices = reviewNotices({ approvedIntakeAssessment: {
    issues: [], formErrors: [], requirements: [
      { id: 'finance.notes', label: 'Thuyết minh báo cáo tài chính', state: 'MISSING' },
      { id: 'later.cashflow', label: 'Dòng tiền', state: 'LATER' },
      { id: 'legal.authorization', label: 'Ủy quyền', state: 'NOT_APPLICABLE' },
    ],
  } });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].step, 4);
  assert.match(notices[0].message, /Thuyết minh báo cáo tài chính/);
});

test('unknown backend errors remain visible without exposing technical field names', () => {
  const notices = reviewNotices({ formErrors: ['Thiếu thông tin: privateInternalField'] });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].severity, 'error');
  assert.doesNotMatch(notices[0].message, /privateInternalField/);
  assert.match(notices[0].message, /kiểm tra/);
});

test('warnings remain warnings, and current server errors win over draft suggestions for the same field', () => {
  const notices = reviewNotices({ approvedIntakeAssessment: { issues: [{ path: 'taxCode', step: 1, message: 'Mã số thuế chưa đúng.' }], formErrors: [], requirements: [] } }, [
    { path: 'taxCode', step: 1, severity: 'warning', message: 'Gợi ý bổ sung mã số thuế.' },
    { path: 'capitalPlan', step: 3, severity: 'warning', message: 'Tổng chi phí và nguồn vốn chưa cân đối.' },
  ]);
  assert.equal(notices.length, 2);
  assert.equal(notices.find(n => n.path === 'capitalPlan').severity, 'warning');
  assert.equal(reviewField('submissionDeclaration.version').step, 5);
});

test('review status explains existing guards without treating stale or absent assessments as ready', () => {
  const base = { editable: true, enabled: true, busy: false, conflict: false, pendingFiles: 0, dirty: false, fresh: true, hasAssessment: true, submitDisabled: false, checkError: false };
  assert.equal(reviewStatus(base).tone, 'ready');
  assert.equal(reviewStatus({ ...base, dirty: true, submitDisabled: true }).tone, 'pending');
  assert.equal(reviewStatus({ ...base, fresh: false, submitDisabled: true }).tone, 'pending');
  assert.equal(reviewStatus({ ...base, hasAssessment: false, submitDisabled: true }).tone, 'pending');
  assert.equal(reviewStatus({ ...base, checkError: true, submitDisabled: true }).tone, 'error');
  assert.equal(reviewStatus({ ...base, editable: false, submitDisabled: true }).tone, 'readonly');
});
