const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {assertBranchAmount}=require('../dist/modules/workflow/loan-policy');
const {getPolicyForScope,evaluateIntakeReadiness}=require('../dist/modules/portal/portal.approved-policy');
const {validateReport}=require('../dist/modules/appraisal/appraisal.logic');
test('10 billion is inclusive; invalid amounts cannot bypass the server',()=>{
  assert.doesNotThrow(()=>assertBranchAmount(10000000000));
  for(const n of [10000000001,NaN,Infinity,0,-1])assert.throws(()=>assertBranchAmount(n));
});
test('trade and service have independent policies with their own evidence requirements',()=>{
  const trading=getPolicyForScope('TRADING'),service=getPolicyForScope('SERVICES');
  assert.notEqual(trading.version,service.version);
  assert.ok(trading.requirements.some(r=>r.documentTypeCode==='C_TRADING_PLAN'));
  assert.ok(service.requirements.some(r=>r.documentTypeCode==='C_SERVICE_PLAN'));
  assert.ok(service.requirements.some(r=>r.documentTypeCode==='C_SERVICE_ACCEPTANCE'));
});
test('out of scope data and an over-limit request are not data-ready',()=>{
  const p=getPolicyForScope('TRADING');
  const r=evaluateIntakeReadiness(p,{businessScope:'SERVICES',proposedAmount:10000000001},[],{phase:'SUBMIT',submittedAt:new Date()});
  assert.ok(r.issues.some(i=>i.code==='OUTSIDE_SCOPE'));
  assert.ok(r.issues.some(i=>i.code==='BRANCH_LIMIT'));
});
test('a draft may be incomplete, but a submitted report must contain analysis; no arbitrary fields',()=>{
  assert.doesNotThrow(()=>validateReport({}));
  assert.throws(()=>validateReport({},true));
  assert.throws(()=>validateReport({approved:true}));
});
test('production V2 requires its explicit rollout switch and exposes the supported scopes',()=>{
  const {intakeCycleEnabled}=require('../dist/modules/portal/portal.intake-cycle');
  const {PortalService}=require('../dist/modules/portal/portal.service');
  const keys=['NODE_ENV','PORTAL_V2_ROLLOUT_ENABLED','PORTAL_V2_INTAKE_ENABLED','PORTAL_FOUNDATION_PREVIEW'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    Object.assign(process.env,{NODE_ENV:'production',PORTAL_V2_ROLLOUT_ENABLED:'false',PORTAL_V2_INTAKE_ENABLED:'true',PORTAL_FOUNDATION_PREVIEW:'true'});
    assert.equal(intakeCycleEnabled(),false);
    process.env.PORTAL_V2_ROLLOUT_ENABLED='true';
    const config=new PortalService({}).formConfig();
    assert.equal(config.canSubmit,true);
    assert.deepEqual(config.supportedScopes,['MANUFACTURING','TRADING','SERVICES']);
    assert.deepEqual(config.supportedLoanTypes,['VAY_VON_LUU_DONG']);
    assert.equal(config.branchLimit,10000000000);
    assert.equal(config.submitPolicyVersion,config.approvedIntakePolicy.policy.version);
    assert.ok(!config.approvedIntakePolicy.note.includes('chờ hoàn thiện'));
  }finally{for(const k of keys)saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k];}
});
