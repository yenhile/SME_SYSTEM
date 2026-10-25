const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {Reflector}=require('@nestjs/core');
const {RolesGuard}=require('../dist/common/guards/roles.guard');
const {DashboardController}=require('../dist/modules/dashboard/dashboard.controller');
const {DashboardService}=require('../dist/modules/dashboard/dashboard.service');

test('overdue supplement list reads only flagged pending requests of loans still waiting',async()=>{
  let args;
  const row={id:'s1',applicationId:'loan1',requestedAt:new Date('2026-10-20T03:00:00Z'),deadlineAt:null,overdueAt:new Date('2026-10-30T03:00:00Z'),
    application:{applicationCode:'HS-001',assignedTo:'cbtd',company:{companyName:'ABC'},assignedUser:{fullName:'Nguyen A'}}};
  const service=new DashboardService({supplementRequest:{findMany:async a=>{args=a;return[row];}}});
  const list=await service.getOverdueSupplements(new Date('2026-11-02T03:00:00Z'));
  assert.equal(args.where.status,'PENDING');
  assert.deepEqual(args.where.overdueAt,{not:null});
  assert.equal(args.where.application.currentStatus,'SUPPLEMENT_REQUIRED');
  assert.deepEqual(list,[{id:'s1',applicationId:'loan1',applicationCode:'HS-001',companyName:'ABC',assignedOfficer:'Nguyen A',assignedOfficerId:'cbtd',requestedAt:row.requestedAt,deadlineAt:null,overdueAt:row.overdueAt,daysOverdue:3}]);
});
test('overdue supplement list shows unassigned loans and is ordered oldest overdue first',async()=>{
  let args;
  const service=new DashboardService({supplementRequest:{findMany:async a=>{args=a;return[{id:'s2',applicationId:'l2',requestedAt:new Date(),deadlineAt:null,overdueAt:new Date(),application:{applicationCode:'HS-2',assignedTo:null,company:{companyName:'XYZ'},assignedUser:null}}];}}});
  const list=await service.getOverdueSupplements();
  assert.equal(list[0].assignedOfficer,'Chưa phân công');
  assert.deepEqual(args.orderBy,{overdueAt:'asc'});
});
test('overdue supplement endpoint is limited to QUAN_LY',()=>{
  const guard=new RolesGuard(new Reflector());
  const ctx=roles=>({getHandler:()=>DashboardController.prototype.getOverdueSupplements,getClass:()=>DashboardController,switchToHttp:()=>({getRequest:()=>({user:{roles}})})});
  assert.equal(guard.canActivate(ctx(['QUAN_LY'])),true);
  for(const role of ['THAM_QUYEN','CBTD','ADMIN']) assert.throws(()=>guard.canActivate(ctx([role])),e=>e.getStatus()===403);
});

test('days overdue count from the real due time, not from when the scan marked it',async()=>{
  const row=(over)=>({id:'s',applicationId:'l',requestedAt:new Date('2026-10-20T03:00:00Z'),deadlineAt:null,overdueAt:new Date('2026-11-01T00:00:00Z'),
    application:{applicationCode:'HS',assignedTo:null,company:{companyName:'C'},assignedUser:null},...over});
  const now=new Date('2026-11-05T03:00:00Z');
  const service=rows=>new DashboardService({supplementRequest:{findMany:async()=>rows}});
  assert.equal((await service([row({})]).getOverdueSupplements(now))[0].daysOverdue,6); // due Fri 30/10 03:00Z
  assert.equal((await service([row({deadlineAt:new Date('2026-10-02T17:00:00Z')})]).getOverdueSupplements(now))[0].daysOverdue,33);
});
