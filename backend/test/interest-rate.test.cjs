const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReport, proposedRateOf, decisionRateReason, rateDecisionView } = require('../dist/modules/appraisal/appraisal.logic');

const FULL = {
  legalAssessment: 'a', businessAssessment: 'b', financialAssessment: 'c', repaymentSource: 'd',
  collateralAssessment: 'e', risks: 'f', recommendation: 'g', proposedConditions: '',
};
const status = code => e => typeof e.getStatus === 'function' && e.getStatus() === code;

test('Tờ trình nhận lãi suất đề xuất dạng số 0–100, tối đa 2 chữ số thập phân', () => {
  for (const rate of ['0', '8', '8.5', '8.25', '100']) assert.equal(validateReport({ ...FULL, proposedInterestRate: rate }, true).proposedInterestRate, rate);
  assert.equal(validateReport({ ...FULL, proposedInterestRate: ' 8.25 ' }, true).proposedInterestRate, '8.25');
  for (const rate of ['8,25', '8.255', '100.01', '101', '-1', 'abc', '.5', '8.', '1e1'])
    assert.throws(() => validateReport({ ...FULL, proposedInterestRate: rate }), status(400), rate);
});

test('Lãi suất đề xuất bắt buộc khi trình, được để trống khi lưu nháp', () => {
  assert.equal(validateReport({ legalAssessment: 'x' }).proposedInterestRate, '');
  assert.throws(() => validateReport(FULL, true), status(400));
  assert.doesNotThrow(() => validateReport({ ...FULL, proposedInterestRate: '9' }, true));
});

test('Đọc lãi suất đề xuất từ nội dung tờ trình đã trình', () => {
  assert.equal(proposedRateOf({ proposedInterestRate: '8.25' }), 8.25);
  assert.equal(proposedRateOf({ recommendation: 'x' }), null);
  assert.equal(proposedRateOf({ proposedInterestRate: '' }), null);
  assert.equal(proposedRateOf(null), null);
});

test('Lý do khi lãi suất phê duyệt khác đề xuất', () => {
  assert.equal(decisionRateReason(8.25, 8.25, 'thừa'), null);
  assert.equal(decisionRateReason(9, null, 'thừa'), null);
  assert.equal(decisionRateReason(9, 8.25, '  Lý do  '), 'Lý do');
  assert.throws(() => decisionRateReason(9, 8.25, ''), status(400));
  assert.throws(() => decisionRateReason(9, 8.25, undefined), status(400));
  assert.throws(() => decisionRateReason(9, 8.25, 'x'.repeat(2001)), status(400));
});

test('Kết quả quyết định đọc mức đề xuất và lý do đã lưu', () => {
  assert.equal(rateDecisionView(null), null);
  assert.deepEqual(rateDecisionView({ approvedInterestRate: 9, proposedInterestRate: 8.25, interestRateReason: 'Lý do' }), { proposedInterestRate: 8.25, interestRateReason: 'Lý do', band: null });
  assert.deepEqual(rateDecisionView({ approvedInterestRate: 9, proposedInterestRate: null, interestRateReason: null }), { proposedInterestRate: null, interestRateReason: null, band: null });
});
