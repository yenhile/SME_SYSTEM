const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {compareLoanQueue}=require('../dist/modules/loan-applications/loan-queue');

const vn=text=>new Date(`${text}+07:00`);
const CALENDAR='VN-20260101-20261231-v1';
const openStage=(enteredAt,over={})=>({enteredAt,exitedAt:null,pausedAt:null,pausedDurationHours:0,slaStandardHours:40,slaPolicy:'PA1',slaCalendarVersion:CALENDAR,pauses:[],...over});
const fullRow=row=>({...row,company:{companyName:row.id},companySnapshot:null,delayPredictions:[],supplementRequests:[],appraisalReport:null,portalRequest:null,_count:{documents:2}});

function harness(rows) {
  const calls=[];
  const prisma={
    loanApplication:{findMany:async args=>{
      calls.push(args);
      const ids=args.where?.id?.in;
      return (ids?rows.filter(row=>ids.includes(row.id)):rows).map(fullRow);
    }},
    applicationStageHistory:{findMany:async()=>[]},
  };
  return {calls,service:new LoanApplicationsService(prisma)};
}
const manager={id:'m',roles:['QUAN_LY'],activeRole:'QUAN_LY'};
const rows=[
  {id:'closed-old',currentStage:'HOAN_TAT',completedAt:vn('2026-09-03T16:00:00'),createdAt:vn('2026-09-01T08:00:00'),stageHistories:[]},
  {id:'closed-new',currentStage:'HOAN_TAT',completedAt:vn('2026-11-04T09:00:00'),createdAt:vn('2026-10-01T08:00:00'),stageHistories:[]},
  {id:'none',currentStage:'THAM_DINH',completedAt:null,createdAt:vn('2026-09-15T08:00:00'),stageHistories:[]},
  {id:'later',currentStage:'THAM_DINH',completedAt:null,createdAt:vn('2026-11-05T08:00:00'),stageHistories:[openStage(new Date())]},
  {id:'paused',currentStage:'THAM_DINH',completedAt:null,createdAt:vn('2026-11-02T08:00:00'),stageHistories:[openStage(vn('2026-11-02T08:00:00'),{pauses:[{startedAt:vn('2026-11-02T09:00:00'),endedAt:null}]})]},
  {id:'late',currentStage:'THAM_DINH',completedAt:null,createdAt:vn('2026-10-20T08:00:00'),stageHistories:[openStage(vn('2026-10-20T08:00:00'))]},
];

test('a list request without a page keeps returning a plain array for existing callers',async()=>{
  const {service}=harness(rows);
  const result=await service.findAll(manager,{});
  assert.ok(Array.isArray(result));
  assert.equal(result.length,rows.length);
});

test('a page is ordered overdue first, then nearest deadline, paused, no data, and finished last',async()=>{
  const {service}=harness(rows);
  const result=await service.findAll(manager,{page:'1',pageSize:'20'});
  assert.deepEqual(result.items.map(row=>row.id),['late','later','paused','none','closed-new','closed-old']);
  assert.equal(result.total,6);assert.equal(result.page,1);assert.equal(result.pageSize,20);
});

test('the order spans pages and full rows are loaded only for the page shown',async()=>{
  const {service,calls}=harness(rows);
  const second=await service.findAll(manager,{page:'2',pageSize:'4'});
  assert.deepEqual(second.items.map(row=>row.id),['closed-new','closed-old']);
  assert.equal(second.total,6);
  assert.equal(calls.length,2,'one query to rank and one to load the page');
  assert.deepEqual(calls[1].where.id.in,['closed-new','closed-old']);
});

test('each row carries the file count and where the loan came from',async()=>{
  const portalRows=[{...rows[3]}];
  const prisma={
    loanApplication:{findMany:async args=>args.where?.id?.in?[{...fullRow(portalRows[0]),portalRequest:{id:'p'},_count:{documents:5}}]:portalRows},
    applicationStageHistory:{findMany:async()=>[]},
  };
  const {items}=await new LoanApplicationsService(prisma).findAll(manager,{page:'1'});
  assert.equal(items[0].documentCount,5);
  assert.equal(items[0].source,'PORTAL');
  assert.equal('_count' in items[0],false);
  assert.equal(items[0].portalRequest,undefined);
});

