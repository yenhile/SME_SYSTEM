const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {LoanAccessGuard}=require('../dist/common/guards/loan-access.guard');
const {assertQueueRequest}=require('../dist/modules/loan-applications/appraisal-queue');
const {AssignmentChangeRequestsService}=require('../dist/modules/assignments/assignment-change-requests.service');

const admin={id:'admin-1',activeRole:'ADMIN',roles:['ADMIN']};
const status=code=>e=>typeof e.getStatus==='function'&&e.getStatus()===code;

test('Admin mở được mọi hồ sơ ở mọi công đoạn khi chỉ đọc', async () => {
  const loans={
    reception:{id:'reception',assignedTo:'cbtd-a',currentStage:'TIEP_NHAN',completedAt:null},
    done:{id:'done',assignedTo:'cbtd-b',currentStage:'HOAN_TAT',completedAt:new Date()},
  };
  const guard=new LoanAccessGuard({loanApplication:{findUnique:async({where})=>loans[where.id]||null}});
  for(const id of Object.keys(loans)) {
    const request={params:{id},method:'GET',originalUrl:`/api/loan-applications/${id}`,user:admin};
    assert.equal(await guard.canActivate({switchToHttp:()=>({getRequest:()=>request})}),true,id);
  }
});

test('Admin xem được hàng việc thẩm định như Quản lý, CBTD vẫn bị chặn', () => {
  for(const queue of ['DECIDE','CBTD','ENTERPRISE','OTHER_REVIEWER']) assert.equal(assertQueueRequest(queue,admin),queue);
  assert.throws(()=>assertQueueRequest('DECIDE',{id:'c',activeRole:'CBTD'}),status(403));
});

function coordination(rows) {
  const prisma={
    assignmentChangeRequest:{
      findMany:async({where})=>rows.filter(r=>!where.requestedById||r.requestedById===where.requestedById),
      findUnique:async({where})=>rows.find(r=>r.id===where.id)??null,
    },
    loanApplication:{findUnique:async()=>({id:'loan-1',applicationCode:'SME-1',assignedTo:'cbtd-a',assignmentVersion:2,currentStage:'TIEP_NHAN',completedAt:null,company:{taxCode:'0101'}})},
    $transaction:async()=>assert.fail('Admin không được ghi'),
  };
  return new AssignmentChangeRequestsService(prisma,{predictForApplication:async()=>assert.fail('không được chấm dự báo')});
}
const receipt=(id,requestedById)=>({id,applicationId:'loan-1',portalRequestId:null,requestedById,reasonCode:'WORKLOAD',reason:'Quá tải',status:'PENDING',requestVersion:1,createdAt:new Date('2026-11-10T02:00:00Z'),managerRecipientCount:1});

test('Admin xem mọi đề nghị điều phối nhưng không có nút quyết định hay rút', async () => {
  const service=coordination([receipt('r1','cbtd-a'),receipt('r2','cbtd-b')]);
  const rows=await service.list({},admin);
  assert.deepEqual(rows.map(r=>r.id),['r1','r2']);
  for(const row of rows) {
    assert.equal(row.canResolve,false);
    assert.equal(row.canCancel,false);
    assert.equal(row.currentCaseLinkAllowed,true);
  }
  assert.equal((await service.detail('r2',admin)).id,'r2');
});

test('Admin không gửi, quyết định hay rút đề nghị điều phối', async () => {
  const service=coordination([receipt('r1','cbtd-a')]);
  await assert.rejects(service.create({subjectType:'LOAN',subjectId:'loan-1'},admin),status(403));
  for(const kind of ['approve','reject','cancel']) await assert.rejects(service.resolve('r1',kind,{},admin),status(403),kind);
});
