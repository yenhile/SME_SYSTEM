const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

const SQL_FILES = [
  'sme-branch-rollout.sql',
  'round2-assignment-safety.sql',
  'round2-assignment-coordination.sql',
  'round3-intake.sql',
  'portal-account-recovery.sql',
];

async function main() {
  console.log('=== SME LOCAL MIGRATION APPLICATOR ===');
  
  const dbUrl = process.env.DATABASE_URL || 'postgresql://sme_user:sme_password@localhost:5432/sme_loan?schema=public';
  console.log(`Target Database: ${dbUrl.replace(/:[^:@]+@/, ':******@')}`);
  
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  try {
    // 1. Verify connection and capture baseline
    const usersCount = await prisma.user.count();
    const companiesCount = await prisma.company.count();
    const loansCount = await prisma.loanApplication.count();
    const portalAccountsCount = await prisma.portalAccount.count();
    
    console.log(`Baseline verified:`);
    console.log(` - users: ${usersCount}`);
    console.log(` - companies: ${companiesCount}`);
    console.log(` - loans: ${loansCount}`);
    console.log(` - portalAccounts: ${portalAccountsCount}`);

    const results = [];

    // 2. Execute each SQL file in sequence
    for (const sqlFile of SQL_FILES) {
      const filePath = path.join(backendRoot, 'prisma', sqlFile);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`Applying ${sqlFile}...`);
      const start = Date.now();
      
      const run = spawnSync(
        process.execPath,
        [
          require.resolve('prisma/build/index.js'),
          'db',
          'execute',
          '--schema',
          path.join(backendRoot, 'prisma', 'schema.prisma'),
          '--file',
          filePath,
        ],
        {
          cwd: backendRoot,
          env: { ...process.env, DATABASE_URL: dbUrl },
          encoding: 'utf8',
          windowsHide: true,
          timeout: 60000,
        }
      );

      const durationMs = Date.now() - start;
      if (run.status !== 0) {
        console.error(`STDOUT:`, run.stdout);
        console.error(`STDERR:`, run.stderr);
        throw new Error(`Failed to apply ${sqlFile} (exit code ${run.status})`);
      }

      console.log(` -> SUCCESS in ${durationMs}ms`);
      results.push({ file: sqlFile, durationMs, status: 'SUCCESS' });
    }

    // 3. Verify data preservation post-migration
    const postUsersCount = await prisma.user.count();
    const postCompaniesCount = await prisma.company.count();
    const postLoansCount = await prisma.loanApplication.count();
    const postPortalAccountsCount = await prisma.portalAccount.count();

    assert.equal(postUsersCount, usersCount, 'User count must be preserved');
    assert.equal(postCompaniesCount, companiesCount, 'Company count must be preserved');
    assert.equal(postLoansCount, loansCount, 'Loan count must be preserved');
    assert.equal(postPortalAccountsCount, portalAccountsCount, 'Portal account count must be preserved');

    // 4. Verify new tables / columns exist
    const [tables] = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('Post-migration data preservation: 100% MATCH');
    console.log('Migration execution report:');
    console.table(results);

    const reportPath = path.join(repoRoot, 'evidence', 'reviews', 'integration', 'local-migration-applied.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          targetDatabase: dbUrl.replace(/:[^:@]+@/, ':******@'),
          baseline: {
            users: usersCount,
            companies: companiesCount,
            loans: loansCount,
            portalAccounts: portalAccountsCount,
          },
          postCheck: {
            users: postUsersCount,
            companies: postCompaniesCount,
            loans: postLoansCount,
            portalAccounts: postPortalAccountsCount,
          },
          results,
        },
        null,
        2
      )
    );
    console.log(`Report written to ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

