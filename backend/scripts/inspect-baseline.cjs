const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('PUBLIC_TABLES:', tables.map(t => t.table_name));

  const columns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `);
  
  const byTable = {};
  for (const c of columns) {
    byTable[c.table_name] = byTable[c.table_name] || [];
    byTable[c.table_name].push({ col: c.column_name, type: c.data_type, nullable: c.is_nullable });
  }

  console.log('SAMPLE_TABLE_COLUMNS:');
  for (const t of ['loan_applications', 'appraisal_reports', 'assignment_change_requests', 'portal_requests']) {
    console.log(t, byTable[t]?.map(c => `${c.col}(${c.type})`).join(', '));
  }

  await prisma.$disconnect();
}

main().catch(console.error);

