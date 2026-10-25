const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {Reflector}=require('@nestjs/core');
const {LoanAccessGuard}=require('../dist/common/guards/loan-access.guard');
const {RolesGuard}=require('../dist/common/guards/roles.guard');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');
const {PortalIntakesController}=require('../dist/modules/portal/portal.controller');

const loans={
  own:{id:'own',assignedTo:'cbtd-a',currentStage:'TIEP_NHAN',completedAt:null},
  other:{id:'other',assignedTo:'cbtd-b',currentStage:'TIEP_NHAN',completedAt:null},
  review:{id:'review',assignedTo:'cbtd-b',currentStage:'THAM_DINH',completedAt:null},
  senior:{id:'senior',assignedTo:'cbtd-b',currentStage:'CAP_TREN',completedAt:null},
  done:{id:'done',assignedTo:'cbtd-a',currentStage:'HOAN_TAT',completedAt:new Date()},
};
const prisma={
  loanApplication:{findUnique:async({where})=>loans[where.id]||null},
  supplementRequest:{findUnique:async({where})=>where.id==='sup-other'?{id:where.id,applicationId:'other'}:null},
  document:{findUnique:async({where})=>where.id==='doc-other'?{id:where.id,applicationId:'other'}:null},
};
const guard=new LoanAccessGuard(prisma);
const run=(role,{params={},method='GET',url='/api/loan-applications/x',id='cbtd-a'}={})=>
  guard.canActivate({switchToHttp:()=>({getRequest:()=>({params,method,originalUrl:url,user:{id,activeRole:role}})})});
const status=e=>e.getStatus();

test('route without an id passes through',async()=>{
  assert.equal(await run('CBTD'),true);
});
test('unknown loan returns 404',async()=>{
  await assert.rejects(run('QUAN_LY',{params:{id:'missing'}}),e=>status(e)===404);
  await assert.rejects(run('QUAN_LY',{params:{applicationId:'missing'}}),e=>status(e)===404);
});
test('CBTD opens own loan but not another officer loan',async()=>{
  assert.equal(await run('CBTD',{params:{id:'own'}}),true);
  await assert.rejects(run('CBTD',{params:{id:'other'}}),e=>status(e)===403);
  await assert.rejects(run('CBTD',{params:{applicationId:'other'}}),e=>status(e)===403);
});
test('CBTD cannot reach another officer loan through document or supplement ids',async()=>{
  await assert.rejects(run('CBTD',{params:{id:'doc-other'},url:'/api/documents/doc-other/download'}),e=>status(e)===403);
  await assert.rejects(run('CBTD',{params:{supplementId:'sup-other'},url:'/api/supplements/sup-other'}),e=>status(e)===403);
  await assert.rejects(run('CBTD',{params:{supplementId:'nope'}}),e=>status(e)===404);
  await assert.rejects(run('CBTD',{params:{id:'nope'},url:'/api/documents/nope'}),e=>status(e)===404);
});
test('QUAN_LY opens any loan',async()=>{
  for(const id of ['own','other','review','done']) assert.equal(await run('QUAN_LY',{params:{id},id:'manager'}),true);
});
test('THAM_QUYEN opens loans from THAM_DINH onwards but not TIEP_NHAN',async()=>{
  for(const id of ['review','senior','done']) assert.equal(await run('THAM_QUYEN',{params:{id},id:'auth'}),true);
  await assert.rejects(run('THAM_QUYEN',{params:{id:'other'},id:'auth'}),e=>status(e)===403);
  await assert.rejects(run('THAM_QUYEN',{params:{applicationId:'own'},id:'auth'}),e=>status(e)===403);
  await assert.rejects(run('THAM_QUYEN',{params:{id:'doc-other'},url:'/api/documents/doc-other',id:'auth'}),e=>status(e)===403);
});
test('writes to a finished loan are rejected',async()=>{
  await assert.rejects(run('CBTD',{params:{id:'done'},method:'POST'}),e=>status(e)===403);
  await assert.rejects(run('QUAN_LY',{params:{id:'done'},method:'PATCH',id:'manager'}),e=>status(e)===403);
});
test('document and supplement writes require the role of the current stage',async()=>{
  assert.equal(await run('CBTD',{params:{applicationId:'own'},method:'POST',url:'/api/documents/upload'}),true);
  await assert.rejects(run('QUAN_LY',{params:{applicationId:'own'},method:'POST',url:'/api/documents/upload',id:'manager'}),e=>status(e)===403);
  assert.equal(await run('THAM_QUYEN',{params:{applicationId:'review'},method:'POST',url:'/api/supplements/x',id:'auth'}),true);
  await assert.rejects(run('QUAN_LY',{params:{applicationId:'review'},method:'POST',url:'/api/supplements/x',id:'manager'}),e=>status(e)===403);
  await assert.rejects(run('CBTD',{params:{applicationId:'review'},method:'POST',url:'/api/documents/upload',id:'cbtd-b'}),e=>status(e)===403);
});

