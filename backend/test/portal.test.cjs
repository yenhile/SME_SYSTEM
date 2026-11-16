const { test } = require('node:test');
const assert = require('node:assert/strict');
const {crc32}=require('node:zlib');
require('reflect-metadata');
const { validatePortalData, validatePortalFile, portalSecret } = require('../dist/modules/portal/portal.validation');
const valid = {taxCode:'0123456789',companyName:'Demo',industry:'Manufacturing',establishedYear:2020,annualRevenue:1,charterCapital:1,representativeName:'Demo',phone:'0901234567',address:'Demo',loanPurpose:'Working capital',loanType:'VAY_VON_LUU_DONG',proposedAmount:8000000000,loanTermMonths:12};
test('submission validates real loan fields without hardcoding amount', () => {
  assert.deepEqual(validatePortalData(valid, true), valid);
  for (const data of [{...valid,assignedTo:'attacker'}, {...valid,taxCode:'abc'}, {...valid,loanTermMonths:121}, {...valid,proposedAmount:9999999}, {...valid,annualRevenue:-1}, {...valid,annualRevenue:1e16}]) assert.throws(() => validatePortalData(data,true));
  assert.throws(() => validatePortalData({},true));
  assert.deepEqual(validatePortalData({},false),{});
});
test('rejects file extension tricks, spoofed PDFs and group mismatch', async () => {
  const file = name => ({originalname:name,buffer:Buffer.from('%PDF-1.7 fake'),size:13,mimetype:'application/pdf'});
  for (const [group,name] of [['A','x.pdf'],['A','x.xlsx'],['Z','x.pdf'],['A','x.pdf.exe'],['F','x.png']]) await assert.rejects(validatePortalFile(group,file(name)));
});
test('portal signing key is isolated from the staff token key', () => {
  assert.notEqual(portalSecret(),process.env.JWT_SECRET || 'sme_loan_workflow_secret_key_2026');
});

function zip(entries, corrupt=false) {
  const parts=[],central=[];let offset=0;
  for(const [name,xml] of Object.entries(entries)) {
    const filename=Buffer.from(name),data=Buffer.from(xml),crc=corrupt?0:crc32(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
    const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(filename.length,28);cd.writeUInt32LE(offset,42);
    parts.push(header,filename,data);central.push(cd,filename);offset+=header.length+filename.length+data.length;
  }
  const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,c,end]);
}
test('rejects a ZIP with spoofed workbook XML and invalid CRC', async()=> {
  const buffer=zip({'[Content_Types].xml':'<Types/>','xl/workbook.xml':'<workbook/>'},true);
  await assert.rejects(validatePortalFile('B',{buffer,size:buffer.length,originalname:'x.xlsx',mimetype:'application/octet-stream'}));
});
test('accepts a valid XLSX package, rejects malformed XML and missing sheet references', async()=> {
  const entries={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>'
  };
  const file=e=>{const buffer=zip(e);return{buffer,size:buffer.length,originalname:'finance.xlsx',mimetype:'application/octet-stream'};};
  await validatePortalFile('B',file(entries));
  await assert.rejects(validatePortalFile('B',file({...entries,'xl/worksheets/sheet1.xml':'<worksheet><bad></worksheet>'})));
  await assert.rejects(validatePortalFile('B',file({...entries,'xl/workbook.xml':entries['xl/workbook.xml'].replace('rId1','missing')})));
});
test('portal guard enforces signature, audience, type and verified principal', async()=> {
  const {JwtService}=require('@nestjs/jwt');
  const {PortalGuard}=require('../dist/modules/portal/portal.auth');
  const jwt=new JwtService(), guard=new PortalGuard(jwt,{me:async id=>{if(id!=='verified-portal-account')throw Error('unknown');return{id};}});
  const options={secret:portalSecret(),audience:'sme-enterprise-portal',issuer:'sme-enterprise-portal',expiresIn:'1h'};
  const token=payload=>jwt.signAsync({sub:'verified-portal-account',type:'portal',...payload},options);
  const context=t=>({switchToHttp:()=>({getRequest:()=>({headers:{authorization:`Bearer ${t}`}})})});
  assert.equal(await guard.canActivate(context(await token({}))),true);
  for(const t of [await token({type:'staff'}),await token({sub:'unverified'}),await jwt.signAsync({sub:'verified-portal-account',type:'portal'},{...options,audience:'staff'}),await jwt.signAsync({sub:'verified-portal-account',type:'portal'},{...options,secret:'internal-only-key'}),'invalid']) await assert.rejects(guard.canActivate(context(t)));
});
test('SMTP mailer delivers real verification mail to a loopback inbox', async()=> {
  const {startMailbox}=require('../scripts/dev-mailbox.cjs');
  const {PortalMailer}=require('../dist/modules/portal/portal.mailer');
  const mailbox=await startMailbox({smtpPort:0,httpPort:0});
  const old={host:process.env.SMTP_HOST,port:process.env.SMTP_PORT,secure:process.env.SMTP_SECURE,user:process.env.SMTP_USER};
  process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT=String(mailbox.smtpPort);process.env.SMTP_SECURE='false';delete process.env.SMTP_USER;
  try {
    await new PortalMailer().sendCode('unit@example.test','123456');
    const response=await fetch(`http://127.0.0.1:${mailbox.httpPort}/api/messages`);const body=await response.json();
    const messages=Array.isArray(body)?body:body.messages;
    assert.ok(messages.some(m=>m.text.includes('Mã xác minh: 123456') && m.text.includes('10 phút') && !m.text.includes('<')));
  } finally {
    for(const [key,value] of Object.entries({SMTP_HOST:old.host,SMTP_PORT:old.port,SMTP_SECURE:old.secure,SMTP_USER:old.user})) {if(value===undefined) delete process.env[key];else process.env[key]=value;}
    await mailbox.close();
  }
});

