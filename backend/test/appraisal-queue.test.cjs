const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {classifyQueueRow}=require('../dist/modules/loan-applications/appraisal-queue');
const {digest,reportEvidence}=require('../dist/modules/appraisal/appraisal.logic');

const POLICY='SME_BRANCH_20261031_V1';
const authority={id:'tq',roles:['THAM_QUYEN'],activeRole:'THAM_QUYEN'};
const manager={id:'m',roles:['QUAN_LY'],activeRole:'QUAN_LY'};
const base={currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL',completedAt:null,createdAt:new Date('2026-11-01T01:00:00Z'),updatedAt:new Date('2026-11-01T01:00:00Z'),assignedTo:'cbtd',intakeOfficerId:'cbtd',businessPolicyVersion:POLICY,companyId:'c',companySnapshot:{companyName:'Công ty A'},proposedAmount:'1',officialAmount:'1',loanPurpose:'p',loanType:'THAU_CHI',loanTermMonths:12,stageHistories:[],supplementRequests:[],coordinationRequests:[]};
const report=(status='SUBMITTED',over={})=>({status,versions:[{evidenceHash:'stale',sequence:1,submittedAt:new Date('2026-11-02T01:00:00Z')}],events:[],...over});
const row=(id,over={})=>({...base,id,appraisalReport:report(),...over});

function harness(rows,{documents=()=>[]}={}) {
  const evidenceCalls=[];
  const prisma={
    $queryRaw:async()=>[],
    company:{findUnique:async()=>({id:'c',companyName:'Công ty A'})},
    document:{findMany:async({where})=>{evidenceCalls.push(where.applicationId);return documents(where.applicationId)}},
    supplementRequest:{findMany:async()=>[]},
    loanApplication:{findMany:async args=>{
      const ids=args.where?.id?.in;
      if(ids) return rows.filter(r=>ids.includes(r.id)).map(r=>({...r,company:{companyName:r.id},delayPredictions:[],portalRequest:null,_count:{documents:0}}));
      return rows;
    }},
    applicationStageHistory:{findMany:async()=>[]},
  };
  return {prisma,evidenceCalls,service:new LoanApplicationsService(prisma)};
}
const freshHash=async(prisma,loan)=>digest(await reportEvidence(prisma,loan));

test('a submitted report with unchanged evidence waits for the decision',()=>{
  assert.deepEqual(classifyQueueRow(row('a'),false,authority),{group:'DECIDE',reason:'SUBMITTED'});
});

test('a legacy loan has no report but can be decided, so it waits for the decision',()=>{
  assert.deepEqual(classifyQueueRow(row('a',{businessPolicyVersion:null,appraisalReport:null}),false,authority),{group:'DECIDE',reason:'LEGACY'});
});

test('clarification, changed evidence, a missing report and an open conflict of interest cannot be decided yet',()=>{
  assert.deepEqual(classifyQueueRow(row('a',{appraisalReport:report('CLARIFICATION_REQUIRED')}),false,authority),{group:'CBTD',reason:'CLARIFICATION'});
  assert.deepEqual(classifyQueueRow(row('a'),true,authority),{group:'CBTD',reason:'EVIDENCE_CHANGED'});
  assert.deepEqual(classifyQueueRow(row('a',{appraisalReport:null}),false,authority),{group:'CBTD',reason:'NO_REPORT'});
  assert.deepEqual(classifyQueueRow(row('a',{coordinationRequests:[{id:'r'}]}),false,authority),{group:'CBTD',reason:'CONFLICT'});
});

test('a loan waiting for a supplement belongs to the enterprise whatever its report says',()=>{
  assert.deepEqual(classifyQueueRow(row('a',{currentStatus:'SUPPLEMENT_REQUIRED'}),false,authority),{group:'ENTERPRISE',reason:'SUPPLEMENT'});
  assert.deepEqual(classifyQueueRow(row('a',{supplementRequests:[{id:'s'}]}),true,authority),{group:'ENTERPRISE',reason:'SUPPLEMENT'});
  assert.deepEqual(classifyQueueRow(row('a',{currentStatus:'SUPPLEMENT_REQUIRED',assignedTo:'tq'}),false,authority),{group:'ENTERPRISE',reason:'SUPPLEMENT'});
});

test('an authority who handled, received or wrote the loan leaves it to another authority',()=>{
  const other={group:'OTHER_REVIEWER',reason:'NOT_INDEPENDENT'};
  assert.deepEqual(classifyQueueRow(row('a',{assignedTo:'tq'}),false,authority),other);
  assert.deepEqual(classifyQueueRow(row('a',{intakeOfficerId:'tq'}),false,authority),other);
  assert.deepEqual(classifyQueueRow(row('a',{appraisalReport:report('SUBMITTED',{events:[{id:'e'}]})}),false,authority),other);
  assert.deepEqual(classifyQueueRow(row('a',{businessPolicyVersion:null,appraisalReport:null,assignedTo:'tq'}),false,authority),other);
});

test('a manager watches the queue without being judged on independence',()=>{
  assert.deepEqual(classifyQueueRow(row('a',{assignedTo:'m'}),false,manager),{group:'DECIDE',reason:'SUBMITTED'});
});

test('the queue returns one group, counts every group and places each loan in exactly one',async()=>{
  const rows=[row('legacy',{businessPolicyVersion:null,appraisalReport:null}),row('clarify',{appraisalReport:report('CLARIFICATION_REQUIRED')}),row('supplement',{currentStatus:'SUPPLEMENT_REQUIRED'}),row('mine',{assignedTo:'tq'}),row('none',{appraisalReport:null})];
  const {service}=harness(rows);
  const seen=[];
  for(const queue of ['DECIDE','CBTD','ENTERPRISE','OTHER_REVIEWER']){
    const result=await service.findAll(authority,{page:'1',queue});
    assert.deepEqual(result.groupCounts,{DECIDE:1,CBTD:2,ENTERPRISE:1,OTHER_REVIEWER:1});
    assert.equal(result.total,result.groupCounts[queue]);
    seen.push(...result.items.map(item=>item.id));
  }
  assert.deepEqual([...seen].sort(),rows.map(r=>r.id).sort());
});

test('the queue only looks at open loans at Thẩm định, whatever the request asks',async()=>{
  const {prisma,service}=harness([]);
  const calls=[];
  const original=prisma.loanApplication.findMany;
  prisma.loanApplication.findMany=args=>{calls.push(args);return original(args)};
  await service.findAll(authority,{page:'1',queue:'DECIDE',stage:'HOAN_TAT',status:'APPROVED'});
  assert.equal(calls[0].where.currentStage.equals,'THAM_DINH');
  assert.equal(calls[0].where.currentStatus,undefined);
  assert.equal(calls[0].where.completedAt,null);
});

test('a real evidence change moves the loan out of the decision tab',async()=>{
  const {prisma}=harness([]);
  const loan=row('fresh');
  const hash=await freshHash(prisma,loan);
  const fresh=row('fresh',{appraisalReport:report('SUBMITTED',{versions:[{evidenceHash:hash,sequence:1,submittedAt:new Date()}]})});
  const changed=row('changed',{appraisalReport:report('SUBMITTED',{versions:[{evidenceHash:'other',sequence:1,submittedAt:new Date()}]})});
  const {service}=harness([fresh,changed]);
  const decide=await service.findAll(authority,{page:'1',queue:'DECIDE'});
  assert.deepEqual(decide.items.map(item=>item.id),['fresh']);
  assert.equal(decide.items[0].queueReason,'SUBMITTED');
  const cbtd=await service.findAll(authority,{page:'1',queue:'CBTD'});
  assert.deepEqual(cbtd.items.map(item=>item.id),['changed']);
  assert.equal(cbtd.items[0].queueReason,'EVIDENCE_CHANGED');
});

test('an unreadable evidence file also counts as changed',async()=>{
  const {prisma}=harness([]);
  const hash=await freshHash(prisma,row('x'));
  const {service}=harness([row('x',{appraisalReport:report('SUBMITTED',{versions:[{evidenceHash:hash,sequence:1,submittedAt:new Date()}]})})],{documents:()=>[{id:'d',filePath:'missing-file.pdf',fileSize:1}]});
  const result=await service.findAll(authority,{page:'1',queue:'DECIDE'});
  assert.equal(result.groupCounts.DECIDE,0);
  assert.equal(result.groupCounts.CBTD,1);
});

test('evidence is read only for loans that could otherwise be decided',async()=>{
  const rows=[row('check'),row('legacy',{businessPolicyVersion:null,appraisalReport:null}),row('clarify',{appraisalReport:report('CLARIFICATION_REQUIRED')}),row('supplement',{currentStatus:'SUPPLEMENT_REQUIRED'}),row('conflict',{coordinationRequests:[{id:'r'}]}),row('mine',{assignedTo:'tq'})];
  const {service,evidenceCalls}=harness(rows);
  await service.findAll(authority,{page:'1',queue:'DECIDE'});
  assert.deepEqual(evidenceCalls,['check']);
});

test('each queue row shows the submitted report version',async()=>{
  const {service}=harness([row('legacy',{businessPolicyVersion:null,appraisalReport:null}),row('clarify',{appraisalReport:report('CLARIFICATION_REQUIRED')})]);
  const cbtd=await service.findAll(authority,{page:'1',queue:'CBTD'});
  assert.equal(cbtd.items[0].reportVersion.sequence,1);
  const decide=await service.findAll(authority,{page:'1',queue:'DECIDE'});
  assert.equal(decide.items[0].reportVersion,null);
});

test('the queue is for the authority and the manager only, and rejects unknown values',async()=>{
  const {service}=harness([]);
  await assert.rejects(service.findAll({id:'c',roles:['CBTD'],activeRole:'CBTD'},{page:'1',queue:'DECIDE'}),e=>e.getStatus()===403);
  await assert.rejects(service.findAll(authority,{page:'1',queue:'KHAC'}),e=>e.getStatus()===400);
  await assert.rejects(service.findAll(authority,{page:'1',sort:'KHAC'}),e=>e.getStatus()===400);
});

test('the lookup list can be ordered by the latest update',async()=>{
  const at=text=>new Date(text);
  const rows=[row('old',{updatedAt:at('2026-10-01T00:00:00Z')}),row('new',{updatedAt:at('2026-11-04T00:00:00Z')}),row('mid',{updatedAt:at('2026-10-20T00:00:00Z')})];
  const {service}=harness(rows);
  const sorted=await service.findAll(authority,{page:'1',sort:'updated'});
  assert.deepEqual(sorted.items.map(item=>item.id),['new','mid','old']);
  assert.equal(sorted.groupCounts,undefined);
});
