/* Real HTTP/PostgreSQL integration, with a TEST_ONLY policy injected into this process.
 * Never imports main.js, seeds public, resets a database, or enables the normal server.
 * Build backend first. KEEP_TEST_SERVER_MS=60000 optionally holds fixtures for browser QA
 * (maximum 10 minutes). Credentials printed during hold are synthetic fixture credentials.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const uploadDir = path.join(root, 'uploads');
const password = 'IsolatedPortalTest123!';
const legacyFields = ['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths'];
const policy = {
  version: 'TEST-SME-INTAKE-1', status: 'TEST_ONLY', formVersion: 2,
  requiredFields: [...legacyFields, 'contactName','contactPhone','contactEmail'],
  requirements: [
    { id:'test-registration', group:'A', documentTypeCode:'A_BUSINESS_REGISTRATION', required:true, stage:'SUBMIT' },
    { id:'test-finance', group:'B', documentTypeCode:'B_FINANCIAL_STATEMENTS', periods:['2024','2025'], required:true, stage:'SUBMIT' },
    { id:'test-order', group:'C', documentTypeCode:'C_PURCHASE_ORDER', required:true, stage:'SUBMIT' },
    { id:'test-plan', group:'D', documentTypeCode:'D_CAPITAL_PLAN', required:true, stage:'SUBMIT' },
    { id:'test-security', group:'E', documentTypeCode:'E_COLLATERAL_TITLE', condition:{field:'collateral.mode',equals:'PROPOSED'}, required:true, stage:'SUBMIT' },
    { id:'test-debt', group:'F', documentTypeCode:'F_DEBT_STATEMENT', condition:{field:'hasExistingDebt',equals:true}, required:true, stage:'SUBMIT' },
  ],
};

function verifyTarget(url, schema) {
  const u = new URL(url);
  assert.ok(['localhost','127.0.0.1'].includes(u.hostname), 'Only localhost PostgreSQL is authorized');
  assert.ok(['postgresql:','postgres:'].includes(u.protocol));
  assert.equal(decodeURIComponent(u.pathname), '/sme_loan');
  if (schema) {
    assert.match(schema, /^portal_v2_it_[a-z0-9_]+$/);
    assert.equal(u.searchParams.get('schema'), schema);
  }
  return u;
}

async function startIsolated(options={}) {
  // backend/.env là file cục bộ (không nằm trong git); khi thiếu thì dùng DATABASE_URL từ biến môi trường, vẫn qua verifyTarget.
  const config = dotenv.parse(await fs.readFile(path.join(root,'.env')).catch(e=>{if(e.code!=='ENOENT') throw e;return '';}));
  const baseUrl = process.env.DATABASE_URL || config.DATABASE_URL;
  const u = verifyTarget(baseUrl);
  const schema = `portal_v2_it_${randomUUID().replaceAll('-','')}`;
  u.searchParams.set('schema',schema);
  const isolatedUrl = u.toString();
  verifyTarget(isolatedUrl,schema);
  const admin = new PrismaClient({datasources:{db:{url:baseUrl}}});
  const ownedFiles = new Set();
  const originalWrite = fs.writeFile;
  let app, db, created = false, closed = false;
  const envKeys = ['DATABASE_URL','NODE_ENV','PORTAL_FOUNDATION_PREVIEW','PORTAL_V2_SUBMIT_ENABLED','PORTAL_V2_INTAKE_ENABLED','ML_SERVICE_URL'];
  const savedEnv = Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
  const originalCwd = process.cwd();
  const priorFiles = new Set(await fs.readdir(uploadDir).catch(e=>{if(e.code==='ENOENT') return []; throw e;}));
  // Instrument only successful exclusive writes in this process, including rolled back uploads.
  fs.writeFile = async function(file, bytes, options) {
    const result = await originalWrite.call(this,file,bytes,options);
    const candidate = path.resolve(String(file));
    if (options?.flag==='wx' && path.dirname(candidate)===uploadDir && !priorFiles.has(path.basename(candidate))) ownedFiles.add(path.basename(candidate));
    return result;
  };
  async function close() {
    if (closed) return;
    closed = true;
    const errors = [];
    try {
      if (db) for (const d of await db.portalDocument.findMany({select:{filePath:true}})) ownedFiles.add(d.filePath);
    } catch(e) { errors.push('Cannot collect owned document paths: '+e.message); }
    try { await app?.close(); } catch(e) {errors.push(e.message);}
    try { await db?.$disconnect(); } catch(e) {errors.push(e.message);}
    fs.writeFile = originalWrite;
    // Existing upload names are never deleted, even if a faulty fixture referenced one.
    for (const file of ownedFiles) {
      try {
        assert.ok(!priorFiles.has(file),'Refusing to delete a pre-existing upload');
        assert.match(file,/^[0-9a-f-]{36}$/i);
        const candidate = path.resolve(uploadDir,file);
        assert.equal(path.dirname(candidate),uploadDir);
        await fs.unlink(candidate).catch(e=>{if(e.code!=='ENOENT') throw e;});
      } catch(e) {errors.push(e.message);}
    }
    if (created) {
      try {
        verifyTarget(isolatedUrl,schema);
        assert.equal((await admin.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,'sme_loan');
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } catch(e) { errors.push('Owned schema cleanup failed: '+e.message); }
    }
    await admin.$disconnect();
    for (const k of envKeys) savedEnv[k]===undefined ? delete process.env[k] : process.env[k]=savedEnv[k];
    process.chdir(originalCwd);
    if(errors.length) throw Error(errors.join('; '));
    return {schemaDropped:created,ownedUploadsRemoved:ownedFiles.size,preExistingUploadsPreserved:priorFiles.size};
  }
  try {
    assert.equal((await admin.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,'sme_loan');
    const exists = await admin.$queryRawUnsafe('SELECT schema_name FROM information_schema.schemata WHERE schema_name=$1',schema);
    assert.equal(exists.length,0,'Test namespace must be new');
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    const empty = await admin.$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema=$1',schema);
    assert.equal(empty.length,0);
    let schemaPath=path.join(root,'prisma/schema.prisma'),migrationDir;
    if(options.approvedIntake){
      let legacy=await fs.readFile(schemaPath,'utf8');
      for(const model of ['PortalSubmission','PortalIntakeOperation','PortalIntakeIssue'])legacy=legacy.replace(new RegExp('model '+model+' \\{[\\s\\S]*?\\n\\}\\r?\\n','g'),'');
      legacy=legacy.replace(/^  RETURNED\r?\n/m,'').replace(/^  (submissions PortalSubmission\[\]|intakeOperations PortalIntakeOperation\[\]|intakeIssues PortalIntakeIssue\[\]|correctionRequest Json\?[^\r\n]*)\r?\n/gm,'');
      migrationDir=await fs.mkdtemp(path.join(os.tmpdir(),'sme-intake-schema-'));
      schemaPath=path.join(migrationDir,'schema.prisma');await fs.writeFile(schemaPath,legacy);
    }
    const push = spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push','--skip-generate','--schema',schemaPath],{
      cwd:root,env:{...process.env,DATABASE_URL:isolatedUrl},encoding:'utf8',timeout:60000,windowsHide:true,
    });
    if(migrationDir){
      try{
        assert.equal(push.status,0,'Legacy isolated schema push failed; output withheld');
        const sentinelAccount=randomUUID(),sentinelRequest=randomUUID();
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".portal_accounts(id,email,password_hash,contact_name,phone) VALUES ($1,$2,$3,$4,$5)`,sentinelAccount,'migration-sentinel@example.test','synthetic-unused-hash','Synthetic migration sentinel','0900000000');
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".portal_requests(id,reference,account_id,data,updated_at) VALUES ($1,$2,$3,$4::jsonb,CURRENT_TIMESTAMP)`,sentinelRequest,'MIGRATION-SENTINEL',sentinelAccount,JSON.stringify({companyName:'Synthetic legacy preserved',annualRevenue:0}));
        const before=JSON.stringify((await admin.$queryRawUnsafe(`SELECT row_to_json(r) AS row FROM "${schema}".portal_requests r WHERE id=$1`,sentinelRequest))[0].row);
        for(let repeat=0;repeat<2;repeat++){
          const migration=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','execute','--file',path.join(root,'prisma/portal-intake-cycle.sql'),'--schema',schemaPath],{cwd:root,env:{...process.env,DATABASE_URL:isolatedUrl},encoding:'utf8',timeout:60000,windowsHide:true});
          assert.equal(migration.status,0,'Additive SQL migration failed; output withheld');
        }
        const after=(await admin.$queryRawUnsafe(`SELECT row_to_json(r) AS row FROM "${schema}".portal_requests r WHERE id=$1`,sentinelRequest))[0].row;
        assert.equal(after.correction_request,null);delete after.correction_request;
        assert.equal(JSON.stringify(after),before,'Migration changed legacy request data');
      }finally{
        // Only these two known files in this runner-owned temporary directory are removed.
        await fs.unlink(schemaPath).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.rmdir(migrationDir);
      }
    }
    // Do not echo CLI output: configuration diagnostics can contain connection secrets.
    assert.equal(push.status,0,`Isolated schema push failed (exit ${push.status}); output withheld`);
    Object.assign(process.env,{DATABASE_URL:isolatedUrl,NODE_ENV:'test',PORTAL_FOUNDATION_PREVIEW:'true',PORTAL_V2_SUBMIT_ENABLED:'true',ML_SERVICE_URL:'http://127.0.0.1:8000'});
    if(options.approvedIntake) process.env.PORTAL_V2_INTAKE_ENABLED='true'; else delete process.env.PORTAL_V2_INTAKE_ENABLED;
    process.chdir(root);
    require('reflect-metadata');
    const {NestFactory} = require('@nestjs/core');
    const {Global,Module,ValidationPipe} = require('@nestjs/common');
    // Environment is deliberately established before importing any compiled Nest modules.
    const {AppModule} = require('../dist/app.module');
    class IsolatedPolicyModule {}
    Global()(IsolatedPolicyModule);
    Module({providers:[{provide:'PORTAL_POLICY_CONTEXT',useValue:{mode:'isolated-test',policy}}],exports:['PORTAL_POLICY_CONTEXT']})(IsolatedPolicyModule);
    class IsolatedRoot {}
    Module({imports:[IsolatedPolicyModule,AppModule]})(IsolatedRoot);
    app = await NestFactory.create(IsolatedRoot,{logger:false});
    app.setGlobalPrefix('api');
    app.enableCors({origin:process.env.SESSION_WEB_ORIGIN||'http://localhost:5174',credentials:true});
    app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:false}));
    await app.listen(3002,'127.0.0.1');
    db = new PrismaClient({datasources:{db:{url:isolatedUrl}}});
    return {app,db,schema,policy,close,base:'http://127.0.0.1:3002/api'};
  } catch(e) {
    await close().catch(cleanup=>{e.message+='; '+cleanup.message;});
    throw e;
  }
}

async function runChecks(h) {
  const {db,base} = h;
  let checks = 0;
  const limitations = [];
  const check = (value,label) => {assert.ok(value,label);checks++;};
  async function call(endpoint,{token,role,method='GET',body}={}) {
    const headers = {};
    if(token) headers.Authorization=`Bearer ${token}`;
    if(role) headers['X-Active-Role']=role;
    if(body!==undefined && !(body instanceof FormData)) headers['Content-Type']='application/json';
    const response = await fetch(base+endpoint,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    return {status:response.status,data:await response.json().catch(()=>null)};
  }
  const expect = (r,status,label) => {check([].concat(status).includes(r.status),`${label}: HTTP ${r.status}: ${JSON.stringify(r.data?.message||'')}`);return r.data;};
  const post = (endpoint,actor,body={})=>call(endpoint,{...actor,method:'POST',body});
  const hash = await bcrypt.hash(password,10);
  const actors = {};
  for(const code of ['ADMIN','QUAN_LY','THAM_QUYEN','CBTD']) {
    const role = await db.role.create({data:{code,name:`Synthetic ${code}`}});
    for(const suffix of code==='CBTD'?['CBTD','OTHER_CBTD']:[code]) {
      const user = await db.user.create({data:{username:`isolated_${suffix.toLowerCase()}`,email:`${suffix.toLowerCase()}@example.test`,fullName:`Synthetic ${suffix}`,passwordHash:hash,roles:{create:{roleId:role.id}}}});
      const login = expect(await post('/auth/login',{}, {username:user.username,password}),201,`login ${suffix}`);
      actors[suffix]={token:login.accessToken,role:code,user};
    }
  }
  const portals = [];
  for(let i=0;i<2;i++) {
    const account = await db.portalAccount.create({data:{email:`portal${i}@example.test`,passwordHash:hash,contactName:'Synthetic contact',phone:'0900000000',verifiedAt:new Date()}});
    const login = expect(await post('/portal/auth/login',{}, {email:account.email,password}),201,'verified fixture login');
    portals.push({token:login.accessToken,account});
  }
  for(const [i,stageCode] of ['TIEP_NHAN','THAM_DINH','CAP_TREN','HOAN_TAT'].entries()) await db.workflowStage.create({data:{stageCode,stageName:stageCode,standardSlaHours:[8,24,16,4][i],orderIndex:i+1}});
  const portal=portals[0], manager=actors.QUAN_LY, officer=actors.CBTD;
  const {PDFDocument} = require('pdf-lib');
  const pdfDoc = await PDFDocument.create();pdfDoc.addPage([120,120]);
  const pdf=Buffer.from(await pdfDoc.save());
  let tax=7000000000;
  const data = (overrides={})=>({taxCode:String(++tax),companyName:'Synthetic intake enterprise',industry:'Sản xuất',establishedYear:2015,annualRevenue:15000000000,charterCapital:8000000000,representativeName:'Synthetic representative',phone:'0900000000',address:'Synthetic address',loanPurpose:'Working capital synthetic fixture',loanType:'VAY_VON_LUU_DONG',proposedAmount:8000000000,loanTermMonths:12,contactName:'Synthetic contact',contactPhone:'0900000000',contactEmail:'contact@example.test',preferredBranch:'Synthetic branch',collateral:{mode:'NONE_REQUESTED'},hasExistingDebt:false,capitalPlan:{businessActivity:'Synthetic activity',ownFunds:2000000000,otherFunds:0,costs:[{name:'Material',amount:10000000000}],repaymentSource:'Synthetic sales'},...overrides});
  const requestPath=r=>`/portal/requests/${r.id}`;
  const manifest=r=>({expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)});
  const get=r=>call(requestPath(r),portal).then(result=>expect(result,200,'refresh request'));
  const create=async fields=>expect(await post('/portal/requests',portal,{formVersion:2,clientRequestId:randomUUID(),data:fields||data()}),201,'create V2');
  async function upload(r,group,coverage,replace) {
    const form=new FormData();form.append('documentGroup',group);form.append('coverage',JSON.stringify(coverage));form.append('clientUploadId',randomUUID());form.append('expectedRevision',String(r.revision));form.append('file',new Blob([pdf],{type:'application/pdf'}),`synthetic-${group}.pdf`);
    return expect(await call(`${requestPath(r)}/documents${replace?`/${replace}/replace`:''}`,{...portal,method:'POST',body:form}),201,`upload ${group}`);
  }
  const finance=[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'}];
  async function complete(fields) {
    let r=await create(fields);
    for(const [g,c] of [['A',[{documentTypeCode:'A_BUSINESS_REGISTRATION'}]],['B',finance],['C',[{documentTypeCode:'C_PURCHASE_ORDER'}]],['D',[{documentTypeCode:'D_CAPITAL_PLAN'}]]]) r=await upload(r,g,c);
    return r;
  }
  async function assign(r) {return expect(await post(`/portal-intakes/${r.id}/assign`,manager,{officerId:officer.user.id,expectedAssignedTo:null}),201,'assign CBTD');}
  const submit=r=>post(`${requestPath(r)}/submit`,portal,manifest(r));
  const accept=r=>post(`/portal-intakes/${r.id}/accept`,officer,{});
  const key=randomUUID();
  const repeated=await Promise.all([0,1,2].map(()=>post('/portal/requests',portal,{formVersion:2,clientRequestId:key,data:data({taxCode:'7000000000'})})));
  check(repeated.every(r=>r.status===201 && r.data.id===key),'concurrent draft creation is idempotent');
  let missing=await create();
  expect(await submit(missing),400,'missing documents blocked');
  expect(await call(requestPath(missing),{...portals[1]}),404,'cross-account read denied');
  expect(await call(requestPath(missing),{...portal,method:'PUT',body:{expectedRevision:missing.revision+1,data:missing.data}}),409,'stale draft revision denied');
  let conditional=await complete(data({collateral:{mode:'PROPOSED'},hasExistingDebt:true}));
  expect(await submit(conditional),400,'conditional security/debt missing blocked');
  conditional=await upload(conditional,'E',[{documentTypeCode:'E_COLLATERAL_TITLE'}]);
  conditional=await upload(conditional,'F',[{documentTypeCode:'F_DEBT_STATEMENT'}]);
  expect(await submit(conditional),201,'conditional security/debt files satisfy test policy');

  let r=await complete();
  const b0=r.documents.find(d=>d.documentGroup==='B');
  r=await upload(r,'B',finance,b0.id);
  const b1=r.documents.find(d=>d.documentGroup==='B');
  r=await upload(r,'B',finance,b1.id);
  const b2=r.documents.find(d=>d.documentGroup==='B');
  check(b2.version===3 && b2.coverage.length===2,'replacement twice preserves multi-period bundle');
  const versions=expect(await call(`${requestPath(r)}/documents/${b2.id}/versions`,portal),200,'version history');
  check(versions.length===3,'three immutable versions retained');
  const c=r.documents.find(d=>d.documentGroup==='C');
  r=expect(await call(`${requestPath(r)}/documents/${c.id}`,{...portal,method:'DELETE',body:{expectedRevision:r.revision}}),200,'withdraw C');
  expect(await submit(r),400,'withdrawn coverage no longer satisfies policy');
  r=await upload(r,'C',[{documentTypeCode:'C_PURCHASE_ORDER'}]);
  expect(await post(`${requestPath(r)}/submit`,portal,{...manifest(r),documentIds:[...manifest(r).documentIds,c.id]}),[400,409],'withdrawn manifest blocked');
  expect(await post(`${requestPath(r)}/submit`,portal,{...manifest(r),expectedRevision:r.revision-1}),409,'stale submission revision blocked');
  const retryBody=manifest(r);
  const sends=await Promise.all([submit(r),submit(r)]);
  sends.forEach(x=>expect(x,201,'concurrent submit retry'));
  r=sends[0].data;
  check(r.status==='SUBMITTED' && r.checklistSnapshot.snapshotVersion===2,'V2 snapshot persisted');
  check(r.checklistSnapshot.policy.version===policy.version,'frozen test policy persisted');
  check(await db.loanApplication.count()===0 && await db.applicationStageHistory.count()===0,'submission does not start Loan/SLA');
  check(await db.internalNotification.count({where:{requestId:r.id,userId:manager.user.id}})===1,'manager notification exactly once');
  expect(await post(`${requestPath(r)}/submit`,portal,retryBody),201,'exact manifest retry');
  expect(await post(`${requestPath(r)}/submit`,portal,{...retryBody,documentIds:[]}),[400,409],'different retry manifest rejected');
  expect(await call(requestPath(r),{...portal,method:'PUT',body:{expectedRevision:r.revision,data:r.data}}),409,'post-send fields locked');
  expect(await call(`${requestPath(r)}/documents/${b2.id}`,{...portal,method:'DELETE',body:{expectedRevision:r.revision}}),409,'post-send withdrawal locked');
  const late=new FormData();late.append('documentGroup','A');late.append('file',new Blob([pdf]),'late.pdf');
  expect(await call(`${requestPath(r)}/documents`,{...portal,method:'POST',body:late}),409,'post-send upload locked');
  for(const actor of [manager,actors.THAM_QUYEN]) expect(await call(`/portal-intakes/${r.id}`,actor),200,'management sees submitted request');
  expect(await call(`/portal-intakes/${r.id}`,officer),404,'unassigned CBTD cannot see submitted request');
  expect(await call(`/portal-intakes/${r.id}`,actors.ADMIN),403,'ADMIN not granted intake role');
  expect(await post(`/portal-intakes/${r.id}/assign`,officer,{officerId:officer.user.id,expectedAssignedTo:null}),403,'CBTD cannot self assign');
  await assign(r);
  expect(await call(`/portal-intakes/${r.id}`,officer),200,'assigned CBTD sees request');
  expect(await call(`/portal-intakes/${r.id}`,actors.OTHER_CBTD),404,'other CBTD cannot see assigned request');
  // Runtime policy mutability cannot rewrite the policy used for an existing snapshot.
  const oldRequired=[...policy.requiredFields];policy.requiredFields.push('synthetic.unavailable');
  const accepts=await Promise.all([accept(r),accept(r)]);
  policy.requiredFields=oldRequired;
  accepts.forEach(x=>expect(x,201,'concurrent accept uses frozen policy'));
  const loanId=accepts[0].data.loanId;
  check(loanId===accepts[1].data.loanId && await db.loanApplication.count()===1,'exactly one loan for retry accept');
  const saved=await db.portalRequest.findUniqueOrThrow({where:{id:r.id}});
  const history=await db.applicationStageHistory.findMany({where:{applicationId:loanId}});
  check(history.length===1 && history[0].enteredAt.getTime()===saved.acceptedAt.getTime() && history[0].slaStandardHours===8,'one SLA starts exactly at acceptance');
  const internalDocs=await db.document.findMany({where:{applicationId:loanId}});
  check(internalDocs.length===4 && internalDocs.some(d=>d.portalDocumentId===b2.id) && !internalDocs.some(d=>[b0.id,b1.id,c.id].includes(d.portalDocumentId)),'only active frozen manifest copied');
  const company=await db.company.findUniqueOrThrow({where:{taxCode:r.data.taxCode}});
  check(!Object.hasOwn(company,'capitalPlan'),'extended portal fields not spread into Company');
  const companyHash=createHash('sha256').update(JSON.stringify(company)).digest('hex');
  let linked=await complete(data({taxCode:r.data.taxCode,companyName:'Changed synthetic name'}));
  linked=expect(await submit(linked),201,'submit tax-match fixture');await assign(linked);
  expect(await accept(linked),409,'existing Company requires confirmation');
  expect(await post(`/portal-intakes/${linked.id}/accept`,officer,{confirmExistingCompany:true}),201,'explicit existing-company link');
  check(createHash('sha256').update(JSON.stringify(await db.company.findUniqueOrThrow({where:{id:company.id}}))).digest('hex')===companyHash,'existing Company unchanged');

  // Tamper is performed only in the owned namespace, then restored for each check.
  let tamper=await complete();tamper=expect(await submit(tamper),201,'submit tamper fixture');await assign(tamper);
  const stored=await db.portalRequest.findUniqueOrThrow({where:{id:tamper.id}});
  await db.portalRequest.update({where:{id:tamper.id},data:{data:{...stored.data,companyName:'Tampered'}}});
  expect(await accept(tamper),[400,409],'tampered request data rejected');
  await db.portalRequest.update({where:{id:tamper.id},data:{data:stored.data}});
  const doc=await db.portalDocument.findFirstOrThrow({where:{requestId:tamper.id,documentGroup:'A'}});
  await db.portalDocument.update({where:{id:doc.id},data:{fileName:'tampered.pdf'}});
  expect(await call(`/portal-intakes/${tamper.id}/documents/${doc.id}/download`,officer),409,'staff download rejects changed snapshot metadata');
  expect(await accept(tamper),[400,409],'tampered metadata rejected');
  await db.portalDocument.update({where:{id:doc.id},data:{fileName:doc.fileName}});
  const file=path.join(uploadDir,doc.filePath),bytes=await fs.readFile(file);
  try {await fs.writeFile(file,Buffer.concat([bytes,Buffer.from('changed')]));expect(await call(`/portal-intakes/${tamper.id}/documents/${doc.id}/download`,officer),409,'staff download rejects changed snapshot bytes');expect(await accept(tamper),[400,409],'tampered physical SHA rejected');}
  finally {await fs.writeFile(file,bytes);}
  check((await db.portalRequest.findUniqueOrThrow({where:{id:tamper.id}})).loanId===null,'tamper failures create no loan');

  async function withFault(table,condition,run) {
    // Fully qualified schema, fixed identifiers, UUID fixture predicates. No public trigger.
    assert.match(h.schema,/^portal_v2_it_[a-z0-9_]+$/);
    const q=`"${h.schema}"`;
    await db.$executeRawUnsafe(`CREATE FUNCTION ${q}.portal_fixture_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'isolated fixture fault'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER portal_fixture_fault BEFORE INSERT ON ${q}.${table} FOR EACH ROW EXECUTE FUNCTION ${q}.portal_fixture_fault()`);
      try {await run();} finally {await db.$executeRawUnsafe(`DROP TRIGGER portal_fixture_fault ON ${q}.${table}`);}
    } finally {await db.$executeRawUnsafe(`DROP FUNCTION ${q}.portal_fixture_fault()`);}
  }
  let failed=await complete();
  await withFault('internal_notifications',`NEW.request_id = '${failed.id}'`,async()=>{
    expect(await submit(failed),500,'notification fault exposed');
    const persisted=await db.portalRequest.findUniqueOrThrow({where:{id:failed.id}});
    check(persisted.status==='DRAFT' && persisted.checklistSnapshot===null && persisted.submittedAt===null,'notification fault rolls back submit/snapshot');
    check(await db.internalNotification.count({where:{requestId:failed.id}})===0,'notification fault leaves no notices');
  });
  failed=expect(await submit(failed),201,'retry after notification rollback');await assign(failed);
  const before={loans:await db.loanApplication.count(),companies:await db.company.count(),history:await db.applicationStageHistory.count(),docs:await db.document.count()};
  await withFault('documents',`NEW.portal_document_id = '${failed.documents[0].id}'`,async()=>{
    expect(await accept(failed),500,'document copy fault exposed');
    check(await db.loanApplication.count()===before.loans && await db.company.count()===before.companies && await db.applicationStageHistory.count()===before.history && await db.document.count()===before.docs,'copy failure rolls back Company/Loan/docs/SLA');
    check((await db.portalRequest.findUniqueOrThrow({where:{id:failed.id}})).status==='ASSIGNED','copy failure preserves assigned request');
  });
  expect(await accept(failed),201,'retry acceptance after rollback');
  const transition=await post(`/workflow/${loanId}/transition`,officer,{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'});
  expect(transition,400,'current workflow completeness guard preserved');
  // Current internal confirmation accepts the officer's explicit decision; it does
  // not enforce six groups. Exercise that existing API without inventing E/F files.
  expect(await call(`/loan-applications/${loanId}/check-documents`,{...officer,method:'PUT',body:{isComplete:true}}),200,'officer confirms internal completeness');
  expect(await post(`/workflow/${loanId}/transition`,officer,{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'}),201,'existing internal next-stage transition');
  const advanced=await db.loanApplication.findUniqueOrThrow({where:{id:loanId}});
  const advancedHistory=await db.applicationStageHistory.findMany({where:{applicationId:loanId},orderBy:{enteredAt:'asc'}});
  check(advanced.currentStage==='THAM_DINH' && advanced.currentStatus==='PENDING_APPRAISAL' && advancedHistory.length===2 && advancedHistory[0].exitedAt!==null && advancedHistory[1].exitedAt===null,'next stage preserves status and one open SLA history');
  let ml={status:'UNAVAILABLE',runtime:false};
  let health;
  try {health=await fetch('http://127.0.0.1:8000/health',{signal:AbortSignal.timeout(1500)});} catch {}
  if(health?.ok) {
    const {PredictionService}=require('../dist/modules/prediction/prediction.service');
    const prediction=await new PredictionService(db).predictForApplication(loanId);
    check(prediction.applicationId===loanId && Number.isFinite(prediction.delayProbability),'real ML prediction persisted in isolated schema');
    ml={status:'PASS',runtime:true,meaning:'SLA delay risk only'};
  } else limitations.push('ML localhost:8000 health unavailable; real prediction runtime not verified, no mock response used.');
  h.browserFixture={base,portalEmail:portal.account.email,managerUsername:manager.user.username,officerUsername:officer.user.username,password,acceptedRequestId:r.id,submittedRequestId:conditional.id};
  return {pass:true,httpAndDatabaseChecks:checks,policy:'TEST_ONLY; not bank policy',schema:h.schema,ml,limitations};
}

module.exports={startIsolated,runChecks,policy};
if(require.main===module) {
  (async()=>{
    let h,result,error,cleanup;
    try {
      h=await startIsolated();result=await runChecks(h);
      const hold=Number(process.env.KEEP_TEST_SERVER_MS||0);
      assert.ok(Number.isSafeInteger(hold) && hold>=0 && hold<=600000,'KEEP_TEST_SERVER_MS must be between 0 and 600000');
      if(hold) {
        console.log(JSON.stringify({browserReady:true,expiresInMs:hold,fixture:h.browserFixture}));
        await new Promise(resolve=>{
          const done=()=>{clearTimeout(timer);process.removeListener('SIGINT',done);process.removeListener('SIGTERM',done);resolve();};
          const timer=setTimeout(done,hold);
          process.once('SIGINT',done);process.once('SIGTERM',done);
        });
      }
    } catch(e) {error=e;}
    finally {try {cleanup=await h?.close();} catch(e) {error=error||e;}}
    if(error) {console.error(JSON.stringify({pass:false,error:error.message,cleanup}));process.exitCode=1;}
    else console.log(JSON.stringify({...result,cleanup}));
  })();
}
