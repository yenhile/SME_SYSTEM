const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
async function checkBranchMigration(h){
  const ns=h.schema+'_upgrade';assert.match(ns,/^portal_v2_it_[a-f0-9]+_upgrade$/);
  const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.pathname,'/sme_loan');url.searchParams.set('schema',ns);
  assert.equal((await h.db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,'sme_loan');
  await h.db.$executeRawUnsafe(`CREATE SCHEMA "${ns}"`);
  try {
    await h.db.$executeRawUnsafe(`CREATE TABLE "${ns}".loan_applications(id TEXT PRIMARY KEY, current_stage TEXT NOT NULL)`);
    await h.db.$executeRawUnsafe(`INSERT INTO "${ns}".loan_applications VALUES ('synthetic-legacy','CAP_TREN')`);
    for(let i=0;i<2;i++){
      const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','execute','--schema',path.resolve(__dirname,'../prisma/schema.prisma'),'--file',path.resolve(__dirname,'../prisma/sme-branch-rollout.sql')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',windowsHide:true,timeout:60000});
      assert.equal(r.status,0,'Additive branch SQL failed; configuration output withheld');
    }
    const rows=await h.db.$queryRawUnsafe(`SELECT * FROM "${ns}".loan_applications`);
    assert.equal(rows.length,1);assert.equal(rows[0].current_stage,'CAP_TREN');assert.equal(rows[0].business_policy_version,null);assert.equal(rows[0].intake_officer_id,null);
    const tables=await h.db.$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema=$1',ns);
    assert.equal(tables.length,4);return {pass:true,repeated:2,legacyPreserved:true};
  } finally {
    assert.match(ns,/^portal_v2_it_[a-f0-9]+_upgrade$/);
    await h.db.$executeRawUnsafe(`DROP SCHEMA "${ns}" CASCADE`);
  }
}
module.exports={checkBranchMigration};
