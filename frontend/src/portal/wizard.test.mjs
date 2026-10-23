import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeV2, validateV2, capitalTotals, sameDraft } from './wizard.ts';

test('JSONB key order does not create a false conflict and array order remains meaningful', () => {
  assert.equal(sameDraft({ contactName: 'A', contactEmail: 'a@example.test', capitalPlan: { ownFunds: 0, costs: [{ name: 'A', amount: 1 }] } }, { capitalPlan: { costs: [{ amount: 1, name: 'A' }], ownFunds: 0 }, contactEmail: 'a@example.test', contactName: 'A' }), true);
  assert.equal(sameDraft({ capitalPlan: { costs: [{ name: 'A' }, { name: 'B' }] } }, { capitalPlan: { costs: [{ name: 'B' }, { name: 'A' }] } }), false);
});

test('normalization preserves zero, false and partial cost rows while removing blanks recursively', () => {
  const data = { companyName: '  Công ty  ', contactEmail: ' ', hasExistingDebt: false, capitalPlan: { ownFunds: 0, costs: [{ name: ' ', amount: 0 }, { name: ' Máy ', plannedAt: '' }, {}] } };
  assert.deepEqual(normalizeV2(data), { companyName: 'Công ty', hasExistingDebt: false, capitalPlan: { ownFunds: 0, costs: [{ amount: 0 }, { name: 'Máy' }, {}] } });
  assert.equal(data.companyName, '  Công ty  ');
});
test('empty and partial drafts have no errors, review suggestions remain warnings', () => {
  assert.deepEqual(validateV2({}), []);
  assert.deepEqual(validateV2({ capitalPlan: { costs: [{ name: 'Máy' }, { amount: 0 }] } }), []);
  assert.ok(validateV2({}, true).length > 0);
  assert.ok(validateV2({}, true).every(issue => issue.severity === 'warning' && issue.step >= 1 && issue.step <= 5));
});
test('annual source declaration is partial-draft safe and rejects unknown keys or non-boolean confirmation',()=>{
  assert.deepEqual(validateV2({annualRevenueBasis:{documentId:'source',fullYearCompleted:true}}),[]);
  assert.ok(validateV2({annualRevenueBasis:{fullYearCompleted:'true'}}).some(x=>x.path==='annualRevenueBasis.fullYearCompleted'));
  assert.ok(validateV2({annualRevenueBasis:{secret:'bad'}}).length);
});
test('supplied invalid values report their paths and relevant steps', () => {
  const issues = validateV2({ establishedDate: '2025-02-29', revenuePeriod: '2026-Q5', contactEmail: 'bad', contactPhone: 'abc', proposedAmount: 1, loanTermMonths: 1.5, capitalPlan: { ownFunds: -1, otherFunds: 1e16, costs: [{ amount: NaN, plannedAt: '2026-04-31' }] } });
  for (const path of ['establishedDate','revenuePeriod','contactEmail','contactPhone','proposedAmount','loanTermMonths','capitalPlan.ownFunds','capitalPlan.otherFunds','capitalPlan.costs.0.amount','capitalPlan.costs.0.plannedAt']) assert.ok(issues.some(issue => issue.path === path && issue.severity === 'error'), path);
});
test('real leap dates, periods and inclusive zero funds are accepted', () => {
  assert.deepEqual(validateV2({ establishedDate: '2024-02-29', establishedYear: 2024, revenuePeriod: '2026-Q4', hasExistingDebt: false, contactPhone: '+84901234567', contactEmail: 'a@b.vn', capitalPlan: { ownFunds: 0, costs: [{ amount: 0 }] } }), []);
  for (const revenuePeriod of ['2026','2026-12','2026-Q1']) assert.deepEqual(validateV2({ revenuePeriod }), []);
});
test('date ordering and mismatched establishment year are errors', () => {
  const issues = validateV2({ establishedDate: '2024-02-29', establishedYear: 2023, capitalPlan: { useFrom: '2026-12-01', useTo: '2026-01-01' } });
  assert.ok(issues.some(issue => issue.path === 'establishedYear' && issue.severity === 'error'));
  assert.ok(issues.some(issue => issue.path === 'capitalPlan.useTo' && issue.severity === 'error'));
});
test('totals use the single bank amount and imbalance never blocks draft', () => {
  const data = { proposedAmount: 10000000, capitalPlan: { costs: [{ amount: 16000000 }, { name: 'Chưa có số' }], ownFunds: 2000000, otherFunds: 1000000 } };
  assert.deepEqual(capitalTotals(data), { totalCosts: 16000000, ownFunds: 2000000, otherFunds: 1000000, bankAmount: 10000000, totalSources: 13000000, difference: 3000000 });
  assert.ok(validateV2(data).some(issue => issue.severity === 'warning' && issue.path === 'capitalPlan'));
  assert.equal(validateV2(data).filter(issue => issue.severity === 'error').length, 0);
});
test('runtime malformed nested data reports structural errors', () => {
  for (const data of [{ capitalPlan: [] }, { capitalPlan: { costs: [null] } }, { collateral: { mode: 'NO' } }, { hasExistingDebt: 'false' }, { contactName: 12 }, { companyName: 123 }]) assert.ok(validateV2(data).some(issue => issue.severity === 'error'));
});
test('unknown fields and non-plain structures are rejected instead of silently posted', () => {
  for (const data of [{ unexpected: 'x' }, { capitalPlan: { bankAmount: 100 } }, { capitalPlan: { costs: [{ unexpected: 'x' }] } }, { collateral: { unexpected: true } }, { collateral: new Date() }]) assert.ok(validateV2(data).some(issue => issue.severity === 'error'));
});
