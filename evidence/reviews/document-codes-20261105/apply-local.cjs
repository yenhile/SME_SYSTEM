// PO-approved local activation only: backup, restore verification, add two counters.
// Does not create requests/loans, rename records, seed data or restart any existing service.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
if (!process.argv.includes('--apply-local')) throw Error('Explicit --apply-local is required');
const root = path.resolve(__dirname, '../../..');
const target = 'sme-loan-workflow-db-1';
const backupDir = path.join(root, 'evidence/private-backups/document-codes-' + Date.now());
const result = { target, existingDataChanged: null, backupVerified: false, applied: false };
const migration = fs.readFileSync(path.join(root, 'backend/prisma/document-codes.sql'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function run(args, input, binary = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [], errors = [];
    const timer = setTimeout(() => { child.kill(); reject(Error('Docker command timed out')); }, 120000);
    child.stdout.on('data', d => output.push(d)); child.stderr.on('data', d => errors.push(d));
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(binary ? Buffer.concat(output) : Buffer.concat(output).toString('utf8').trim()) : reject(Error(Buffer.concat(errors).toString('utf8'))); });
    child.stdin.on('error', () => {}); child.stdin.end(input || '');
  });
}
// Hash complete rows without exposing any user, company, password or loan data in evidence.
const fingerprintSQL = `CREATE TEMP TABLE activation_fingerprints(name text, count bigint, digest text);
DO $check$ DECLARE item record; BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    EXECUTE format('INSERT INTO activation_fingerprints SELECT %L,count(*),md5(COALESCE(string_agg(md5(row_to_json(t)::text),%L ORDER BY md5(row_to_json(t)::text)),%L)) FROM public.%I t', item.tablename, ',', '', item.tablename);
  END LOOP;
END $check$;
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY name),'[]'::json) FROM activation_fingerprints t;`;
const snapshot = async (container, user, database) => {
  const out = await run(['exec', '-i', container, 'psql', '-X', '-t', '-A', '-q', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database], fingerprintSQL);
  return JSON.parse(out);
};
let restore;
(async () => {
  try {
    const metadata = (await run(['exec', target, 'printenv', 'POSTGRES_USER', 'POSTGRES_DB'])).split(/\r?\n/);
    const [user, database] = metadata;
    assert.ok(user && database && metadata.length === 2);
    result.database = database;
    const before = await snapshot(target, user, database);
    fs.mkdirSync(backupDir, { recursive: true });
    const dump = await run(['exec', target, 'pg_dump', '-Fc', '-U', user, '-d', database], undefined, true);
    fs.writeFileSync(path.join(backupDir, 'database.dump'), dump);
    result.backupBytes = dump.length; result.backupSha256 = createHash('sha256').update(dump).digest('hex');
    restore = await run(['run', '-d', '--pull=never', '--name', 'sme-code-restore-' + Date.now(), '--label', 'codex.sme.document-codes=restore', '-e', 'POSTGRES_USER=restore_check', '-e', 'POSTGRES_DB=restore_check', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16-alpine']);
    assert.match(restore, /^[a-f0-9]{64}$/);
    let ready = false;
    for (let i = 0; i < 100; i++) { try { await run(['exec', restore, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U restore_check -d restore_check']); ready = true; break; } catch { await sleep(150); } }
    assert.ok(ready);
    await run(['exec', '-i', restore, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-U', 'restore_check', '-d', 'restore_check'], dump);
    assert.deepEqual(await snapshot(restore, 'restore_check', 'restore_check'), before, 'Restored backup must match all current table contents');
    result.backupVerified = true;
    await run(['exec', '-i', restore, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'restore_check', '-d', 'restore_check'], migration);
    assert.deepEqual(await snapshot(restore, 'restore_check', 'restore_check'), before, 'Migration must preserve every restored row');
    assert.deepEqual(await snapshot(target, user, database), before, 'Abort if current data changed during backup verification');
    await run(['exec', '-i', target, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database], migration);
    result.applied = true;
    const after = await snapshot(target, user, database);
    assert.deepEqual(after, before, 'Existing data must remain byte-equivalent at the row representation level');
    result.existingDataChanged = false;
    result.tablesVerified = after.length;
    result.rowsVerified = after.reduce((total, table) => total + table.count, 0);
    result.counters = JSON.parse(await run(['exec', '-i', target, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database], `SELECT json_build_object('DN',(SELECT json_build_object('last_value',last_value::text,'is_called',is_called) FROM portal_request_reference_seq),'SME',(SELECT json_build_object('last_value',last_value::text,'is_called',is_called) FROM loan_application_code_seq));`));
    result.pass = true;
  } catch (e) { result.pass = false; result.error = e.message; process.exitCode = 1; }
  finally {
    if (restore) {
      assert.equal(await run(['inspect', '--format', '{{index .Config.Labels "codex.sme.document-codes"}}', restore]), 'restore');
      await run(['rm', '-f', '-v', restore]); result.restoreContainerCleaned = true;
    }
    fs.writeFileSync(path.join(__dirname, 'local-activation.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  }
})();
