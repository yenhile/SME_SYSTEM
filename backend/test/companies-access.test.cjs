const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {CompaniesService}=require('../dist/modules/companies/companies.service');
const {CompaniesController}=require('../dist/modules/companies/companies.controller');

const cbtd={id:'cbtd-a',activeRole:'CBTD',roles:['CBTD']};
const manager={id:'manager',activeRole:'QUAN_LY',roles:['QUAN_LY']};
const authority={id:'auth',activeRole:'THAM_QUYEN',roles:['THAM_QUYEN']};

function listFixture() {
  const calls=[];
  return {calls,service:new CompaniesService({company:{findMany:async args=>{calls.push(args);return[];}}})};
}
test('CBTD only lists companies that have a loan assigned to them',async()=>{
  const {calls,service}=listFixture();
  await service.findAll(cbtd);
  assert.deepEqual(calls[0].where,{AND:[{loans:{some:{assignedTo:'cbtd-a'}}}]});
});
test('the keyword filter is combined with, not replaced by, the ownership filter',async()=>{
  const {calls,service}=listFixture();
  await service.findAll(cbtd,'abc');
  const and=calls[0].where.AND;
  assert.equal(and.length,2);
  assert.deepEqual(and[0],{loans:{some:{assignedTo:'cbtd-a'}}});
  assert.ok(and[1].OR.some(item=>item.companyName)&&and[1].OR.some(item=>item.taxCode));
});
test('manager and authority keep the branch-wide company list',async()=>{
  for(const user of [manager,authority]) {
    const {calls,service}=listFixture();
    await service.findAll(user);
    assert.equal(calls[0].where,undefined);
    await service.findAll(user,'abc');
    assert.ok(calls[1].where.AND.length===1&&calls[1].where.AND[0].OR);
  }
});

const company={id:'c1',taxCode:'0101',companyName:'ABC',industry:'Dệt',establishedYear:2000,annualRevenue:5,charterCapital:9,representativeName:'Nguyen',phone:'090',address:'HN',loans:[]};
function checkFixture(row) {
  const calls=[];
  return {calls,service:new CompaniesService({company:{findUnique:async args=>{calls.push(args);return row;}}})};
}
test('CBTD sees company details and only their own loans for a company they handle',async()=>{
  const {calls,service}=checkFixture({...company,loans:[{id:'l1',applicationCode:'HS-1'}]});
  const result=await service.checkTaxCode('0101',cbtd);
  assert.equal(result.found,true);assert.equal(result.restricted,undefined);
  assert.equal(result.company.companyName,'ABC');
  assert.deepEqual(calls[0].include.loans.where,{assignedTo:'cbtd-a'});
  assert.equal(calls[0].include.loans.take,3);
});
test('CBTD learns only that a company exists when it has no loan of theirs, with no details or loans',async()=>{
  const {service}=checkFixture({...company,loans:[]});
  const result=await service.checkTaxCode('0101',cbtd);
  assert.deepEqual(result,{found:true,restricted:true,company:null});
  assert.ok(!JSON.stringify(result).includes('ABC'));
});
test('an unknown tax code is still reported as not found for CBTD',async()=>{
  const {service}=checkFixture(null);
  assert.deepEqual(await service.checkTaxCode('999',cbtd),{found:false,company:null});
});
test('manager and authority keep the full lookup with recent loans of any officer',async()=>{
  for(const user of [manager,authority]) {
    const {calls,service}=checkFixture({...company,loans:[{id:'l9'}]});
    const result=await service.checkTaxCode('0101',user);
    assert.equal(result.found,true);assert.equal(result.restricted,undefined);assert.equal(result.company.loans.length,1);
    assert.equal(calls[0].include.loans.where,undefined);
  }
});
test('the controller passes the signed-in user to the service',async()=>{
  const seen=[];
  const controller=new CompaniesController({findAll:async(...a)=>{seen.push(['list',...a]);return[];},checkTaxCode:async(...a)=>{seen.push(['check',...a]);return{};}});
  await controller.findAll(cbtd,'kw');await controller.checkTaxCode('0101',cbtd);
  assert.deepEqual(seen,[['list',cbtd,'kw'],['check','0101',cbtd]]);
});

// ---- Ghi dữ liệu doanh nghiệp: ai làm người nấy ----
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const loanDto={taxCode:'0101',companyName:'New name',industry:'x',establishedYear:2000,annualRevenue:1,charterCapital:1,representativeName:'r',phone:'1',address:'a',loanPurpose:'p',loanType:'VAY_VON_LUU_DONG',proposedAmount:10000000,loanTermMonths:12};
function createFixture(existing) {
  const state={upserts:[]};
  const tx={company:{findUnique:async()=>existing,upsert:async args=>{state.upserts.push(args);return{id:'c1'};}},workflowStage:{findUnique:async()=>null}};
  return {state,service:new LoanApplicationsService({$transaction:async fn=>fn(tx)})};
}
const owned={id:'c1',loans:[{id:'l1'}]};
const foreign={id:'c1',loans:[]};
test('creating a loan for a new company or one the officer already handles is allowed to reach the upsert',async()=>{
  for(const existing of [null,owned]) {
    const {state,service}=createFixture(existing);
    await assert.rejects(service.create(loanDto,'cbtd-a'),e=>e.getStatus()===400); // stops later at the missing stage config
    assert.equal(state.upserts.length,1);
  }
});
test('creating a loan for a company that belongs to another officer is refused and never overwrites it',async()=>{
  const {state,service}=createFixture(foreign);
  await assert.rejects(service.create(loanDto,'cbtd-a'),e=>e.getStatus()===403&&/cán bộ khác/.test(e.message));
  assert.equal(state.upserts.length,0);
});
test('the ownership check only looks at the creating officer loans',async()=>{
  let query;
  const tx={company:{findUnique:async q=>{query=q;return foreign;},upsert:async()=>({})},workflowStage:{findUnique:async()=>null}};
  await assert.rejects(new LoanApplicationsService({$transaction:async fn=>fn(tx)}).create(loanDto,'cbtd-a'));
  assert.deepEqual(query.where,{taxCode:'0101'});
  assert.deepEqual(query.select.loans.where,{assignedTo:'cbtd-a'});
});
test('POST /companies follows the same rule: own or new company only',async()=>{
  const body={taxCode:'0101',companyName:'N',industry:'x',establishedYear:2000,annualRevenue:1,charterCapital:1,representativeName:'r',phone:'1',address:'a'};
  for(const [existing,allowed] of [[null,true],[owned,true],[foreign,false]]) {
    const upserts=[];
    const service=new CompaniesService({company:{findUnique:async()=>existing,upsert:async a=>{upserts.push(a);return{id:'c1'};}}});
    if(allowed) {await service.upsert(body,cbtd);assert.equal(upserts.length,1);}
    else {await assert.rejects(service.upsert(body,cbtd),e=>e.getStatus()===403);assert.equal(upserts.length,0);}
  }
});
test('the controller passes the user to company upsert',async()=>{
  let seen;
  const controller=new CompaniesController({upsert:async(...a)=>{seen=a;return{};}});
  await controller.upsert({taxCode:'1'},cbtd);
  assert.deepEqual(seen,[{taxCode:'1'},cbtd]);
});
