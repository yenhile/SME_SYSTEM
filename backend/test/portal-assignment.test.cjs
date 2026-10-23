const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalService}=require('../dist/modules/portal/portal.service');

function fixture(status='SUBMITTED',assignedTo=null) {
  const state={request:{id:'request',reference:'DN-test',status,assignedTo,data:{},documents:[]},history:[],notices:[],locks:[]};
  const tx={
    $queryRaw:async(strings,...values)=>{state.locks.push(strings.join('?'));return[];},
    portalRequest:{findFirst:async()=>({...state.request}),findUnique:async()=>({...state.request}),findUniqueOrThrow:async()=>({...state.request}),update:async({data})=>Object.assign(state.request,data)},
    user:{findFirst:async({where})=>where.id==='inactive'?null:{id:where.id},findMany:async()=>[{id:'manager'}]},
    portalAssignment:{create:async({data})=>{state.history.push(data);return data;}},
    internalNotification:{createMany:async({data})=>{state.notices.push(...data);return{count:data.length};}},
    loanApplication:{findFirst:async({where})=>where.assignedTo==='new-owner'?{id:'loan'}:null},
  };
  return {state,tx,service:new PortalService({...tx,$transaction:async fn=>fn(tx)})};
}
test('CBTD queue includes only assigned intakes and current linked loan ownership',async()=>{
  let query;
  const service=new PortalService({portalRequest:{findMany:async args=>{query=args;return[];}},loanApplication:{findMany:async()=>[]}});
  await service.list(undefined,{id:'officer',roles:['CBTD']});
  assert.deepEqual(query.where,{OR:[{status:'ASSIGNED',assignedTo:'officer'},{status:'ACCEPTED',loan:{is:{assignedTo:'officer'}}}]});
  assert.deepEqual(query.include.assignedOfficer,{select:{id:true,fullName:true,username:true}});
});
test('unassigned intake cannot be accepted by a CBTD',async()=>{
  const {service}=fixture();
  await assert.rejects(service.accept('request','officer'),e=>e.getStatus()===404);
});
test('accepted request retry follows current loan owner after transfer',async()=>{
  const {service,state}=fixture('ACCEPTED','old-owner');
  Object.assign(state.request,{acceptedBy:'old-owner',loanId:'loan'});
  const result=await service.accept('request','new-owner');
  assert.equal(result.loanId,'loan');
  await assert.rejects(service.accept('request','old-owner'),e=>e.getStatus()===404);
});
test('assignment locks request, changes status and atomically records history and notification',async()=>{
  const {service,state}=fixture();
  const result=await service.assign('request',{officerId:'officer',expectedAssignedTo:null},'manager');
  assert.equal(result.status,'ASSIGNED');assert.equal(result.assignedTo,'officer');
  assert.ok(state.locks.some(sql=>sql.includes('FOR UPDATE')));
  assert.equal(state.history.length,1);assert.equal(state.history[0].managerId,'manager');
  assert.equal(state.notices.length,1);assert.equal(state.notices[0].userId,'officer');
  await assert.rejects(service.assign('request',{officerId:'other',expectedAssignedTo:null},'manager'),e=>e.getStatus()===409);
  assert.equal(state.history.length,1);assert.equal(state.notices.length,1);
});
test('reassignment requires reason and notifies old and new officers only once',async()=>{
  const {service,state}=fixture('ASSIGNED','old');
  await assert.rejects(service.assign('request',{officerId:'new',expectedAssignedTo:'old'},'manager'),e=>e.getStatus()===400);
  await service.assign('request',{officerId:'new',expectedAssignedTo:'old',note:'Balance workload'},'manager');
  assert.deepEqual(state.notices.map(n=>n.userId).sort(),['new','old']);
  assert.equal(state.history[0].fromUserId,'old');
  await service.assign('request',{officerId:'new',expectedAssignedTo:'new'},'manager');
  assert.equal(state.history.length,1);assert.equal(state.notices.length,2);
});
test('assignment rejects inactive officers, malformed concurrency token and accepted requests',async()=>{
  const {service}=fixture();
  for(const body of [{officerId:'inactive',expectedAssignedTo:null},{officerId:'officer'},{officerId:'officer',expectedAssignedTo:null,unexpected:true}]) await assert.rejects(service.assign('request',body,'manager'),e=>e.getStatus()===400);
  const accepted=fixture('ACCEPTED');
  await assert.rejects(accepted.service.assign('request',{officerId:'officer',expectedAssignedTo:null},'manager'),e=>e.getStatus()===409);
});

