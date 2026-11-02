const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const prisma = new PrismaClient();

const SQL_FILES = [
  { name: 'sme-branch-rollout.sql', path: path.join(root, 'prisma', 'sme-branch-rollout.sql') },
  { name: 'round2-assignment-safety.sql', path: path.join(root, 'prisma', 'round2-assignment-safety.sql') },
  { name: 'round2-assignment-coordination.sql', path: path.join(root, 'prisma', 'round2-assignment-coordination.sql') },
  { name: 'round3-intake.sql', path: path.join(root, 'prisma', 'round3-intake.sql') },
  { name: 'portal-account-recovery.sql', path: path.join(root, 'prisma', 'portal-account-recovery.sql') },
];

async function computeSqlChecksums() {
  const checksums = {};
  for (const item of SQL_FILES) {
    const content = await fs.readFile(item.path);
    const hash = createHash('sha256').update(content).digest('hex');
    checksums[item.name] = { path: item.path, sha256: hash, sizeBytes: content.length };
  }
  return checksums;
}

async function executeSqlFile(schema, filePath) {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sme_loan');
  url.searchParams.set('schema', schema);
  const start = Date.now();
  const run = spawnSync(
    process.execPath,
    [
      require.resolve('prisma/build/index.js'),
      'db',
      'execute',
      '--schema',
      path.join(root, 'prisma', 'schema.prisma'),
      '--file',
      filePath,
    ],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    }
  );
  const durationMs = Date.now() - start;
  assert.equal(run.status, 0, `Execute SQL failed for ${filePath}: ${run.stderr || run.stdout}`);
  return { durationMs, exitCode: run.status };
}

