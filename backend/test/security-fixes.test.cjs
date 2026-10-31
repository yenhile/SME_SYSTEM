const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('reflect-metadata');
const bcrypt=require('bcryptjs');
const {jwtSecret}=require('../dist/common/security/jwt-secret');
const {LoginThrottle}=require('../dist/modules/auth/login-throttle');
const {AuthService}=require('../dist/modules/auth/auth.service');
const {DocumentsService}=require('../dist/modules/documents/documents.service');
const {AssignmentsService}=require('../dist/modules/assignments/assignments.service');

// ===== 1. Khóa ký đăng nhập không còn giá trị mặc định công khai =====
function withEnv(env,fn) {
  const saved={JWT_SECRET:process.env.JWT_SECRET,NODE_ENV:process.env.NODE_ENV};
  for(const [k,v] of Object.entries(env)) v===undefined?delete process.env[k]:process.env[k]=v;
  const warn=console.warn;console.warn=()=>{};
  try {return fn();} finally {console.warn=warn;for(const [k,v] of Object.entries(saved)) v===undefined?delete process.env[k]:process.env[k]=v;}
}
test('no source file contains a built-in fallback secret any more',()=>{
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  const hits=walk(path.join(__dirname,'..','src')).filter(f=>/\.ts$/.test(f)&&fs.readFileSync(f,'utf8').includes('sme_loan_workflow_secret_key'));
  assert.deepEqual(hits,[]);
});
test('a configured JWT_SECRET is used as is',()=>{
  withEnv({JWT_SECRET:'x'.repeat(40),NODE_ENV:'production'},()=>assert.equal(jwtSecret(),'x'.repeat(40)));
});
test('production refuses to start without JWT_SECRET',()=>{
  withEnv({JWT_SECRET:undefined,NODE_ENV:'production'},()=>assert.throws(()=>jwtSecret(),/Thiếu JWT_SECRET/));
});
test('a too short JWT_SECRET is rejected, a 28 character one still works with a warning',()=>{
  withEnv({JWT_SECRET:'short',NODE_ENV:'development'},()=>assert.throws(()=>jwtSecret(),/quá ngắn/));
  withEnv({JWT_SECRET:'a'.repeat(28),NODE_ENV:'development'},()=>assert.equal(jwtSecret(),'a'.repeat(28)));
});
test('outside production a missing secret becomes a random per-process key, never a known string',()=>{
  withEnv({JWT_SECRET:undefined,NODE_ENV:'development'},()=>{
    const first=jwtSecret();
    assert.match(first,/^[0-9a-f]{96}$/);
    assert.equal(jwtSecret(),first,'stable within one process');
    assert.notEqual(first,'sme_loan_workflow_secret_key_2026');
  });
});