test('submit notifies active managers transactionally and retry does not duplicate notices',async()=>{
  const {service,state,tx}=fixture('DRAFT');
  state.request.data={taxCode:'0123456789',companyName:'Demo',industry:'Manufacturing',establishedYear:2020,annualRevenue:1,charterCapital:1,representativeName:'Demo',phone:'0901234567',address:'Demo',loanPurpose:'Working capital',loanType:'VAY_VON_LUU_DONG',proposedAmount:8000000000,loanTermMonths:12};
  state.request.documents='ABCDEF'.split('').map(documentGroup=>({documentGroup}));
  let recipientsQuery;
  tx.user.findMany=async query=>{recipientsQuery=query;return[{id:'manager-1'},{id:'manager-2'}];};
  await service.submit('request','owner');
  assert.equal(state.request.status,'SUBMITTED');assert.equal(state.notices.length,2);
  assert.deepEqual(recipientsQuery.where,{isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}});
  assert.equal(recipientsQuery.where.branchName,undefined);
  await service.submit('request','owner');assert.equal(state.notices.length,2);
});

test('officer workload uses active loan statuses and assigned requests only',async()=>{
  const queries=[];
  const service=new PortalService({user:{findMany:async query=>{queries.push(query);return[{id:'officer',fullName:'Demo',username:'demo'}];}},loanApplication:{count:async query=>{queries.push(query);return 4;}},portalRequest:{count:async query=>{queries.push(query);return 2;}}});
  assert.deepEqual(await service.officers(),[{id:'officer',fullName:'Demo',username:'demo',activeLoanCount:4,pendingIntakeCount:2}]);
  assert.deepEqual(queries[0].where,{isActive:true,roles:{some:{role:{code:'CBTD'}}}});
  assert.deepEqual(queries[1].where.currentStatus.in,['RECEIVED','CHECKED','SUPPLEMENT_REQUIRED','PENDING_APPRAISAL','WAITING_HEAD_OFFICE']);
  assert.deepEqual(queries[2].where,{assignedTo:'officer',status:'ASSIGNED'});
});

test('history checks current request visibility before returning internal notes',async()=>{
  let called=false;
  const service=new PortalService({portalRequest:{findFirst:async()=>null},portalAssignment:{findMany:async()=>{called=true;return[];}}});
  await assert.rejects(service.assignmentHistory('request',{id:'old',roles:['CBTD']}),e=>e.getStatus()===404);
  assert.equal(called,false);
});

test('assignment controller limits officer list and assign to active QUAN_LY role',()=>{
  const {Reflector}=require('@nestjs/core');
  const {RolesGuard}=require('../dist/common/guards/roles.guard');
  const {PortalIntakesController}=require('../dist/modules/portal/portal.controller');
  const guard=new RolesGuard(new Reflector());
  const context=(method,roles)=>({getHandler:()=>PortalIntakesController.prototype[method],getClass:()=>PortalIntakesController,switchToHttp:()=>({getRequest:()=>({user:{roles}})})});
  for(const method of ['officers','assign']) {
    assert.equal(guard.canActivate(context(method,['QUAN_LY'])),true);
    for(const role of ['CBTD','THAM_QUYEN','ADMIN']) assert.throws(()=>guard.canActivate(context(method,[role])),e=>e.getStatus()===403);
  }
});