async function runRehearsal() {
  console.log('--- STARTING MIGRATION & ROLLBACK REHEARSAL ---');
  const checksums = await computeSqlChecksums();
  console.log('SQL Checksums computed:', Object.keys(checksums));

  const rehearsalSchema = `rehearsal_rollout_${randomUUID().replaceAll('-', '')}`;
  const backupSchema = `rehearsal_backup_${randomUUID().replaceAll('-', '')}`;
  const results = {
    timestamp: new Date().toISOString(),
    rehearsalSchema,
    checksums,
    migrations: [],
    idempotencyRerun: [],
    rollbackLevel1: {},
    rollbackLevel2: {},
    preservation: {},
  };

  try {
    // 1. Khởi tạo schema diễn tập cách ly
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${rehearsalSchema}"`);
    console.log(`Created isolated rehearsal schema: ${rehearsalSchema}`);

    // Thiết lập baseline đầy đủ từ schema public mục tiêu
    const publicTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`Cloning ${publicTables.length} baseline table definitions from public to ${rehearsalSchema}...`);
    for (const t of publicTables) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "${rehearsalSchema}"."${t.table_name}" (LIKE "public"."${t.table_name}" INCLUDING ALL)`);
    }
    console.log('Baseline schema cloned successfully.');

    // Chèn dữ liệu mẫu baseline
    const testCompanyId = randomUUID();
    const testLoanId = randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${rehearsalSchema}".companies (id, tax_code, company_name, industry, established_year, annual_revenue, charter_capital, representative_name, phone, address, created_at, updated_at)
      VALUES ('${testCompanyId}', '0100000001', 'Baseline Company Ltd', 'San Xuat', 2018, 10000000000, 2000000000, 'Tran Baseline', '0912345678', 'Hanoi', NOW(), NOW())
    `);
      
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${rehearsalSchema}".loan_applications (id, application_code, company_id, loan_purpose, loan_type, proposed_amount, loan_term_months, current_stage, current_status, created_at, updated_at)
      VALUES ('${testLoanId}', 'APP-BASELINE-01', '${testCompanyId}', 'Von luu dong', 'VAY_VON_LUU_DONG', 5000000000, 12, 'TIEP_NHAN', 'RECEIVED', NOW(), NOW())
    `);
    console.log('Baseline tables and seed data created in rehearsal schema.');

    // 2. Diễn tập thực thi migration đúng thứ tự
    console.log('\n--- EXECUTING MIGRATIONS IN CORRECT SEQUENCE ---');
    let totalMigrationTimeMs = 0;
    for (const sqlItem of SQL_FILES) {
      console.log(`Applying: ${sqlItem.name}...`);
      const execResult = await executeSqlFile(rehearsalSchema, sqlItem.path);
      totalMigrationTimeMs += execResult.durationMs;
      results.migrations.push({
        name: sqlItem.name,
        durationMs: execResult.durationMs,
        status: 'SUCCESS',
      });
      console.log(`-> ${sqlItem.name} completed in ${execResult.durationMs}ms`);
    }
    results.totalMigrationTimeMs = totalMigrationTimeMs;
    console.log(`All migrations applied successfully! Total time: ${totalMigrationTimeMs}ms`);

    // 3. Kiểm tra tính idempotent (chạy lặp lại lần 2 không gây lỗi và không làm biến đổi dữ liệu)
    console.log('\n--- VERIFYING IDEMPOTENCY (SECOND RUN) ---');
    let totalIdempotencyTimeMs = 0;
    for (const sqlItem of SQL_FILES) {
      const execResult = await executeSqlFile(rehearsalSchema, sqlItem.path);
      totalIdempotencyTimeMs += execResult.durationMs;
      results.idempotencyRerun.push({
        name: sqlItem.name,
        durationMs: execResult.durationMs,
        status: 'SUCCESS_IDEMPOTENT',
      });
    }
    results.totalIdempotencyTimeMs = totalIdempotencyTimeMs;
    console.log(`Idempotency check passed! Re-run time: ${totalIdempotencyTimeMs}ms`);

    // Xác minh dữ liệu baseline vẫn nguyên vẹn
    const baselineLoan = await prisma.$queryRawUnsafe(`
      SELECT id, application_code, business_policy_version, assignment_version 
      FROM "${rehearsalSchema}".loan_applications 
      WHERE id = '${testLoanId}'
    `);
    assert.equal(baselineLoan.length, 1);
    assert.equal(baselineLoan[0].business_policy_version, null, 'Baseline loan retains null businessPolicyVersion');
    assert.equal(baselineLoan[0].assignment_version, 0, 'Baseline loan received default assignment_version 0');
    console.log('Baseline loan preserved intact with correct default columns.');

    // 4. Diễn tập Rollback Cấp 1 (Transaction Rollback)
    console.log('\n--- REHEARSING LEVEL 1 ROLLBACK (TRANSACTION ATOMICITY) ---');
    const l1Start = Date.now();
    let l1ErrorCaught = false;
    try {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          -- Thao tác thay đổi trong giao dịch
          UPDATE "${rehearsalSchema}".loan_applications SET loan_purpose = 'MALICIOUS CORRUPTED VALUE' WHERE id = '${testLoanId}';
          -- Kích hoạt lỗi nhân tạo ép buộc rollback
          RAISE EXCEPTION 'SYNTHETIC TRANSACTION FAILURE FOR ROLLBACK REHEARSAL';
        END $$;
      `);
    } catch (err) {
      l1ErrorCaught = true;
      assert.match(String(err.message), /SYNTHETIC TRANSACTION FAILURE/);
    }
    const l1DurationMs = Date.now() - l1Start;
    assert.ok(l1ErrorCaught, 'Level 1 transaction error successfully triggered rollback');

    // Kiểm tra dữ liệu sau rollback Cấp 1
    const loanAfterL1 = await prisma.$queryRawUnsafe(`
      SELECT loan_purpose FROM "${rehearsalSchema}".loan_applications WHERE id = '${testLoanId}'
    `);
    assert.equal(loanAfterL1[0].loan_purpose, 'Von luu dong', 'Data unmodified after transaction rollback');
    results.rollbackLevel1 = {
      method: 'PostgreSQL Transaction Rollback (Atomic abort)',
      durationMs: l1DurationMs,
      dataPreserved: true,
      status: 'VERIFIED',
    };
    console.log(`Level 1 Rollback verified in ${l1DurationMs}ms: Data 100% untouched.`);

    // 5. Diễn tập Rollback Cấp 2 (Point-in-Time Schema Snapshot Restore)
    console.log('\n--- REHEARSING LEVEL 2 ROLLBACK (SCHEMA SNAPSHOT RESTORE) ---');
    // Tạo bản backup snapshot schema
    const l2BackupStart = Date.now();
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${backupSchema}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${backupSchema}".loan_applications AS SELECT * FROM "${rehearsalSchema}".loan_applications`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${backupSchema}".companies AS SELECT * FROM "${rehearsalSchema}".companies`);
    const l2BackupDurationMs = Date.now() - l2BackupStart;
    console.log(`Schema snapshot taken in ${l2BackupDurationMs}ms.`);

    // Giả lập sự cố thảm họa trong lúc phát hành (ví dụ bảng bị sửa hỏng dữ liệu nghiêm trọng)
    await prisma.$executeRawUnsafe(`
      UPDATE "${rehearsalSchema}".loan_applications SET loan_purpose = 'CORRUPTED_DISASTER_VALUE'
    `);

    // Thực hiện khôi phục khẩn cấp từ backup schema
    const l2RestoreStart = Date.now();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${rehearsalSchema}".loan_applications CASCADE`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${rehearsalSchema}".loan_applications SELECT * FROM "${backupSchema}".loan_applications`);
    const l2RestoreDurationMs = Date.now() - l2RestoreStart;

    // Xác minh dữ liệu sau khôi phục Cấp 2
    const loanAfterL2 = await prisma.$queryRawUnsafe(`
      SELECT loan_purpose FROM "${rehearsalSchema}".loan_applications WHERE id = '${testLoanId}'
    `);
    assert.equal(loanAfterL2[0].loan_purpose, 'Von luu dong', 'Loan purpose restored to original Von luu dong');
    results.rollbackLevel2 = {
      method: 'Point-in-Time Schema Snapshot Restore (Level 2 Disaster Recovery)',
      snapshotDurationMs: l2BackupDurationMs,
      restoreDurationMs: l2RestoreDurationMs,
      dataPreserved: true,
      status: 'VERIFIED',
    };
    console.log(`Level 2 Restore verified in ${l2RestoreDurationMs}ms: Original state 100% recovered.`);

    results.pass = true;
    return results;
  } finally {
    // Thu dọn toàn bộ schema diễn tập cách ly
    console.log(`\nTearing down rehearsal schemas: ${rehearsalSchema}, ${backupSchema}...`);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${rehearsalSchema}" CASCADE`);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${backupSchema}" CASCADE`);
    await prisma.$disconnect();
    console.log('Teardown complete. Public schema was NEVER touched.');
  }
}

async function main() {
  const result = await runRehearsal();
  const evidenceDir = path.join(repoRoot, 'evidence', 'reviews', 'integration');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(
    path.join(evidenceDir, 'migration-rollback-rehearsal.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );
  console.log('\nRehearsal summary written to evidence/reviews/integration/migration-rollback-rehearsal.json');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('REHEARSAL_FAILED:', err);
    process.exitCode = 1;
  });
}

module.exports = { runRehearsal };
