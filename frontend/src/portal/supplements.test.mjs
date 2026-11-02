import assert from 'node:assert/strict';
import test from 'node:test';
import { currentManifest, canRespond, canResolve, canReturn, supplementError, loadStaffSupplements, supplementHeads, extractAcceptedSupplementFiles } from './supplements.ts';

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

test('return list is offered only after every item is checked, once per review round', () => {
  const reviewed = { status: 'PENDING', items: [{ id: 'a', status: 'ACCEPTED' }, { id: 'b', status: 'REPLACE_REQUIRED' }], events: [{ type: 'REQUESTED' }, { type: 'RESPONDED' }, { type: 'REPLACE_REQUIRED' }, { type: 'ACCEPTED' }] };
  assert.equal(canReturn(reviewed), true);
  // Còn mục doanh nghiệp đã gửi chưa kiểm tra: chưa hoàn tất lượt kiểm tra.
  assert.equal(canReturn({ ...reviewed, items: [{ id: 'a', status: 'SUBMITTED' }, { id: 'b', status: 'REPLACE_REQUIRED' }] }), false);
  // Không có mục cần sửa thì không có gì để gửi.
  assert.equal(canReturn({ ...reviewed, items: [{ id: 'a', status: 'ACCEPTED' }] }), false);
  // Đã gửi cho lượt kiểm tra này thì không gửi lại.
  assert.equal(canReturn({ ...reviewed, events: [...reviewed.events, { type: 'RETURNED' }] }), false);
  // Vòng kiểm tra mới sau khi doanh nghiệp gửi lại lại cho phép gửi.
  assert.equal(canReturn({ ...reviewed, events: [...reviewed.events, { type: 'RETURNED' }, { type: 'RESPONDED' }, { type: 'REPLACE_REQUIRED' }] }), true);
  assert.equal(canReturn({ ...reviewed, status: 'RESOLVED' }), false);
});

test('supplementHeads correctly resolves replacement chain A -> B -> C', () => {
  const fileA = { id: 'fa', itemId: 'item1', version: 1 };
  assert.deepEqual(supplementHeads([fileA]), [fileA]);

  const fileB = { id: 'fb', itemId: 'item1', supersedesId: 'fa', version: 2 };
  assert.deepEqual(supplementHeads([fileA, fileB]), [fileB]);

  const fileC = { id: 'fc', itemId: 'item1', supersedesId: 'fb', version: 3 };
  assert.deepEqual(supplementHeads([fileA, fileB, fileC]), [fileC]);

  const fileD = { id: 'fd', itemId: 'item2', version: 1 };
  assert.deepEqual(supplementHeads([fileA, fileB, fileC, fileD]), [fileC, fileD]);
});

test('extractAcceptedSupplementFiles extracts only accepted head files and preserves history', () => {
  const requests = [
    {
      id: 'supp1',
      portalSupplement: {
        items: [
          { id: 'item1', documentGroup: 'A', documentTypeCode: 'GPKD', status: 'ACCEPTED' },
          { id: 'item2', documentGroup: 'B', documentTypeCode: 'BCTC', period: '2025', status: 'REPLACE_REQUIRED' },
          { id: 'item3', documentGroup: 'C', documentTypeCode: 'HD', status: 'SUBMITTED' },
        ],
        files: [
          { id: 'fa', itemId: 'item1', fileName: 'gpkd_v1.pdf', fileSize: 1024, version: 1, submittedAt: '2026-11-01' },
          { id: 'fb', itemId: 'item1', fileName: 'gpkd_v2.pdf', fileSize: 2048, version: 2, supersedesId: 'fa', submittedAt: '2026-11-02' },
          { id: 'fc', itemId: 'item2', fileName: 'bctc.pdf', fileSize: 4096, version: 1, submittedAt: '2026-11-01' },
          { id: 'fd', itemId: 'item3', fileName: 'hd.pdf', fileSize: 8192, version: 1, submittedAt: '2026-11-01' },
        ],
      },
    },
  ];

  const extracted = extractAcceptedSupplementFiles(requests);
  // Only fb (head of item1, which is ACCEPTED) should be extracted.
  // fa is superseded by fb.
  // fc is REPLACE_REQUIRED (not ACCEPTED).
  // fd is SUBMITTED (not ACCEPTED).
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].id, 'fb');
  assert.equal(extracted[0].fileName, 'gpkd_v2.pdf');
  assert.equal(extracted[0].supplementId, 'supp1');
  assert.equal(extracted[0].documentType, 'A · GPKD');
  assert.equal(extracted[0].version, 2);
});
