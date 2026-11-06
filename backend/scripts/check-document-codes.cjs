// Only creates an owned, disposable PostgreSQL container. Never reads DATABASE_URL or the SME database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
require('reflect-metadata');
if (!process.argv.includes('--isolated')) throw Error('Use --isolated to run in a disposable PostgreSQL container');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'evidence/reviews/document-codes-20261105');
const renumber = process.argv.includes('--renumber');
const migration = fs.readFileSync(path.join(root, 'backend/prisma/document-codes.sql'), 'utf8');
const result = { environment: 'Owned temporary postgres:16-alpine container; synthetic data only', checks: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function run(command, args, input, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, env: { ...process.env, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(Error('Command timed out: ' + command)); }, 120000);
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout.trim()) : reject(Error(command + ' failed: ' + stderr + stdout)); });
    child.stdin.on('error', () => {}); child.stdin.end(input || '');
  });
}
function check(label, actual, expected = true) { assert.deepEqual(actual, expected, label); result.checks.push({ label, pass: true }); }
const previous = require.extensions['.ts'];
let PortalService, LoanApplicationsService, nextDocumentCode;
try {
  require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true } }).outputText, f);
  ({ PortalService } = require('../src/modules/portal/portal.service.ts'));
  ({ LoanApplicationsService } = require('../src/modules/loan-applications/loan-applications.service.ts'));
  ({ nextDocumentCode } = require('../src/common/document-codes.ts'));
} finally { if (previous) require.extensions['.ts'] = previous; else delete require.extensions['.ts']; }
Object.assign(process.env, { NODE_ENV: 'test', PORTAL_V2_ROLLOUT_ENABLED: 'false', PORTAL_FOUNDATION_PREVIEW: 'true', PORTAL_V2_INTAKE_CYCLE_ENABLED: 'false' });
let container, db, db2, seeded;
const database = 'codes_check', user = 'codes_check', label = 'codex.sme.document-codes';
const psql = (sql, name = database) => run('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', name], sql);
async function ready() {
  for (let i = 0; i < 80; i++) { try { await run('docker', ['exec', container, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U codes_check -d codes_check']); return; } catch { await sleep(150); } }
  throw Error('Temporary PostgreSQL did not become ready');
}
const valid = { taxCode: '1000000001', companyName: 'Synthetic codes company', industry: 'Manufacturing', establishedYear: 2020, annualRevenue: 1000000000, charterCapital: 1000000000, representativeName: 'Synthetic representative', phone: '0900000000', address: 'Synthetic address', loanPurpose: 'Working capital', loanType: 'VAY_VON_LUU_DONG', proposedAmount: 1000000000, loanTermMonths: 12 };
async function main() {
  container = await run('docker', ['run', '-d', '--pull=never', '--name', 'sme-code-check-' + Date.now(), '--label', label + '=isolated', '-e', 'POSTGRES_USER=' + user, '-e', 'POSTGRES_DB=' + database, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
  assert.match(container, /^[a-f0-9]{64}$/);
  await ready();
  let port = (await run('docker', ['port', container, '5432/tcp'])).match(/127\.0\.0\.1:(\d+)/)[1];
  const url = name => `postgresql://${user}@127.0.0.1:${port}/${name}?schema=public`;
  const ddl = await run(process.execPath, [path.join(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'backend/prisma/schema.prisma'), '--script'], undefined, { DATABASE_URL: url(database) });
  await psql(ddl); await psql(migration);
  db = new PrismaClient({ datasources: { db: { url: url(database) } } });
  db2 = new PrismaClient({ datasources: { db: { url: url(database) } } });
  const portal = new PortalService(db), portal2 = new PortalService(db2), bank = new LoanApplicationsService(db);
  const account = await db.portalAccount.create({ data: { email: 'codes@example.test', passwordHash: 'synthetic-not-a-login-hash', contactName: 'Synthetic contact', phone: '0900000000', verifiedAt: new Date() } });
  const role = await db.role.create({ data: { code: 'CBTD', name: 'Synthetic loan officer' } });
  const officer = await db.user.create({ data: { username: 'codes-officer', email: 'officer@example.test', fullName: 'Synthetic officer', passwordHash: 'synthetic-not-a-login-hash', roles: { create: { roleId: role.id } } } });
  await db.workflowStage.create({ data: { stageCode: 'TIEP_NHAN', stageName: 'Synthetic intake', standardSlaHours: 24, orderIndex: 1 } });

  const first = await portal.create(account.id, { data: valid });
  check('Portal first draft uses DN-1', first.reference, 'DN-1');
  check('Internal UUID is preserved', /^[a-f0-9-]{36}$/.test(first.id));
  const direct = await bank.create({ ...valid, taxCode: '1000000002' }, officer.id);
  check('Counter creation uses SME-1 independently of DN', direct.loan.applicationCode, 'SME-1');
  await db.portalRequest.update({ where: { id: first.id }, data: { status: 'ASSIGNED', assignedTo: officer.id } });
  const accepted = await portal.accept(first.id, officer.id);
  const acceptedLoan = await db.loanApplication.findUniqueOrThrow({ where: { id: accepted.loanId } });
  check('Portal acceptance shares the same SME counter', acceptedLoan.applicationCode, 'SME-2');
  check('Acceptance retains original DN reference', accepted.request.reference, 'DN-1');
  const replay = await portal.accept(first.id, officer.id);
  check('Acceptance replay retains the same linked loan', replay.loanId, accepted.loanId);
  const nextBank = await bank.create({ ...valid, taxCode: '1000000003' }, officer.id);
  check('Acceptance replay consumes no extra SME code', nextBank.loan.applicationCode, 'SME-3');
  const key = randomUUID();
  const same = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? portal : portal2).create(account.id, { formVersion: 2, clientRequestId: key, data: {} })));
  check('Concurrent V2 retries produce one request and reference', [...new Set(same.map(row => row.reference))], ['DN-2']);
  check('Concurrent V2 retries preserve one UUID', [...new Set(same.map(row => row.id))], [key]);
  check('Concurrent retry is stored once', await db.portalRequest.count({ where: { id: key } }), 1);
  const distinct = await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? portal : portal2).create(account.id, { formVersion: 2, clientRequestId: randomUUID(), data: {} })));
  check('24 concurrent requests have 24 distinct short codes', new Set(distinct.map(row => row.reference)).size, 24);
  check('Concurrent requests allocate DN-3 through DN-26', distinct.map(row => Number(row.reference.slice(3))).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 3));
  const allocated = await Promise.all(Array.from({ length: 24 }, (_, i) => nextDocumentCode(i % 2 ? db : db2, 'SME')));
  check('24 parallel SME allocations are unique across connections', new Set(allocated).size, 24);
  check('Parallel SME allocations share the existing sequence', allocated.map(code => Number(code.slice(4))).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 4));
  let rolledBack;
  await assert.rejects(db.$transaction(async tx => { rolledBack = await nextDocumentCode(tx, 'DN'); throw Error('intentional rollback'); }), /intentional rollback/);
  check('Rollback allocates the expected code', rolledBack, 'DN-27');
  check('Rollback does not reuse an allocated number', await nextDocumentCode(db, 'DN'), 'DN-28');
  await db.portalRequest.delete({ where: { id: distinct.find(row => row.reference === 'DN-26').id } });
  check('Deleting a request does not reset numbering', await nextDocumentCode(db, 'DN'), 'DN-29');
  await psql(migration);
  check('Rerunning migration does not reset an existing counter', await nextDocumentCode(db, 'DN'), 'DN-30');
  await db.$disconnect(); await db2.$disconnect();
  await run('docker', ['restart', container]); await ready();
  const restartedPort = (await run('docker', ['port', container, '5432/tcp'])).match(/127\.0\.0\.1:(\d+)/)[1];
  result.restartPortChanged = restartedPort !== port;
  port = restartedPort;
  db = new PrismaClient({ datasources: { db: { url: url(database) } } });
  let connected = false;
  for (let i = 0; i < 80; i++) { try { await db.$queryRaw`SELECT 1 AS ready`; connected = true; break; } catch { await sleep(150); } }
  assert.ok(connected, 'Restarted database accepts host connections');
  check('Counter survives PostgreSQL restart', await nextDocumentCode(db, 'DN'), 'DN-31');

  await psql('CREATE DATABASE codes_seeded;');
  await psql("CREATE TABLE portal_requests (id text PRIMARY KEY, reference text UNIQUE); CREATE TABLE loan_applications (id text PRIMARY KEY, application_code text UNIQUE); INSERT INTO portal_requests VALUES ('old-dn','DN-20261105-ABC'),('short-dn','DN-7'); INSERT INTO loan_applications VALUES ('old-sme','SME-20261105-ABC'),('short-sme','SME-12');", 'codes_seeded');
  await psql(migration, 'codes_seeded');
  seeded = new PrismaClient({ datasources: { db: { url: url('codes_seeded') } } });
  check('Migration resumes above an existing DN short code', await nextDocumentCode(seeded, 'DN'), 'DN-8');
  check('Migration resumes above an existing SME short code', await nextDocumentCode(seeded, 'SME'), 'SME-13');
  const old = await seeded.$queryRaw`SELECT id, reference FROM portal_requests ORDER BY id`;
  check('Migration preserves all old identifiers and references', old, [{ id: 'old-dn', reference: 'DN-20261105-ABC' }, { id: 'short-dn', reference: 'DN-7' }]);
  check('Old bank code remains unchanged', (await seeded.$queryRaw`SELECT application_code FROM loan_applications WHERE id='old-sme'`)[0].application_code, 'SME-20261105-ABC');
  await psql(migration, 'codes_seeded');
  check('Migration replay never reuses an allocation without a record', await nextDocumentCode(seeded, 'SME'), 'SME-14');
  if (renumber) {
    await psql("ALTER TABLE portal_requests ADD COLUMN created_at timestamptz NOT NULL DEFAULT '2026-01-01T00:00:00Z', ADD COLUMN data jsonb NOT NULL DEFAULT '{\"preserve\":true}'; ALTER TABLE loan_applications ADD COLUMN created_at timestamptz NOT NULL DEFAULT '2026-01-01T00:00:00Z', ADD COLUMN status text NOT NULL DEFAULT 'RECEIVED'; CREATE TABLE linked_history(id text PRIMARY KEY,request_id text REFERENCES portal_requests(id),loan_id text REFERENCES loan_applications(id),notes text); INSERT INTO linked_history VALUES ('history','old-dn','old-sme','Historical DN-20261105-ABC / SME-20261105-ABC'); INSERT INTO portal_requests(id,reference,created_at) VALUES ('old-dn-2','DN-20261106-DEF','2026-01-02T00:00:00Z');", 'codes_seeded');
    const file = path.join(root, 'backend/prisma/renumber-document-codes.sql');
    const sql = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const beforeHistory = await seeded.$queryRaw`SELECT * FROM linked_history`;
    const codes = JSON.parse((await psql(sql, 'codes_seeded')) || '[]');
    check('Renumber replaces exactly two old requests and one old loan', codes.length, 3);
    check('Renumber follows creation order and existing counters', codes.filter(row => row.prefix === 'DN').map(row => row.new_code), ['DN-9', 'DN-10']);
    check('Renumber keeps the existing short DN code', (await seeded.$queryRaw`SELECT reference FROM portal_requests WHERE id='short-dn'`)[0].reference, 'DN-7');
    check('Renumber keeps the existing short SME code', (await seeded.$queryRaw`SELECT application_code FROM loan_applications WHERE id='short-sme'`)[0].application_code, 'SME-12');
    check('Renumber retains linked IDs and historical content exactly', await seeded.$queryRaw`SELECT * FROM linked_history`, beforeHistory);
    check('Next request continues after renamed records', await nextDocumentCode(seeded, 'DN'), 'DN-11');
    check('Next loan continues after renamed records', await nextDocumentCode(seeded, 'SME'), 'SME-16');
    check('Renumber replay changes no codes', JSON.parse((await psql(sql, 'codes_seeded')) || '[]'), []);
    check('Renumber replay consumes no numbers', await nextDocumentCode(seeded, 'DN'), 'DN-12');
    await psql("INSERT INTO portal_requests(id,reference) VALUES ('old-conflict','DN-OLD'); INSERT INTO loan_applications(id,application_code) VALUES ('old-conflict','SME-OLD'); ALTER SEQUENCE loan_application_code_seq RESTART WITH 12;", 'codes_seeded');
    const beforeFailure = await seeded.$queryRaw`SELECT id,reference FROM portal_requests ORDER BY id`;
    await assert.rejects(psql(sql, 'codes_seeded'));
    check('A conflicting loan code rolls back earlier request renames', await seeded.$queryRaw`SELECT id,reference FROM portal_requests ORDER BY id`, beforeFailure);
    check('A failed renumber preserves the old loan code', (await seeded.$queryRaw`SELECT application_code FROM loan_applications WHERE id='old-conflict'`)[0].application_code, 'SME-OLD');
  }
  await psql('DROP SEQUENCE loan_application_code_seq;', 'codes_seeded');
  await assert.rejects(nextDocumentCode(seeded, 'SME'));
  check('Missing real database counter fails closed', true);
}
(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  try { await main(); result.pass = true; }
  catch (e) { result.pass = false; result.error = e.message; process.exitCode = 1; }
  finally {
    await Promise.allSettled([db?.$disconnect(), db2?.$disconnect(), seeded?.$disconnect()]);
    if (container) {
      const owned = await run('docker', ['inspect', '--format', '{{index .Config.Labels "' + label + '"}}', container]);
      assert.equal(owned, 'isolated');
      await run('docker', ['rm', '-f', '-v', container]); result.cleanedUp = true;
    }
    fs.writeFileSync(path.join(evidence, renumber ? 'renumber-postgres-results.json' : 'postgres-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ pass: result.pass, checks: result.checks.length, error: result.error, cleanedUp: result.cleanedUp }, null, 2));
  }
})();
