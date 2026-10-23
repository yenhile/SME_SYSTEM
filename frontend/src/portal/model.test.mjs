import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { draftPayload, validateRequest, requestStatus } from './model.ts';

test('submitted and assigned requests expose distinct waiting states', () => {
  assert.equal(requestStatus.SUBMITTED, 'Chờ phân công');
  assert.equal(requestStatus.ASSIGNED, 'Đã phân công — chờ tiếp nhận');
});
test('draft allows partial data and rejects invalid supplied values', () => {
  assert.deepEqual(validateRequest({}, false), {});
  assert.ok(validateRequest({ taxCode: '123' }, false).taxCode);
  assert.ok(validateRequest({ proposedAmount: 1 }, false).proposedAmount);
  assert.ok(validateRequest({ loanTermMonths: 121 }, false).loanTermMonths);
});
test('submit requires fields and six groups', () => {
  const errors = validateRequest({}, true, []);
  assert.ok(errors.companyName);
  assert.ok(errors.A);
  assert.ok(errors.F);
});
test('clearing optional draft inputs omits blank fields and retains numeric zero', () => {
  assert.deepEqual(draftPayload({ companyName: '  ', phone: '', annualRevenue: 0, proposedAmount: undefined, industry: '  Công nghiệp  ' }), { annualRevenue: 0, industry: 'Công nghiệp' });
});
