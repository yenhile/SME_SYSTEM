const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {WorkflowService}=require('../dist/modules/workflow/workflow.service');
const {AssignmentsService}=require('../dist/modules/assignments/assignments.service');
const {UsersService}=require('../dist/modules/users/users.service');

const status=code=>e=>e.getStatus()===code;
function workflow(loan) {
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l1',currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',completedAt:null,proposedAmount:1000,...loan})}};
  return new WorkflowService({$transaction:async fn=>fn(tx)},{predictForApplication:async()=>{}});
}
const approve={targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:1000,interestRate:10};

test('the CBTD who received a loan cannot also appraise or approve it',async()=>{
  await assert.rejects(workflow({assignedTo:'u1'}).transitionStage('l1',approve,{id:'u1',activeRole:'THAM_QUYEN'}),status(403));
  await assert.rejects(workflow({assignedTo:'u1'}).transitionStage('l1',{targetStage:'HOAN_TAT',targetStatus:'REJECTED',rejectionReasonCode:'X',rejectionNote:'y'},{id:'u1',activeRole:'THAM_QUYEN'}),status(403));
});
test('another approver is not blocked by the self-approval rule',async()=>{
  // Không chạm tới nhánh chặn; lỗi còn lại (thiếu công đoạn đích trong mock) chứng tỏ đã qua kiểm tra người làm khác người duyệt.
  await assert.rejects(workflow({assignedTo:'u1'}).transitionStage('l1',approve,{id:'u2',activeRole:'THAM_QUYEN'}),e=>!(e.getStatus&&e.getStatus()===403));
});
test('a manager cannot close a loan they are assigned to',async()=>{
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l1',assignedTo:'m1',currentStage:'TIEP_NHAN',currentStatus:'SUPPLEMENT_REQUIRED',completedAt:null})}};
  const service=new WorkflowService({$transaction:async fn=>fn(tx)},{predictForApplication:async()=>{}});
  await assert.rejects(service.closeOverdueSupplement('l1',{reason:'quá hạn'},{id:'m1',activeRole:'QUAN_LY'}),status(403));
});
test('a manager cannot assign a loan to themselves',async()=>{
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l1',assignedTo:'old',completedAt:null,currentStage:'TIEP_NHAN'})}};
  const service=new AssignmentsService({$transaction:async fn=>fn(tx)},{predictForApplication:async()=>{}});
  await assert.rejects(service.reassign('l1',{newOfficerId:'m1'},'m1'),status(400));
});

function users({openLoans=0}={}) {
  const writes=[];
  const tx={
    role:{findMany:async({where})=>where.code.in.map(code=>({id:code,code}))},
    loanApplication:{count:async()=>openLoans},
    user:{update:async()=>{writes.push('user');},findUnique:async()=>({id:'x',roles:[]})},
    userRole:{deleteMany:async()=>{writes.push('roles');},createMany:async()=>{}},
  };
  return {writes,service:new UsersService({$transaction:async fn=>fn(tx),user:tx.user})};
}
test('an admin cannot lock themselves or drop their own admin role',async()=>{
  for(const body of [{isActive:false},{roles:['CBTD']}]) {
    const {writes,service}=users();
    await assert.rejects(service.update('a1',body,'a1'),status(400));
    assert.deepEqual(writes,[]);
  }
});
test('an admin may still edit their own profile and keep the admin role',async()=>{
  const {service}=users();
  await service.update('a1',{fullName:'A',roles:['ADMIN','QUAN_LY']},'a1');
});
test('locking or removing the CBTD role is refused while the officer holds open loans',async()=>{
  for(const body of [{isActive:false},{roles:['QUAN_LY']}]) {
    const {writes,service}=users({openLoans:3});
    await assert.rejects(service.update('c1',body,'a1'),e=>e.getStatus()===400&&/3 hồ sơ/.test(e.message));
    assert.deepEqual(writes,[]);
  }
});
test('an officer without open loans can be locked, and a CBTD with loans can still be edited otherwise',async()=>{
  await users().service.update('c1',{isActive:false},'a1');
  await users({openLoans:3}).service.update('c1',{fullName:'Mới',roles:['CBTD','QUAN_LY']},'a1');
});