function capture() {
  const calls=[];
  return {calls,prisma:{loanApplication:{findMany:async args=>{calls.push(args);return[];}}}};
}
test('findAll scopes CBTD to own loans and leaves stage untouched',async()=>{
  const {calls,prisma:p}=capture();
  await new LoanApplicationsService(p).findAll({id:'cbtd-a',roles:['CBTD'],activeRole:'CBTD'},{});
  assert.equal(calls[0].where.assignedTo,'cbtd-a');
  assert.equal(calls[0].where.currentStage,undefined);
});
test('findAll hides TIEP_NHAN from THAM_QUYEN, including when stage=TIEP_NHAN is requested',async()=>{
  const user={id:'auth',roles:['THAM_QUYEN'],activeRole:'THAM_QUYEN'};
  let c=capture();
  await new LoanApplicationsService(c.prisma).findAll(user,{});
  assert.deepEqual(c.calls[0].where.currentStage,{not:'TIEP_NHAN'});
  assert.equal(c.calls[0].where.assignedTo,undefined);
  c=capture();
  await new LoanApplicationsService(c.prisma).findAll(user,{stage:'TIEP_NHAN'});
  assert.deepEqual(c.calls[0].where.currentStage,{not:'TIEP_NHAN',equals:'TIEP_NHAN'});
  c=capture();
  await new LoanApplicationsService(c.prisma).findAll(user,{stage:'THAM_DINH'});
  assert.deepEqual(c.calls[0].where.currentStage,{not:'TIEP_NHAN',equals:'THAM_DINH'});
});
test('findAll lets QUAN_LY see every stage and every officer',async()=>{
  const {calls,prisma:p}=capture();
  await new LoanApplicationsService(p).findAll({id:'manager',roles:['QUAN_LY'],activeRole:'QUAN_LY'},{});
  assert.equal(calls[0].where.assignedTo,undefined);
  assert.equal(calls[0].where.currentStage,undefined);
});

test('early warnings exclude TIEP_NHAN for THAM_QUYEN only',async()=>{
  const wheres=[];
  const service=new DashboardService({loanApplication:{findMany:async args=>{wheres.push(args.where);return[];}}});
  await service.getEarlyWarningList({activeRole:'THAM_QUYEN'});
  await service.getEarlyWarningList({activeRole:'QUAN_LY'});
  await service.getEarlyWarningList();
  assert.deepEqual(wheres[0].currentStage,{not:'TIEP_NHAN'});
  assert.equal(wheres[1].currentStage,undefined);
  assert.equal(wheres[2].currentStage,undefined);
});

test('portal intake queue is limited to CBTD and QUAN_LY',()=>{
  const rolesGuard=new RolesGuard(new Reflector());
  const ctx=(method,roles)=>({getHandler:()=>PortalIntakesController.prototype[method],getClass:()=>PortalIntakesController,switchToHttp:()=>({getRequest:()=>({user:{roles}})})});
  for(const role of ['CBTD','QUAN_LY']) assert.equal(rolesGuard.canActivate(ctx('list',[role])),true);
  for(const role of ['THAM_QUYEN','ADMIN']) assert.throws(()=>rolesGuard.canActivate(ctx('list',[role])),e=>status(e)===403);
});

test('findAll includes the pending supplement deadline markers for the list badge',async()=>{
  const {calls,prisma:p}=capture();
  await new LoanApplicationsService(p).findAll({id:'cbtd-a',roles:['CBTD'],activeRole:'CBTD'},{});
  const include=calls[0].include.supplementRequests;
  assert.deepEqual(include.where,{status:'PENDING'});
  assert.deepEqual(include.select,{id:true,status:true,requestedAt:true,deadlineAt:true,reminderSentAt:true,overdueAt:true});
});
