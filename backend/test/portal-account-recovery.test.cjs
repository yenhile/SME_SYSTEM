const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const bcrypt=require('bcryptjs');
require('reflect-metadata');
const {PortalAuthService,PortalGuard}=require('../dist/modules/portal/portal.auth');
const {JwtService}=require('@nestjs/jwt');

async function fixture(overrides={}) {
  let row={id:'portal-test',email:'recovery@example.test',contactName:'Synthetic',phone:'0901234567',verifiedAt:new Date(),passwordHash:await bcrypt.hash('OldPassword1',4),authVersion:0,...overrides};
  const sent=[];let failMail=false;
  const account={findUnique:async({where})=>Object.entries(where).every(([k,v])=>row[k]===v)?{...row}:null,findUniqueOrThrow:async()=>({...row}),update:async({data})=>{for(const [k,v] of Object.entries(data))row[k]=v&&typeof v==='object'&&'increment'in v?(row[k]??0)+v.increment:v;return{...row};}};
  let chain=Promise.resolve();
  const db={portalAccount:account,$transaction:fn=>{const result=chain.then(async()=>{const before={...row};try{return await fn({portalAccount:account,$queryRaw:async()=>[]});}catch(e){row=before;throw e;}});chain=result.catch(()=>{});return result;}};
  const jwt=new JwtService(),auth=new PortalAuthService(db,jwt,{sendCode:async()=>{if(failMail)throw Error('SMTP');},sendPasswordReset:async(email,link)=>{if(failMail)throw Error('SMTP');sent.push({email,link});}});
  return{auth,jwt,db,sent,row:()=>row,fail:()=>{failMail=true;}};
}
test('forgot password is neutral, token is hashed, cooldown does not rotate it',async()=>{
  const f=await fixture();const known=await f.auth.forgotPassword({email:f.row().email},'a');await f.auth.onModuleDestroy();
  assert.equal(f.sent.length,1);const token=new URL(f.sent[0].link).searchParams.get('reset');assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(f.row().passwordResetHash,createHash('sha256').update(token).digest('hex'));assert.ok(f.row().passwordResetExpiresAt>Date.now());
  assert.deepEqual(await f.auth.forgotPassword({email:'missing@example.test'},'b'),known);await f.auth.onModuleDestroy();
  await f.auth.forgotPassword({email:f.row().email},'c');await f.auth.onModuleDestroy();assert.equal(f.sent.length,1);
});
test('reset is single-use, rejects mismatched/expired token and revokes portal sessions',async()=>{
  const f=await fixture();const login=await f.auth.login({email:f.row().email,password:'OldPassword1'},'login');
  const guard=new PortalGuard(f.jwt,f.auth);const context=()=>({switchToHttp:()=>({getRequest:()=>({headers:{authorization:`Bearer ${login.accessToken}`}})})});
  assert.equal(await guard.canActivate(context()),true);
  await f.auth.forgotPassword({email:f.row().email},'a');await f.auth.onModuleDestroy();const token=new URL(f.sent[0].link).searchParams.get('reset');
  await assert.rejects(f.auth.resetPassword({token,password:'NewPassword2',confirmPassword:'other'},'a'));
  const outcomes=await Promise.allSettled([1,2].map(()=>f.auth.resetPassword({token,password:'NewPassword2',confirmPassword:'NewPassword2'},'a')));
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(f.row().authVersion,1);assert.equal(f.row().passwordResetHash,null);
  await assert.rejects(guard.canActivate(context()));await assert.rejects(f.auth.login({email:f.row().email,password:'OldPassword1'},'login'));
  const newLogin=await f.auth.login({email:f.row().email,password:'NewPassword2'},'login');assert.ok(newLogin.accessToken);
  const expired=await fixture({passwordResetHash:createHash('sha256').update('a'.repeat(64)).digest('hex'),passwordResetExpiresAt:new Date(0)});
  await assert.rejects(expired.auth.resetPassword({token:'a'.repeat(64),password:'NewPassword2',confirmPassword:'NewPassword2'},'a'));
});
test('pending account is not verified by password recovery; SMTP failure rolls back token',async()=>{
  const pending=await fixture({verifiedAt:null});await pending.auth.forgotPassword({email:pending.row().email},'a');await pending.auth.onModuleDestroy();assert.equal(pending.sent.length,0);assert.equal(pending.row().verifiedAt,null);
  const f=await fixture();f.fail();await f.auth.forgotPassword({email:f.row().email},'a');await f.auth.onModuleDestroy();assert.equal(f.row().passwordResetHash,undefined);
  await f.auth.issueCode(f.row().id); // verified accounts intentionally skip OTP
  const otp=await fixture({verifiedAt:null});otp.fail();await assert.rejects(otp.auth.issueCode(otp.row().id),e=>e.getResponse?.().code==='PORTAL_VERIFICATION_DELIVERY_FAILED');assert.equal(otp.row().verificationHash,undefined);
});
test('forgot password rate limits unknown and known email equally',async()=>{
  const f=await fixture();for(let i=0;i<5;i++)await f.auth.forgotPassword({email:'unknown@example.test'},String(i));
  await assert.rejects(f.auth.forgotPassword({email:'unknown@example.test'},'new'),e=>e.getStatus?.()===429);await f.auth.onModuleDestroy();
});

test('legacy portal JWT is accepted only at account version zero; malformed versions are blocked',async()=>{
  const f=await fixture(),guard=new PortalGuard(f.jwt,f.auth),{portalSecret}=require('../dist/modules/portal/portal.validation');
  const sign=av=>f.jwt.signAsync({sub:f.row().id,type:'portal',...(av===undefined?{}:{av})},{secret:portalSecret(),audience:'sme-enterprise-portal',issuer:'sme-enterprise-portal',expiresIn:'1h'});
  const context=token=>({switchToHttp:()=>({getRequest:()=>({headers:{authorization:'Bearer '+token}})})});
  const legacy=await sign();assert.equal(await guard.canActivate(context(legacy)),true);
  for(const av of [-1,'0',null,0.5])await assert.rejects(guard.canActivate(context(await sign(av))));
  await f.db.portalAccount.update({data:{authVersion:{increment:1}}});await assert.rejects(guard.canActivate(context(legacy)));
});