// ===== 2. Giới hạn số lần đăng nhập nhân viên =====
test('LoginThrottle locks after the limit until the window ends, then allows again',()=>{
  const t=new LoginThrottle(3,1000);
  for(let i=0;i<2;i++) t.recordFailure('a',0);
  assert.equal(t.retryAfterMs('a',10),0,'below the limit');
  t.recordFailure('a',20);
  assert.equal(t.retryAfterMs('a',30),970,'locked for the rest of the window');
  assert.equal(t.retryAfterMs('b',30),0,'other usernames are independent');
  assert.equal(t.retryAfterMs('a',1000),0,'window over');
  t.recordFailure('a',1100);
  assert.equal(t.retryAfterMs('a',1100),0,'a new window starts from one failure');
});
test('LoginThrottle forgets a user after reset and keeps memory bounded',()=>{
  const t=new LoginThrottle(2,1000,3);
  t.recordFailure('a',0);t.recordFailure('a',1);t.reset('a');
  assert.equal(t.retryAfterMs('a',2),0);
  for(const key of ['k1','k2','k3','k4','k5']) t.recordFailure(key,5);
  assert.ok(t.entries.size<=3,'never grows beyond the cap');
});
function auth(user) {
  const calls={sign:0};
  const prisma={user:{findUnique:async({where})=>where.username===user?.username?user:null}};
  const jwt={sign:()=>{calls.sign++;return 'token';}};
  return {calls,service:new AuthService(prisma,jwt)};
}
const account=async(over={})=>({id:'u1',username:'test_cbtd',fullName:'X',email:'x@e.test',phone:null,branchName:'b',isActive:true,passwordHash:await bcrypt.hash('Dung1234',4),roles:[{role:{code:'CBTD'}}],...over});
test('five wrong passwords lock the account for 15 minutes even for the right password',async()=>{
  const {service}=auth(await account());
  const wrong=n=>service.login({username:'test_cbtd',password:'Sai12345'},n);
  for(let i=0;i<5;i++) await assert.rejects(wrong(1000+i),e=>e.getStatus()===401);
  await assert.rejects(wrong(2000),e=>e.getStatus()===429&&/thử lại sau \d+ phút/.test(e.message));
  await assert.rejects(service.login({username:'test_cbtd',password:'Dung1234'},3000),e=>e.getStatus()===429,'right password is refused while locked');
  const ok=await service.login({username:'test_cbtd',password:'Dung1234'},1000+15*60*1000+1);
  assert.equal(ok.accessToken,'token','works again after the window');
});
test('a successful login clears the failure count',async()=>{
  const {service}=auth(await account());
  for(let i=0;i<4;i++) await assert.rejects(service.login({username:'test_cbtd',password:'Sai12345'},100+i),e=>e.getStatus()===401);
  await service.login({username:'test_cbtd',password:'Dung1234'},200);
  for(let i=0;i<4;i++) await assert.rejects(service.login({username:'test_cbtd',password:'Sai12345'},300+i),e=>e.getStatus()===401,'counter restarted');
});
test('unknown usernames are throttled the same way so valid names are not revealed',async()=>{
  const {service}=auth(null);
  for(let i=0;i<5;i++) await assert.rejects(service.login({username:'khong_co',password:'Sai12345'},10+i),e=>e.getStatus()===401);
  await assert.rejects(service.login({username:'KHONG_CO ',password:'Sai12345'},50),e=>e.getStatus()===429,'case and spaces do not bypass');
});
test('a locked-out (inactive) account message is not counted as a password guess',async()=>{
  const {service}=auth(await account({isActive:false}));
  for(let i=0;i<8;i++) await assert.rejects(service.login({username:'test_cbtd',password:'Dung1234'},10+i),e=>e.getStatus()===401&&/tạm khóa/.test(e.message));
});

// ===== 3. Chứng từ đổi thì hủy xác nhận "đủ chứng từ" =====
function documents(loan) {
  const state={updates:[],locks:0,created:0,deleted:0};
  const tx={
    $queryRaw:async()=>{state.locks++;return[];},
    loanApplication:{findUnique:async()=>loan,update:async({data})=>{state.updates.push(data);return{...loan,...data};}},
    document:{create:async({data})=>{state.created++;return{id:'d1',...data};},findUnique:async()=>({id:'d1',applicationId:'l1',filePath:'seed/x.pdf'}),delete:async()=>{state.deleted++;return{id:'d1'};}},
  };
  const prisma={$transaction:async fn=>fn(tx),document:{findUnique:async()=>({id:'d1',applicationId:'l1',filePath:'seed/x.pdf',portalDocumentId:null})}};
  return {state,service:new DocumentsService(prisma)};
}
const loanAt=(currentStage,currentStatus,isDocumentComplete)=>({id:'l1',currentStage,currentStatus,isDocumentComplete});
const dto={documentType:'BAO_CAO_TAI_CHINH',fileName:'a.pdf',fileSize:1,mimeType:'application/pdf',filePath:'k'};
test('adding a document after the confirmation withdraws it and returns the loan to RECEIVED',async()=>{
  const {state,service}=documents(loanAt('TIEP_NHAN','CHECKED',true));
  await service.create('l1',dto,'u');
  assert.equal(state.created,1);assert.equal(state.locks,1);
  assert.equal(state.updates.length,1);assert.equal(state.updates[0].isDocumentComplete,false);assert.equal(state.updates[0].currentStatus,'RECEIVED');
});
test('deleting a document after the confirmation withdraws it too',async()=>{
  const {state,service}=documents(loanAt('TIEP_NHAN','CHECKED',true));
  await service.delete('d1');
  assert.equal(state.deleted,1);assert.equal(state.updates.length,1);assert.equal(state.updates[0].isDocumentComplete,false);
});
test('nothing changes when the loan was not confirmed or is past reception',async()=>{
  for(const loan of [loanAt('TIEP_NHAN','RECEIVED',false),loanAt('TIEP_NHAN','SUPPLEMENT_REQUIRED',false),loanAt('THAM_DINH','PENDING_APPRAISAL',true),loanAt('CAP_TREN','WAITING_HEAD_OFFICE',true)]) {
    const {state,service}=documents(loan);
    await service.create('l1',dto,'u');
    assert.equal(state.created,1);assert.equal(state.updates.length,0,`${loan.currentStage}/${loan.currentStatus}`);
  }
});
test('a missing loan is rejected and no document is stored',async()=>{
  const {state,service}=documents(null);
  await assert.rejects(service.create('l1',dto,'u'),e=>e.getStatus()===404);
  assert.equal(state.created,0);
});