test('overdue only keeps the late loans and counts only them',async()=>{
  const {service}=harness(rows);
  const result=await service.findAll(manager,{page:'1',overdueOnly:'true'});
  assert.deepEqual(result.items.map(row=>row.id),['late']);
  assert.equal(result.total,1);
});

test('an empty page does not run the second query',async()=>{
  const {service,calls}=harness([]);
  const result=await service.findAll(manager,{page:'1'});
  assert.deepEqual(result.items,[]);assert.equal(result.total,0);
  assert.equal(calls.length,1);
});

test('the new filters reach the query',async()=>{
  const {service,calls}=harness([]);
  await service.findAll(manager,{page:'1',code:'SME-1',company:'An Phú',loanType:'THAU_CHI',officer:'Lan'});
  const where=calls[0].where;
  assert.deepEqual(where.applicationCode,{contains:'SME-1',mode:'insensitive'});
  assert.equal(where.loanType,'THAU_CHI');
  assert.equal(where.AND.length,2);
  assert.match(JSON.stringify(where.AND[0]),/An Phú/);
  assert.match(JSON.stringify(where.AND[1]),/Lan/);
});

test('the list cannot be filtered by created date',async()=>{
  const {service,calls}=harness([]);
  await service.findAll(manager,{page:'1',createdFrom:'05/11/2026',createdTo:'2026-13-45'});
  assert.equal(calls[0].where.createdAt,undefined);
});

test('an officer who only holds CBTD still sees only their loans, whatever the filter says',async()=>{
  const {service,calls}=harness([]);
  await service.findAll({id:'cbtd',roles:['CBTD'],activeRole:'CBTD'},{page:'1',officer:'Người khác'});
  assert.equal(calls[0].where.assignedTo,'cbtd');
});

test('the authority still cannot reach loans at Tiếp nhận through the page',async()=>{
  const {service,calls}=harness([]);
  await service.findAll({id:'tq',roles:['THAM_QUYEN'],activeRole:'THAM_QUYEN'},{page:'1'});
  assert.deepEqual(calls[0].where.currentStage,{not:'TIEP_NHAN'});
});

test('invalid paging and filter values are refused',async()=>{
  const {service}=harness([]);
  for(const query of [{page:'0'},{page:'abc'},{page:'1',pageSize:'101'},{page:'1',pageSize:'0'},{page:'1',loanType:'KHAC'}]){
    await assert.rejects(service.findAll(manager,query),e=>e.getStatus()===400,JSON.stringify(query));
  }
});

test('compareLoanQueue keeps equal deadlines stable by the newest loan first',()=>{
  const row=(createdAt)=>({currentStage:'THAM_DINH',completedAt:null,createdAt:new Date(createdAt),sla:{isOverdue:false,dueAt:new Date('2026-12-01T03:00:00Z'),waitingEnterprise:false}});
  assert.ok(compareLoanQueue(row('2026-11-02'),row('2026-11-01'))<0);
});

test('the officer list can be split into loans still in progress and loans already finished',async()=>{
  const officer={id:'cbtd',roles:['CBTD'],activeRole:'CBTD'};
  const {calls,service}=harness(rows);
  await service.findAll(officer,{lifecycle:'active'});
  assert.deepEqual(calls.at(-1).where.AND,[{completedAt:null,currentStage:{not:'HOAN_TAT'}}]);
  assert.equal(calls.at(-1).where.assignedTo,'cbtd');
  await service.findAll(officer,{lifecycle:'finished'});
  assert.deepEqual(calls.at(-1).where.AND,[{OR:[{completedAt:{not:null}},{currentStage:'HOAN_TAT'}]}]);
  await service.findAll(officer,{});
  assert.equal(calls.at(-1).where.AND,undefined);
  await assert.rejects(service.findAll(officer,{lifecycle:'all'}),error=>error.getStatus()===400);
});
