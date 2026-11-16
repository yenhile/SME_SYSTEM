const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalService}=require('../dist/modules/portal/portal.service');
const {PortalMailer}=require('../dist/modules/portal/portal.mailer');

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function service(mailer,returnItems=[{message:'Mã số thuế trùng doanh nghiệp khác.'}]){
  const s=Object.create(PortalService.prototype);
  s.prisma={portalSubmission:{findFirst:async()=>({returnItems})}};s.mailer=mailer;s.logger={warn:()=>{}};
  return s;
}

test('returning or closing a request emails the enterprise with the bank message after the decision',async()=>{
  const sent=[];const mailer={sendIntakeNotice:async(...args)=>{sent.push(args);}};
  const s=service(mailer);
  s.cycle=()=>({returnForCorrection:async()=>({id:'r',reference:'DN-1',status:'RETURNED',account:{email:'dn@example.test'}}),closeRequest:async()=>({id:'r',reference:'DN-2',status:'CLOSED',closedReason:'Sai chủ thể',account:{email:'dn@example.test'}})});
  assert.equal((await s.returnIntake('r',{},{id:'o',roles:['CBTD']})).status,'RETURNED');
  assert.equal((await s.closeIntake('r',{},{id:'o',roles:['CBTD']})).status,'CLOSED');
  await settle();await settle();
  assert.deepEqual(sent,[['dn@example.test','DN-1','RETURNED',['Mã số thuế trùng doanh nghiệp khác.']],['dn@example.test','DN-2','CLOSED',['Sai chủ thể']]]);
});

test('a mail failure never undoes the decision',async()=>{
  const s=service({sendIntakeNotice:async()=>{throw new Error('Brevo down');}});
  s.cycle=()=>({closeRequest:async()=>({id:'r',reference:'DN-2',status:'CLOSED',closedReason:'x',account:{email:'dn@example.test'}})});
  assert.equal((await s.closeIntake('r',{},{id:'o',roles:['QUAN_LY']})).status,'CLOSED');await settle();
});

test('notice email escapes the bank message and names the request',async()=>{
  const mailer=new PortalMailer();let mail;mailer.deliver=async m=>{mail=m;};
  await mailer.sendIntakeNotice('dn@example.test','DN-7','RETURNED',['<b>MST</b> sai']);
  assert.match(mail.subject,/DN-7 cần chỉnh sửa/);assert.match(mail.html,/&lt;b&gt;MST&lt;\/b&gt; sai/);assert.match(mail.text,/- <b>MST<\/b> sai/);
});