// ===== 4. Điều chuyển CBTD trong một giao dịch =====
function reassigner({loan,officer,failUpdate=false}) {
  const state={order:[],predicted:0,outside:0};
  const tx={
    $queryRaw:async()=>{state.order.push('lock');return[];},
    loanApplication:{findUnique:async()=>{state.order.push('read');return loan;},update:async({data})=>{state.order.push('update');if(failUpdate)throw new Error('db down');return{...loan,...data};}},
    user:{findUnique:async()=>officer},
    applicationAssignment:{create:async({data})=>{state.order.push('history');return data;}},
  };
  const outside=()=>{state.outside++;throw new Error('must run inside the transaction');};
  const prisma={$transaction:async fn=>fn(tx),loanApplication:{findUnique:outside,update:outside},user:{findUnique:outside},applicationAssignment:{create:outside}};
  return {state,service:new AssignmentsService(prisma,{predictForApplication:async()=>{state.predicted++;}})};
}
const officer=(over={})=>({id:'new',fullName:'B',isActive:true,roles:[{role:{code:'CBTD'}}],...over});
const openLoan={id:'l1',applicationCode:'HS-1',assignedTo:'old',currentStage:'TIEP_NHAN',completedAt:null};
test('reassignment locks the loan and writes history and owner together inside one transaction',async()=>{
  const {state,service}=reassigner({loan:openLoan,officer:officer()});
  const result=await service.reassign('l1',{newOfficerId:'new',reason:'cân tải'},'mgr');
  assert.deepEqual(state.order,['lock','read','history','update']);
  assert.equal(state.outside,0);assert.equal(state.predicted,1);
  assert.equal(result.loan.assignedTo,'new');
});
test('a failure while changing the owner aborts the whole reassignment before any prediction',async()=>{
  const {state,service}=reassigner({loan:openLoan,officer:officer(),failUpdate:true});
  await assert.rejects(service.reassign('l1',{newOfficerId:'new'},'mgr'),/db down/);
  assert.equal(state.predicted,0,'no follow-up work after a rolled back change');
});
test('reassignment keeps its validation rules',async()=>{
  for(const [loan,off,status] of [
    [null,officer(),404],
    [{...openLoan,completedAt:new Date()},officer(),400],
    [{...openLoan,assignedTo:'new'},officer(),400],
    [openLoan,null,404],
    [openLoan,officer({isActive:false}),404],
    [openLoan,officer({roles:[{role:{code:'THAM_QUYEN'}}]}),400],
  ]) {
    const {state,service}=reassigner({loan,officer:off});
    await assert.rejects(service.reassign('l1',{newOfficerId:'new'},'mgr'),e=>e.getStatus()===status);
    assert.ok(!state.order.includes('history')&&!state.order.includes('update'),'nothing written on a rejected request');
  }
});