const MAIL_KEYS=['NODE_ENV','MAIL_PROVIDER','BREVO_API_KEY','MAIL_FROM_EMAIL','MAIL_FROM_NAME','FRONTEND_URL'];
async function withMailEnv(env,fetchImpl,run) {
  const saved=Object.fromEntries(MAIL_KEYS.map(k=>[k,process.env[k]])),savedFetch=globalThis.fetch;
  for(const k of MAIL_KEYS) delete process.env[k];
  Object.assign(process.env,env);
  if(fetchImpl) globalThis.fetch=fetchImpl;
  try {await run();}
  finally {
    globalThis.fetch=savedFetch;
    for(const [k,v] of Object.entries(saved)) {if(v===undefined) delete process.env[k];else process.env[k]=v;}
  }
}
const brevoEnv={MAIL_PROVIDER:'brevo',BREVO_API_KEY:'xkeysib-unit-test',MAIL_FROM_EMAIL:'noreply@sme-loan.test',MAIL_FROM_NAME:'SME Loan'};

test('Brevo mailer posts the verification code to the transactional email API', async()=> {
  const {PortalMailer}=require('../dist/modules/portal/portal.mailer');
  const calls=[];
  await withMailEnv(brevoEnv,async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({messageId:'<id@brevo>'}),{status:201});},async()=>{
    await new PortalMailer().sendCode('unit@example.test','654321');
  });
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.method,'POST');
  assert.equal(calls[0].init.headers['api-key'],'xkeysib-unit-test');
  const body=JSON.parse(calls[0].init.body);
  assert.deepEqual(body.sender,{email:'noreply@sme-loan.test',name:'SME Loan'});
  assert.deepEqual(body.to,[{email:'unit@example.test'}]);
  assert.equal(body.subject,'SME Loan - Mã xác minh đăng ký tài khoản');
  assert.ok(body.textContent.includes('654321') && body.textContent.includes('10 phút'));
  assert.ok(body.htmlContent.includes('654321') && body.htmlContent.includes('10 phút'));
});

async function captureBrevo(env,send) {
  const bodies=[];
  const {PortalMailer}=require('../dist/modules/portal/portal.mailer');
  await withMailEnv({...brevoEnv,...env},async(url,init)=>{bodies.push(JSON.parse(init.body));return new Response('{}',{status:201});},()=>send(new PortalMailer()));
  return bodies;
}

