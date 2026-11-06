const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,readdirSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
require('reflect-metadata');
const uploads=mkdtempSync(join(tmpdir(),'sme-doc-validation-'));
process.env.UPLOAD_ROOT=uploads;
const {validate}=require('class-validator');
const {plainToInstance}=require('class-transformer');
const {PDFDocument}=require('pdf-lib');
const {CreateLoanDto}=require('../dist/modules/loan-applications/dto/create-loan.dto');
const {CompaniesService}=require('../dist/modules/companies/companies.service');
const {DocumentsService}=require('../dist/modules/documents/documents.service');
const {LoanApplicationsService}=require('../dist/modules/loan-applications/loan-applications.service');
const {assertOfficialAmount}=require('../dist/modules/workflow/loan-policy');

const loan=taxCode=>plainToInstance(CreateLoanDto,{taxCode,companyName:'A',industry:'B',establishedYear:2020,annualRevenue:1,charterCapital:1,representativeName:'C',phone:'0900000000',address:'D',loanPurpose:'E',loanType:'VAY_VON_LUU_DONG',proposedAmount:100000000,loanTermMonths:12});
const taxErrors=async taxCode=>(await validate(loan(taxCode))).filter(e=>e.property==='taxCode');

test('a tax code has exactly 10 or 13 digits',async()=>{
  for(const good of ['0312345678','0312345678001'])assert.deepEqual(await taxErrors(good),[],good);
  for(const bad of ['123','abc','03123456789','031234567800','031234567800a','03123 45678',' 0312345678','']){
    const errors=await taxErrors(bad);
    assert.equal(errors.length,1,JSON.stringify(bad));
  }
  assert.match(Object.values((await taxErrors('123'))[0].constraints).join(' '),/10 hoặc 13 chữ số/);
});

test('saving a company directly applies the same tax code rule before touching data',async()=>{
  let touched=false;
  const service=new CompaniesService({$transaction:async()=>{touched=true;}});
  await assert.rejects(service.upsert({taxCode:'abc'},{id:'u',activeRole:'CBTD'}),e=>e.getStatus()===400&&/10 hoặc 13 chữ số/.test(e.message));
  assert.equal(touched,false);
});

function amountService(loan){
  const saved=[];
  const tx={$queryRaw:async()=>[],loanApplication:{findUnique:async()=>({id:'l',assignedTo:'cbtd',intakeOfficerId:'cbtd',currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',completedAt:null,...loan}),update:async({data})=>{saved.push(data.officialAmount);return {id:'l',...data};}},assignmentChangeRequest:{findFirst:async()=>null,findMany:async()=>[],count:async()=>0}};
  return {saved,service:new LoanApplicationsService({$transaction:async fn=>fn(tx)})};
}
const officer={id:'cbtd',activeRole:'CBTD'};
const POLICY='SME_BRANCH_20261031_V1';

test('the official limit may never exceed 10 billion, for any loan',async()=>{
  for(const businessPolicyVersion of [POLICY,null]){
    const {service,saved}=amountService({businessPolicyVersion,proposedAmount:'15000000000'});
    await assert.rejects(service.setOfficialAmount('l',10000000001,officer),e=>e.getStatus()===400&&/10 tỷ/.test(e.message),String(businessPolicyVersion));
    assert.deepEqual(saved,[]);
  }
});

test('the official limit may not exceed the proposed amount',async()=>{
  const {service,saved}=amountService({businessPolicyVersion:POLICY,proposedAmount:'4000000000'});
  await assert.rejects(service.setOfficialAmount('l',4000000001,officer),e=>e.getStatus()===400&&/số tiền đề xuất/.test(e.message));
  assert.deepEqual(saved,[]);
});

test('the official limit may equal or sit below the proposed amount, up to exactly 10 billion',async()=>{
  const below=amountService({businessPolicyVersion:POLICY,proposedAmount:'4000000000'});
  await below.service.setOfficialAmount('l',3500000000,officer);
  await below.service.setOfficialAmount('l',4000000000,officer);
  assert.deepEqual(below.saved,[3500000000,4000000000]);
  const edge=amountService({businessPolicyVersion:POLICY,proposedAmount:'10000000000'});
  await edge.service.setOfficialAmount('l',10000000000,officer);
  assert.deepEqual(edge.saved,[10000000000]);
});

test('zero, negative and non numeric limits are refused',async()=>{
  const {service,saved}=amountService({businessPolicyVersion:POLICY,proposedAmount:'4000000000'});
  for(const bad of [0,-1,NaN])await assert.rejects(service.setOfficialAmount('l',bad,officer),e=>e.getStatus()===400,String(bad));
  assert.deepEqual(saved,[]);
});

test('a report cannot be submitted on a limit above the proposed amount saved earlier',()=>{
  assert.throws(()=>assertOfficialAmount('5000000000','4000000000'),e=>e.getStatus()===400&&/số tiền đề xuất/.test(e.message));
  assert.doesNotThrow(()=>assertOfficialAmount('4000000000','4000000000'));
});

function documents(){
  const created=[];
  const service=new DocumentsService({});
  service.create=async(applicationId,dto)=>{created.push(dto);return {id:'d',...dto};};
  return {service,created};
}
const file=(originalname,buffer,mimetype='application/pdf')=>({originalname,buffer,size:buffer.length,mimetype});
const realPdf=async()=>{const d=await PDFDocument.create();d.addPage([100,100]);return Buffer.from(await d.save());};
const stored=()=>readdirSync(uploads).length;

test('a real PDF is stored with the type read from its content',async()=>{
  const {service,created}=documents();
  const before=stored();
  await service.upload('l','PHAP_LY',file('gpkd.pdf',await realPdf(),'application/octet-stream'),'u');
  assert.equal(created[0].mimeType,'application/pdf');
  assert.equal(created[0].fileName,'gpkd.pdf');
  assert.equal(stored(),before+1);
});

test('an executable, a renamed file and an empty file are refused without storing anything',async()=>{
  const {service,created}=documents();
  const before=stored();
  const cases=[file('virus.exe',Buffer.from('MZ payload')),file('gia-mao.pdf',Buffer.from('MZ payload')),file('ghi-chu.txt',Buffer.from('text')),file('rong.pdf',Buffer.alloc(0))];
  for(const bad of cases)for(const type of ['PHAP_LY','KHAC'])await assert.rejects(service.upload('l',type,bad,'u'),e=>e.getStatus()===400,bad.originalname);
  assert.equal(created.length,0);
  assert.equal(stored(),before);
});

test('each document type allows the same formats as its group on the enterprise portal',async()=>{
  const {service}=documents();
  const photo=file('anh.png',Buffer.from('not really a png'),'image/png');
  for(const type of ['PHAP_LY','TAI_CHINH','HOAT_DONG_SX','PHUONG_AN','DU_NO','KHAC'])await assert.rejects(service.upload('l',type,photo,'u'),e=>/không đúng định dạng/.test(e.message),type);
  await assert.rejects(service.upload('l','TSBD',photo,'u'),e=>/hỏng|không khớp/.test(e.message),'collateral accepts PNG, so only the corrupt content is refused');
  const sheet=file('bctc.xlsx',Buffer.from('not a workbook'),'application/vnd.ms-excel');
  for(const type of ['TAI_CHINH','DU_NO'])await assert.rejects(service.upload('l',type,sheet,'u'),e=>/hỏng|không khớp/.test(e.message),type);
  await assert.rejects(service.upload('l','PHAP_LY',sheet,'u'),e=>/không đúng định dạng/.test(e.message));
});

test.after(()=>rmSync(uploads,{recursive:true,force:true}));
