const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { UsersService } = require('../dist/modules/users/users.service');
const { withCoordination } = require('./helpers/coordination-fixture.cjs');

test('LH-02: account list counts open loans and pending Portal requests with the same rule that blocks locking', async () => {
  const listArgs = [];
  const prisma = {
    user: {
      findMany: async args => {
        listArgs.push(args);
        return [{ id: 'u1', username: 'cbtd', fullName: 'CBTD', email: 'c@x', phone: null, branchName: 'HCM', isActive: true, createdAt: new Date(0), roles: [{ role: { code: 'CBTD' } }], _count: { assignedLoans: 2, assignedPortalRequests: 1 } }];
      },
    },
  };
  const [row] = await new UsersService(prisma).findAll();
  assert.equal(row.workloadActiveLoans, 2);
  assert.equal(row.pendingPortalRequests, 1);

  const guardWhere = {};
  const tx = {
    $queryRaw: async () => [],
    loanApplication: { count: async ({ where }) => { guardWhere.loan = where; return 0; } },
    portalRequest: { count: async ({ where }) => { guardWhere.portal = where; return 0; } },
    user: { findUnique: async () => ({ id: 'u1', username: 'cbtd', roles: [{ role: { code: 'CBTD' } }] }), update: async () => ({}) },
    adminAuditLog: { createMany: async ({ data }) => ({ count: data.length }) },
  };
  await new UsersService(withCoordination({ $transaction: async fn => fn(tx), user: tx.user })).update('u1', { isActive: false }, 'admin-1');
  const counted = listArgs[0].include._count.select;
  assert.deepEqual({ assignedTo: 'u1', ...counted.assignedLoans.where }, guardWhere.loan, 'cùng điều kiện hồ sơ');
  assert.deepEqual({ assignedTo: 'u1', ...counted.assignedPortalRequests.where }, guardWhere.portal, 'cùng điều kiện đề nghị Portal');
});