test('Brevo mails send Vietnamese HTML with a plain-text fallback and escape every inserted value', async()=> {
  const link='https://app.test/portal?reset=a&b="x"<script>alert(1)</script>';
  const [reset,reminder]=await captureBrevo({FRONTEND_URL:'https://app.test'},async m=>{
    await m.sendPasswordReset('unit@example.test',link);
    await m.sendSupplementReminder('unit@example.test','HS-<b>1</b>&"x"');
  });
  assert.equal(reset.subject,'SME Loan - Đặt lại mật khẩu');
  assert.ok(reset.textContent.includes(link));
  assert.ok(!reset.htmlContent.includes('<script>') && !reset.htmlContent.includes('"x"'));
  assert.ok(reset.htmlContent.includes('href="https://app.test/portal?reset=a&amp;b=&quot;x&quot;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  assert.ok(reset.htmlContent.includes('10 phút') && reset.htmlContent.includes('không trả lời'));
  assert.equal(reminder.subject,'SME Loan - Nhắc bổ sung chứng từ');
  assert.ok(reminder.textContent.includes('HS-<b>1</b>&"x"') && reminder.textContent.includes('https://app.test/portal'));
  assert.ok(reminder.htmlContent.includes('HS-&lt;b&gt;1&lt;/b&gt;&amp;&quot;x&quot;') && !reminder.htmlContent.includes('<b>1</b>'));
  assert.ok(reminder.htmlContent.includes('href="https://app.test/portal"'));
  const [code]=await captureBrevo({},m=>m.sendCode('unit@example.test','<1&2>'));
  assert.ok(code.htmlContent.includes('&lt;1&amp;2&gt;') && !code.htmlContent.includes('<1&2>'));
  for(const body of [reset,reminder,code]) assert.ok(/<html[^>]*lang="vi"/.test(body.htmlContent) && !/<script|<img|@import|<link/i.test(body.htmlContent.replace(/&lt;script/g,'')));
});

test('supplement reminder omits the portal link when FRONTEND_URL is not configured', async()=> {
  const [reminder]=await captureBrevo({},m=>m.sendSupplementReminder('unit@example.test','HS-2'));
  assert.ok(reminder.htmlContent.includes('HS-2') && !reminder.htmlContent.includes('href='));
  assert.ok(reminder.textContent.includes('HS-2') && !reminder.textContent.includes('http'));
});

test('Brevo rejection surfaces as a delivery failure without leaking the API key', async()=> {
  const {PortalMailer}=require('../dist/modules/portal/portal.mailer');
  await withMailEnv(brevoEnv,async()=>new Response(JSON.stringify({code:'unauthorized',message:'Key not found'}),{status:401}),async()=>{
    await assert.rejects(new PortalMailer().sendCode('unit@example.test','654321'),e=>e.getStatus()===503 && !JSON.stringify(e.getResponse()).includes('xkeysib'));
    await assert.rejects(new PortalMailer().sendPasswordReset('unit@example.test','http://x'),e=>e.getStatus()===503);
    await assert.rejects(new PortalMailer().sendSupplementReminder('unit@example.test','HS-1'),e=>e.getStatus()===503);
  });
});

test('production refuses to send without Brevo configuration', async()=> {
  const {PortalMailer}=require('../dist/modules/portal/portal.mailer');
  let called=false;const spy=async()=>{called=true;return new Response('{}',{status:201});};
  for(const env of [{NODE_ENV:'production'},{NODE_ENV:'production',MAIL_PROVIDER:'local'},{NODE_ENV:'production',MAIL_PROVIDER:'brevo',MAIL_FROM_EMAIL:'noreply@sme-loan.test'},{NODE_ENV:'production',MAIL_PROVIDER:'brevo',BREVO_API_KEY:'xkeysib-unit-test'}]) {
    await withMailEnv(env,spy,async()=>{await assert.rejects(new PortalMailer().sendCode('unit@example.test','654321'),e=>e.getStatus()===503);});
  }
  assert.equal(called,false);
});
