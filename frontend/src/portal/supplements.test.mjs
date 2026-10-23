import assert from 'node:assert/strict';
import test from 'node:test';
import { currentManifest, canRespond, canResolve, supplementError, loadStaffSupplements } from './supplements.ts';

const view = { status: 'PENDING', items: [{ id: 'a', status: 'PENDING' }, { id: 'b', status: 'REPLACE_REQUIRED' }, { id: 'c', status: 'ACCEPTED' }], files: [
  { id: 'a1', itemId: 'a', version: 1, submittedAt: 'before' }, { id: 'a2', itemId: 'a', version: 2 },
  { id: 'b1', itemId: 'b', version: 1, submittedAt: 'before' }, { id: 'c1', itemId: 'c', version: 1 },
] };
test('response uses only latest unsent files for pending items and requires every pending item', () => {
  assert.deepEqual(currentManifest(view), ['a2']);
  assert.equal(canRespond(view), false);
  const ready = { ...view, files: [...view.files, { id: 'b2', itemId: 'b', version: 2 }] };
  assert.deepEqual(currentManifest(ready), ['a2', 'b2']);
  assert.equal(canRespond(ready), true);
  assert.equal(canRespond({ ...ready, status: 'RESOLVED' }), false);
});
test('submitted items cannot be resubmitted and resolution requires accepted structured items', () => {
  const submitted = { ...view, items: [{ id: 'a', status: 'SUBMITTED' }] };
  assert.deepEqual(currentManifest(submitted), []);
  assert.equal(canRespond(submitted), false);
  assert.equal(canResolve(view), false);
  assert.equal(canResolve({ ...view, items: [{ id: 'a', status: 'ACCEPTED' }] }), true);
  assert.equal(canResolve({ ...view, items: [] }), false);
});
test('revision conflicts explain refreshing while preserving server error detail', () => {
  assert.match(supplementError({ status: 409, message: 'revision mismatch' }), /revision mismatch/);
  assert.match(supplementError({ status: 409, message: 'revision mismatch' }), /tải lại/i);
  assert.equal(supplementError(new Error('Tệp không hợp lệ')), 'Tệp không hợp lệ');
});
test('staff refresh discovers a committed request after its create response was lost', async () => {
  const calls = [];
  const committed = { id: 'newly-created', ...view };
  const result = await loadStaffSupplements('loan', async path => {
    calls.push(path);
    if (path === '/supplements/application/loan') return [{ id: 'newly-created', notes: 'PRIVATE', portalSupplement: { secret: true } }];
    if (path === '/supplements/newly-created/portal-details') return committed;
    throw new Error(`Unexpected ${path}`);
  });
  assert.deepEqual(result, [committed]);
  assert.deepEqual(calls, ['/supplements/application/loan', '/supplements/newly-created/portal-details']);
  assert.equal(result.some(item => item.status === 'PENDING'), true);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|secret/);
});
