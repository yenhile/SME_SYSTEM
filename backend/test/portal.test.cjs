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
    assert.ok(messages.some(m=>m.text.includes('123456') && m.text.includes('10 minutes')));
  } finally {
    for(const [key,value] of Object.entries({SMTP_HOST:old.host,SMTP_PORT:old.port,SMTP_SECURE:old.secure,SMTP_USER:old.user})) {if(value===undefined) delete process.env[key];else process.env[key]=value;}
    await mailbox.close();
  }
});
