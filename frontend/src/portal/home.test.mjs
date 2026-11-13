import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeHome } from './home.ts';

const req = (id, status, extra = {}) => ({ id, reference: `DN-${id}`, status, data: { companyName: `Cty ${id}` }, ...extra });
const done = (code, label, message = 'm', rejection) => ({ status: { code, label, message }, rejection });

test('counts split requests by where they are in the process', () => {
  const s = summarizeHome([req('a', 'DRAFT'), req('b', 'SUBMITTED'), req('c', 'ASSIGNED'), req('d', 'RETURNED'), req('e', 'ACCEPTED', { loanId: 'L' }), req('f', 'ACCEPTED', { loanId: 'L2' })], {}, { f: done('APPROVED', 'Đã được phê duyệt') });
  assert.deepEqual(s.counts, { draft: 1, waitingBank: 2, returned: 1, inProgress: 1, decided: 1 });
});

test('final results show approval and rejection with the public reason', () => {
  const s = summarizeHome([req('a', 'ACCEPTED', { loanId: 'L' }), req('b', 'ACCEPTED', { loanId: 'L2' })], {}, {
    a: done('APPROVED', 'Đã được phê duyệt'), b: done('REJECTED', 'Không được chấp thuận', 'm', { label: 'Năng lực tài chính không đảm bảo' }),
  });
  assert.deepEqual(s.results.map(r => [r.code, r.detail]), [['APPROVED', 'm'], ['REJECTED', 'Năng lực tài chính không đảm bảo']]);
});

test('a loan still being processed is not shown as a result and its pending supplements become an action', () => {
  const s = summarizeHome([req('a', 'ACCEPTED', { loanId: 'L' })], { a: 2 }, { a: done('APPRAISAL', 'Đang thẩm định') });
  assert.equal(s.results.length, 0);
  assert.equal(s.actions.length, 1);
  assert.match(s.actions[0].text, /2 yêu cầu bổ sung/);
});

test('actions are ordered: returned first, then supplements, then drafts', () => {
  const s = summarizeHome([req('a', 'DRAFT'), req('b', 'ACCEPTED', { loanId: 'L' }), req('c', 'RETURNED')], { b: 1 }, {});
  assert.deepEqual(s.actions.map(a => a.kind), ['RETURNED', 'SUPPLEMENT', 'DRAFT']);
});

test('a decided loan with an unreadable status does not hide its supplement or become a result', () => {
  const s = summarizeHome([req('a', 'ACCEPTED', { loanId: 'L' })], {}, {});
  assert.deepEqual(s.counts, { draft: 0, waitingBank: 0, returned: 0, inProgress: 1, decided: 0 });
});

test('the request list groups what the enterprise must do apart from what waits on the bank', async () => {
  const { listGroup, listCounts } = await import('./home.ts');
  const rows = [req('a', 'DRAFT'), req('b', 'RETURNED'), req('c', 'SUBMITTED'), req('d', 'ASSIGNED'), req('e', 'ACCEPTED', { loanId: 'L' }), req('f', 'ACCEPTED', { loanId: 'L2' }), req('g', 'ACCEPTED', { loanId: 'L3' })];
  const supplements = { e: 1 };
  const outcomes = { f: done('REJECTED', 'Không được chấp thuận'), g: done('APPRAISAL', 'Đang thẩm định') };
  assert.deepEqual(rows.map(r => listGroup(r, supplements, outcomes)), ['DRAFT', 'ACTION', 'WAITING', 'WAITING', 'ACTION', 'DECIDED', 'PROCESSING']);
  assert.deepEqual(listCounts(rows, supplements, outcomes), { ALL: 7, ACTION: 2, DRAFT: 1, WAITING: 2, PROCESSING: 1, DECIDED: 1 });
});
