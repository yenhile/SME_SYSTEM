const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
require('reflect-metadata');
const {PortalIntakeWorkflow}=require('../dist/modules/portal/portal.intake-workflow');

function fixture(row={}){
  let r={id:'req-1',reference:'DN-99',formVersion:2,status:'ASSIGNED',assignedTo:'officer-1',accountId:'acc-1',revision:3,correctionRequest:null,...row};
  const ops=new Map(),issues=[];
  const tx={
    $queryRaw:async()=>[],
    portalRequest:{findUnique:async()=>({...r}),update:async({data})=>{const next={...r,...data};if(data.revision?.increment)next.revision=r.revision+data.revision.increment;r=next;return{...r};}},
    portalIntakeOperation:{findUnique:async({where})=>ops.get(where.requestId_clientRequestId.clientRequestId)??null,create:async({data})=>{ops.set(data.clientRequestId,data);return data;}},
    portalIntakeIssue:{findFirst:async()=>issues[0]??null},
    assignmentChangeRequest:{findFirst:async()=>null},
  };
  const db={$transaction:fn=>fn(tx)};
  return{flow:new PortalIntakeWorkflow(db,{},async d=>d),row:()=>r,issues};
}
const body=(revision,reason='Mã số thuế thuộc doanh nghiệp khác; vui lòng lập đề nghị mới.')=>({expectedRevision:revision,clientRequestId:randomUUID(),reason});

test('assigned CBTD closes an unaccepted request with a reason the enterprise can read',async()=>{
  const f=fixture();
  const out=await f.flow.closeRequest('req-1',body(3),{id:'officer-1',roles:['CBTD']});
  assert.equal(out.status,'CLOSED');assert.equal(out.closedBy,'officer-1');assert.match(out.closedReason,/lập đề nghị mới/);assert.equal(out.revision,4);
});

test('branch manager may close; other officers, accepted requests and blank reasons are refused',async()=>{
  assert.equal((await fixture({status:'SUBMITTED',assignedTo:null}).flow.closeRequest('req-1',body(3),{id:'mgr',roles:['QUAN_LY']})).status,'CLOSED');
  await assert.rejects(fixture().flow.closeRequest('req-1',body(3),{id:'officer-2',roles:['CBTD']}),e=>e.getStatus()===404);
  await assert.rejects(fixture({status:'ACCEPTED'}).flow.closeRequest('req-1',body(3),{id:'officer-1',roles:['CBTD']}),e=>e.getStatus()===409);
  await assert.rejects(fixture().flow.closeRequest('req-1',body(3,'  '),{id:'officer-1',roles:['CBTD']}),e=>e.getStatus()===400);
  await assert.rejects(fixture().flow.closeRequest('req-1',body(2),{id:'officer-1',roles:['CBTD']}),e=>e.getStatus()===409);
});

test('an open company reconciliation must be resolved before closing',async()=>{
  const f=fixture();f.issues.push({id:'i1'});
  await assert.rejects(f.flow.closeRequest('req-1',body(3),{id:'officer-1',roles:['CBTD']}),e=>e.getStatus()===409);
  assert.equal(f.row().status,'ASSIGNED');
});
