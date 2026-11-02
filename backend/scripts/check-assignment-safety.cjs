/* Package A only. Own random namespace/uploads; never seed/reset public.
 * Raw assignment bodies deliberately bypass assignment-fixtures.cjs. */
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const bcrypt=require('bcryptjs');
const {startIsolated}=require('./check-portal-v2-intake.cjs');
const {runRolloutChecks}=require('./check-sme-rollout.cjs');
async function runAssignmentSafetyChecks(h){
  const {db,base}=h,f=h.rolloutFixture;let checks=0,counter=0;
  const check=(v,m)=>{assert.ok(v,m);checks++;};
  async function call(endpoint,actor={},body,method=body===undefined?'GET':'POST'){
    const headers={};if(actor.token)headers.Authorization=`Bearer ${actor.token}`;if(actor.role)headers['X-Active-Role']=actor.role;
    if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
    const r=await fetch(base+endpoint,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    return{status:r.status,data:await r.json().catch(()=>null)};
  }
  const expect=(r,status,label)=>{check([].concat(status).includes(r.status),`${label}: HTTP ${r.status} ${JSON.stringify(r.data?.message??'')}`);return r.data;};
  async function actor(username,role){const user=await db.user.findUniqueOrThrow({where:{username}});const r=expect(await call('/auth/login',{}, {username,password:f.password}),201,'synthetic login');return{user,role,token:r.accessToken};}
  const manager=await actor(f.managerUsername,'QUAN_LY'),a=await actor(f.officerUsername,'CBTD'),b=await actor(f.otherUsername,'CBTD'),admin=await actor(f.adminUsername,'ADMIN');
  const hash=await bcrypt.hash(f.password,4);
  async function extra(name,role='CBTD'){
    const r=await db.role.findUniqueOrThrow({where:{code:role}});
    const user=await db.user.create({data:{username:`safety_${name}`,email:`safety_${name}@example.test`,fullName:`Synthetic ${name}`,passwordHash:hash,roles:{create:{roleId:r.id}}}});
    return actor(user.username,role);
  }
  const c=await extra('third'),otherManager=await extra('manager','QUAN_LY');
  async function newLoan(){const r=expect(await call('/loan-applications',a,{...h.browserData,taxCode:String(6800000000+(++counter)),companyName:`Synthetic assignment ${counter}`,proposedAmount:100000000}),201,'create own loan');return r.loan;}
  const body=(target,version,reason='Synthetic documented handover')=>({newOfficerId:target,expectedAssignmentVersion:version,clientRequestId:randomUUID(),reason});
  const transfer=(loan,command,who=manager)=>call(`/assignments/${loan.id}/reassign`,who,command);
  let loan=await newLoan(),first=body(b.user.id,0,'  Synthetic handover  ');
  const stageBefore=await db.applicationStageHistory.findMany({where:{applicationId:loan.id}});
  const saved=expect(await transfer(loan,first),201,'first transfer');
  check(saved.loan.assignmentVersion===1&&saved.assignment.reason==='Synthetic handover','owner version and trimmed reason persisted');
  expect(await transfer(loan,body(c.user.id,0)),409,'stale screen cannot replace new owner');
  expect(await transfer(loan,body(a.user.id,1)),201,'return owner to A');
  expect(await transfer(loan,body(c.user.id,0)),409,'A to B to A still detects stale version');
  const historyCount=await db.applicationAssignment.count({where:{applicationId:loan.id}}),predictions=await db.delayPrediction.count({where:{applicationId:loan.id}});
  const replay=expect(await transfer(loan,first),201,'replay exact operation');
  check(replay.replayed&&replay.assignment.id===saved.assignment.id&&replay.loan.assignedTo===a.user.id&&replay.loan.assignmentVersion===2,'replay receipt separates historic operation and current owner');
  check(await db.applicationAssignment.count({where:{applicationId:loan.id}})===historyCount&&await db.delayPrediction.count({where:{applicationId:loan.id}})===predictions,'retry adds no history or ML prediction');
  check(JSON.stringify(await db.applicationStageHistory.findMany({where:{applicationId:loan.id}}))===JSON.stringify(stageBefore),'handover preserves SLA history');
  expect(await transfer(loan,{...first,newOfficerId:c.user.id}),409,'same UUID changed payload');
  expect(await transfer(loan,first,otherManager),409,'same UUID different manager');
  for(const invalid of [{newOfficerId:b.user.id,reason:'x'}, {...body(b.user.id,2),clientRequestId:'wrong'},body(b.user.id,2,'   '),body(b.user.id,2,'x'.repeat(2001))])expect(await transfer(loan,invalid),400,'invalid raw contract blocked');
  expect(await transfer(loan,body(b.user.id,2),a),403,'CBTD cannot transfer');
  expect(await transfer(loan,body(b.user.id,2),admin),403,'admin cannot transfer');
  expect(await transfer(loan,body(manager.user.id,2)),400,'manager cannot assign self');
  const concurrent=await Promise.all([transfer(loan,body(b.user.id,2)),transfer(loan,body(c.user.id,2),otherManager)]);
  check(concurrent.filter(r=>r.status===201).length===1&&concurrent.filter(r=>r.status===409).length===1,'only one concurrent manager wins');
  check((await db.loanApplication.findUniqueOrThrow({where:{id:loan.id}})).assignmentVersion===3&&await db.applicationAssignment.count({where:{applicationId:loan.id}})===3,'concurrent owner/version/history agree');
  await db.loanApplication.update({where:{id:loan.id},data:{currentStage:'HOAN_TAT',currentStatus:'REJECTED',completedAt:new Date()}});
  expect(await transfer(loan,body(b.user.id,3)),400,'terminal loan blocks new transfer');
  check(expect(await transfer(loan,first),201,'historic retry after completion').replayed,'historic retry remains read-only');

  // Pause real transactions at controlled seams, not mocked database results.
  const {AssignmentsService}=require('../dist/modules/assignments/assignments.service');
  const {UsersService}=require('../dist/modules/users/users.service');
  function gate(){let release,reached;return{wait:new Promise(r=>release=r),arrived:new Promise(r=>reached=r),release:()=>release(),hit:()=>reached()};}
  async function paused(service,model,method,match,work){
    const original=service.prisma,g=gate();let used=false;
    service.prisma=new Proxy(original,{get(target,key){if(key!=='$transaction'){const v=target[key];return typeof v==='function'?v.bind(target):v;}return cb=>target.$transaction(tx=>cb(new Proxy(tx,{get(t,k){if(k!==model){const v=t[k];return typeof v==='function'?v.bind(t):v;}return new Proxy(t[k],{get(m,n){if(n!==method)return typeof m[n]==='function'?m[n].bind(m):m[n];return async args=>{if(!used&&match(args)){used=true;g.hit();await g.wait;}return m[n](args);};}});}})));}});
    try{return await work(g);}finally{g.release();service.prisma=original;}
  }
  for(const profile of [{isActive:false},{roles:['THAM_QUYEN']}]){
    const recipient=await extra(`race_${++counter}`),raceLoan=await newLoan(),service=h.app.get(AssignmentsService);
    await paused(service,'user','findUnique',x=>x.where.id===recipient.user.id,async g=>{
      const assigning=transfer(raceLoan,body(recipient.user.id,0));await g.arrived;
      let settled=false;const disabling=call(`/users/${recipient.user.id}`,admin,profile,'PUT').then(r=>{settled=true;return r;});
      await new Promise(r=>setTimeout(r,120));check(!settled,'admin update waits for shared recipient lock');g.release();
      expect(await assigning,201,'locked assignment commits');expect(await disabling,400,'admin cannot disable/remove CBTD with newly assigned work');
    });
    check((await db.loanApplication.findUniqueOrThrow({where:{id:raceLoan.id}})).assignedTo===recipient.user.id&&(await db.user.findUniqueOrThrow({where:{id:recipient.user.id}})).isActive,'recipient remains valid after race');
  }
  const disabled=await extra('disabled_first'),raceLoan=await newLoan();
  await paused(h.app.get(UsersService),'user','update',x=>x.where.id===disabled.user.id,async g=>{
    const disabling=call(`/users/${disabled.user.id}`,admin,{isActive:false},'PUT');await g.arrived;
    let settled=false;const assigning=transfer(raceLoan,body(disabled.user.id,0)).then(r=>{settled=true;return r;});
    await new Promise(r=>setTimeout(r,120));check(!settled,'assignment waits for admin lock');g.release();
    expect(await disabling,200,'admin disables free recipient');expect(await assigning,404,'assignment rechecks recipient after admin commits');
  });
  check(await db.applicationAssignment.count({where:{applicationId:raceLoan.id}})===0,'invalid recipient leaves no transfer history');

  // Legacy Portal requests intentionally lack cycle revision: version catches ABA there too.
  const account=await db.portalAccount.findFirstOrThrow();
  const request=await db.portalRequest.create({data:{accountId:account.id,reference:`SAFE-${randomUUID()}`,status:'SUBMITTED',formVersion:1,data:{},revision:0}});
  const pbody=(target,owner,version,note='Synthetic Portal handover')=>({officerId:target,expectedAssignedTo:owner,expectedAssignmentVersion:version,clientRequestId:randomUUID(),note});
  const assign=command=>call(`/portal-intakes/${request.id}/assign`,manager,command);
  const initial=pbody(a.user.id,null,0);delete initial.note;
  const portalSaved=expect(await assign(initial),201,'initial assignment needs no transfer reason');
  check(portalSaved.assignmentVersion===1,'Portal assignment increments version');
  expect(await assign(pbody(b.user.id,a.user.id,1,'   ')),400,'Portal whitespace transfer reason blocked');
  expect(await assign(pbody(b.user.id,a.user.id,1)),201,'Portal A to B');
  expect(await assign(pbody(a.user.id,b.user.id,2)),201,'Portal B to A');
  expect(await assign(pbody(c.user.id,a.user.id,1)),409,'legacy Portal ABA blocked');
  const notices=await db.internalNotification.count({where:{requestId:request.id}});
  const portalReplay=expect(await assign(initial),201,'Portal retry original operation');
  check(portalReplay.assignmentReceipt.replayed&&portalReplay.assignmentVersion===3&&portalReplay.assignedTo===a.user.id,'Portal replay shows current assignment');
  check(await db.portalAssignment.count({where:{requestId:request.id}})===3&&await db.internalNotification.count({where:{requestId:request.id}})===notices,'Portal retry adds no history/notices');
  await db.portalRequest.update({where:{id:request.id},data:{status:'RETURNED'}});
  const returned=expect(await assign(pbody(b.user.id,a.user.id,3)),201,'transfer returned Portal');check(returned.status==='RETURNED','transfer preserves RETURNED');
  expect(await call(`/portal-intakes/${request.id}`,a),404,'old Portal officer loses access');expect(await call(`/portal-intakes/${request.id}`,b),200,'new Portal officer gains access');
  const uiLoan=await newLoan();
  h.assignmentSafetyFixture={manager,a,b,c,loan:uiLoan,request:returned,call,newLoan};
  return{pass:true,checks,schema:h.schema};
}
async function main(){let h;try{h=await startIsolated({approvedIntake:true,uploadRoot:path.resolve(__dirname,'../../.codex_tmp/rollout-uploads-'+randomUUID())});const baseline=await runRolloutChecks(h);console.log(JSON.stringify({baseline}));console.log(JSON.stringify(await runAssignmentSafetyChecks(h)));}finally{if(h)console.log(JSON.stringify({cleanup:await h.close()}));}}
module.exports={runAssignmentSafetyChecks};
if(require.main===module)main().catch(e=>{console.error('ASSIGNMENT_SAFETY_FAILED:',e.message);process.exitCode=1;});
