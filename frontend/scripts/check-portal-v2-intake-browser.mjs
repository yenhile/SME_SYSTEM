// Real Chrome + Vite5174 + isolated HTTP3002/PostgreSQL. No screenshots/recordings.
// All writes are synthetic fixtures in the harness-owned test namespace.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const frontend = fileURLToPath(new URL('../',import.meta.url));
const require = createRequire(new URL('../../backend/package.json',import.meta.url));
const frontendRequire = createRequire(new URL('../package.json',import.meta.url));
const {startIsolated,runChecks}=require('./scripts/check-portal-v2-intake.cjs');
const site='http://localhost:5174', cdp='http://127.0.0.1:9333';
let h,vite,browser,page,contextId,targetId,tempDir,tempFile,result,cleanup;
let checks=0;const runtimeErrors=[],requests=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(value,label)=>{assert.ok(value,label);checks++;};
function connection(url,onEvent=()=>{}) {
  const ws=new WebSocket(url);let sequence=0;const pending=new Map();
  const ready=new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data),task=pending.get(msg.id);
    if(task){pending.delete(msg.id);clearTimeout(task.timer);msg.error?task.reject(Error(msg.error.message)):task.resolve(msg.result);}
    else onEvent(msg);
  });
  return {ready,close:()=>ws.close(),async send(method,params={}){
    await ready;const id=++sequence;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout ${method}`));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  }};
}
async function evaluate(expression){const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(expression,label=expression){for(let i=0;i<120;i++){if(await evaluate(`Boolean(${expression})`))return;await sleep(100);}throw Error(`Browser timeout ${label}; `+await evaluate('document.body.innerText.slice(-1800)'));}
async function click(text,selector='button'){await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)}&&x.getClientRects().length);if(!e||e.disabled)throw Error('Unavailable: '+${JSON.stringify(text)});e.click();})()`);}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function navigate(url){await page.send('Page.navigate',{url});await wait(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'`,'navigation');}
async function step(n){await click(['Thông tin doanh nghiệp','Nhu cầu vay','Phương án vốn','Hồ sơ tài liệu','Rà soát đề nghị'][n-1],'.v2-stepper button strong');await wait(`document.querySelector('[aria-current="step"]')?.textContent.includes('${n}')`,'wizard step');}
async function api(endpoint,token,method='GET',body){const r=await fetch(h.base+endpoint,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();assert.ok(r.ok,`${endpoint} HTTP${r.status}: ${JSON.stringify(data.message)}`);return data;}
async function staffLogin(username){
  await navigate(site+'/');
  // This private browser context contains only the runner's synthetic sessions.
  await evaluate('localStorage.removeItem("sme_token");localStorage.removeItem("sme_active_role")');
  await page.send('Page.reload');await wait(`document.querySelector('.login-card input[autocomplete=username]')`,'staff login');
  await input('.login-card input[autocomplete=username]',username);await input('.login-card input[type=password]',h.browserFixture.password);await click('Đăng nhập');
  await wait(`document.querySelector('.account-trigger')`,'staff workspace');check(true,`actual staff login ${username}`);
  await evaluate(`document.querySelector('button[data-tab=loans]').click()`);await wait(`document.querySelector('.portal-tabs')`,'loan tabs');await click('Chờ tiếp nhận');await wait(`document.querySelector('.portal-intake table')`,'intake list');
}
async function selectRequest(reference){await wait(`[...document.querySelectorAll('.portal-intake tbody tr')].some(x=>x.textContent.includes(${JSON.stringify(reference)}))`,'request in intake');await evaluate(`(()=>{const row=[...document.querySelectorAll('.portal-intake tbody tr')].find(x=>x.textContent.includes(${JSON.stringify(reference)}));[...row.querySelectorAll('button')].find(x=>x.textContent.includes('Xem đề nghị')).click();})()`);await wait(`document.querySelector('.intake-details')`,'full intake details');}
async function main(){
  h=await startIsolated();
  const integration=await runChecks(h);check(integration.pass,'real HTTP/PG prerequisites');
  const f=h.browserFixture;
  vite=spawn(process.execPath,[path.join(path.dirname(frontendRequire.resolve('vite/package.json')),'bin/vite.js'),'--host','127.0.0.1','--port','5174','--strictPort'],{cwd:frontend,env:{...process.env,VITE_API_URL:h.base},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let viteLog='';vite.stdout.on('data',x=>{viteLog+=x;});vite.stderr.on('data',x=>{viteLog+=x;});
  for(let i=0;i<100;i++){
    if(vite.exitCode!==null)throw Error('Owned Vite failed: '+viteLog.slice(-1200));
    try{if((await fetch(site,{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}
    if(i===99)throw Error('Owned Vite readiness timeout');await sleep(100);
  }
  const version=await(await fetch(cdp+'/json/version')).json();browser=connection(version.webSocketDebuggerUrl);await browser.ready;
  ({browserContextId:contextId}=await browser.send('Target.createBrowserContext'));
  ({targetId}=await browser.send('Target.createTarget',{url:site+'/portal',browserContextId:contextId}));
  let target;for(let i=0;i<30;i++){target=(await(await fetch(cdp+'/json/list')).json()).find(x=>x.id===targetId);if(target)break;await sleep(100);}assert.ok(target,'Owned browser target created');
  page=connection(target.webSocketDebuggerUrl,msg=>{
    if(msg.method==='Runtime.exceptionThrown')runtimeErrors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.method==='Network.requestWillBeSent')requests.push(msg.params.request.url);
  });await page.ready;
  await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.confirm=()=>true'});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  const token=(await api('/portal/auth/login',null,'POST',{email:f.portalEmail,password:f.password})).accessToken;
  const data={taxCode:'7999999999',companyName:'Browser Intake Original',industry:'Sản xuất',establishedYear:2015,annualRevenue:15000000000,charterCapital:8000000000,representativeName:'Browser representative',phone:'0900000000',address:'Synthetic browser address',loanPurpose:'Browser working capital',loanType:'VAY_VON_LUU_DONG',proposedAmount:8000000000,loanTermMonths:12,contactName:'Browser contact',contactPhone:'0900000000',contactEmail:'browser@example.test',preferredBranch:'Browser branch',collateral:{mode:'NONE_REQUESTED'},hasExistingDebt:false,capitalPlan:{businessActivity:'Browser manufacturing',ownFunds:2000000000,otherFunds:0,costs:[{name:'Browser materials',amount:10000000000}],repaymentSource:'Browser sales'}};
  let draft=await api('/portal/requests',token,'POST',{formVersion:2,clientRequestId:randomUUID(),data});
  const {PDFDocument}=require('pdf-lib');const pdf=await PDFDocument.create();pdf.addPage([120,120]);const bytes=await pdf.save();
  for(const [group,coverage]of [['A',[{documentTypeCode:'A_BUSINESS_REGISTRATION'}]],['B',[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2024'},{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:'2025'}]],['C',[{documentTypeCode:'C_PURCHASE_ORDER'}]]]){
    const form=new FormData();form.append('documentGroup',group);form.append('coverage',JSON.stringify(coverage));form.append('clientUploadId',randomUUID());form.append('expectedRevision',String(draft.revision));form.append('file',new Blob([bytes]),`browser-${group}.pdf`);draft=await api(`/portal/requests/${draft.id}/documents`,token,'POST',form);
  }
  tempDir=await fs.mkdtemp(path.join(os.tmpdir(),'sme-intake-browser-'));tempFile=path.join(tempDir,'browser-plan.pdf');await fs.writeFile(tempFile,bytes);
  await navigate(site+'/portal');await wait(`document.querySelector('.portal-auth input[type=email]')`,'portal login');
  await input('.portal-auth input[type=email]',f.portalEmail);await input('.portal-auth input[type=password]',f.password);await click('Đăng nhập');await wait(`document.querySelector('.portal-request-list')`,'portal dashboard');check(true,'real portal login');
  await evaluate(`(()=>{const row=[...document.querySelectorAll('.portal-request-row')].find(x=>x.textContent.includes(${JSON.stringify(draft.reference)}));if(!row)throw Error('Missing browser fixture');row.click();})()`);await wait(`document.querySelector('.portal-wizard')`,'V2 wizard');
  check(await evaluate(`document.querySelectorAll('.v2-stepper li').length===5`),'five wizard steps');
  await input('#v2-companyName','Browser Intake Reviewed');await click('Lưu nháp');await wait(`document.querySelector('.v2-save-status .saved')`,'save');
  check((await api(`/portal/requests/${draft.id}`,token)).data.companyName==='Browser Intake Reviewed','UI save persisted to isolated PostgreSQL');
  await step(5);check(await evaluate(`[...document.querySelectorAll('.v2-wizard-footer button')].find(x=>x.textContent.includes('Gửi đề nghị'))?.disabled`),'incomplete policy disables submit');
  await step(4);await click('Chọn tài liệu nhóm D');await input('[aria-label="Loại tài liệu 1"]','D_CAPITAL_PLAN');
  const doc=await page.send('DOM.getDocument');const fileNode=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.portal-upload-editor input[type=file]'});assert.ok(fileNode.nodeId);await page.send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[tempFile]});await wait(`document.querySelector('.portal-upload-queue')`,'upload queued');
  await click('Tải các tệp đang chờ');await wait(`!document.querySelector('.portal-upload-queue')&&document.querySelectorAll('.portal-document-row').length===4`,'real upload');check(true,'browser selected and uploaded real D PDF');
  await step(5);await wait(`![...document.querySelectorAll('.v2-wizard-footer button')].find(x=>x.textContent.includes('Gửi đề nghị'))?.disabled`,'test submit enabled');
  check(await evaluate(`document.querySelector('.v2-review').textContent.includes('TEST_ONLY')`),'test policy disclosed in portal UI');
  await evaluate('window.confirm=()=>true');await click('Gửi đề nghị thử nghiệm');await wait(`document.querySelector('.v2-review').textContent.includes('Đề nghị đã gửi và khóa chỉnh sửa')`,'UI submission');
  let sent=await api(`/portal/requests/${draft.id}`,token);check(sent.status==='SUBMITTED'&&sent.checklistSnapshot.snapshotVersion===2&&sent.loanId===null,'UI submit freezes snapshot without Loan/SLA');
  await step(1);check(await evaluate(`document.getElementById('v2-companyName').matches(':disabled')||document.getElementById('v2-companyName').readOnly`),'submitted portal fields locked');
  await staffLogin(f.managerUsername);await selectRequest(draft.reference);
  for(const text of ['Snapshot đã gửi','TEST-SME-INTAKE-1','Browser Intake Reviewed','browser@example.test','Browser manufacturing','Browser materials','Browser sales','2024','2025','SHA-256','browser-plan.pdf'])check(await evaluate(`document.querySelector('.intake-details').textContent.includes(${JSON.stringify(text)})`),`manager details ${text}`);
  check(await evaluate(`document.querySelectorAll('.intake-details input,.intake-details textarea,.intake-details select').length===0`),'manager V2 details read only');
  check(await evaluate(`![...document.querySelectorAll('.portal-intake button')].some(x=>x.textContent.trim()==='Tiếp nhận thành hồ sơ vay')`),'manager cannot accept');
  await click('browser-plan.pdf','.intake-details button');await wait(`document.querySelector('.portal-preview iframe')?.src.startsWith('blob:')`,'real staff PDF preview');check(true,'staff document preview from guarded download');await click('Đóng','.portal-preview button');
  const officer=await h.db.user.findUniqueOrThrow({where:{username:f.officerUsername}});
  await wait(`document.querySelector('.intake-assignment-form select')&&!document.querySelector('.intake-assignment-form select').disabled`,'assignment loaded');await input('.intake-assignment-form select',officer.id);await evaluate('window.confirm=()=>true');await click('Phân công đề nghị');await wait(`document.querySelector('.portal-intake').textContent.includes('CBTD được giao sẽ kiểm tra và tiếp nhận.')`,'UI assignment');
  check((await h.db.portalRequest.findUniqueOrThrow({where:{id:draft.id}})).assignedTo===officer.id,'manager UI assignment persisted');
  await staffLogin(f.officerUsername);await selectRequest(draft.reference);await wait(`![...document.querySelectorAll('button')].find(x=>x.textContent.includes('Kiểm tra doanh nghiệp để tiếp nhận'))?.disabled`,'assigned CBTD permitted');check(true,'assigned CBTD sees frozen details and enabled verification');
  await click('Kiểm tra doanh nghiệp để tiếp nhận');await wait(`document.querySelector('.portal-intake-match')`,'company match');check(await evaluate(`document.querySelector('.portal-intake-match').textContent.includes('Chưa có doanh nghiệp')`),'new-tax company matching shown');
  await evaluate('window.confirm=()=>true');await click('Tiếp nhận thành hồ sơ vay');await wait(`document.querySelector('.modal-content')`,'accepted Loan UI');
  const accepted=await h.db.portalRequest.findUniqueOrThrow({where:{id:draft.id}});check(accepted.status==='ACCEPTED'&&!!accepted.loanId,'CBTD UI acceptance creates linked loan');
  const history=await h.db.applicationStageHistory.findMany({where:{applicationId:accepted.loanId}});check(history.length===1&&history[0].enteredAt.getTime()===accepted.acceptedAt.getTime(),'UI acceptance starts exactly one SLA');
  await evaluate(`(()=>{const s=[...document.querySelectorAll('.modal-content summary')].find(x=>x.textContent.includes('Đề nghị gốc từ cổng doanh nghiệp'));if(!s)throw Error('No original source in Loan');s.click();})()`);await wait(`document.querySelector('.modal-content details[open] .intake-details')`,'Loan original source expanded');
  for(const text of ['Browser Intake Reviewed','Browser manufacturing','Browser materials','Browser sales','browser-plan.pdf','TEST-SME-INTAKE-1','2024','2025'])check(await evaluate(`document.querySelector('.modal-content .intake-details').textContent.includes(${JSON.stringify(text)})`),`Loan original source ${text}`);
  check(await evaluate(`document.querySelectorAll('.modal-content .intake-details input,.modal-content .intake-details textarea').length===0`),'original V2 request remains read only in Loan');
  for(const width of [1365,375]){
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`no document horizontal overflow ${width}`);
    check(await evaluate(`document.querySelector('.modal-content details[open] .intake-details')!==null`),`original details present ${width}`);
  }
  check(runtimeErrors.length===0,'no uncaught browser runtime exceptions');
  check(!requests.some(url=>/^https?:\/\/(?:localhost|127\.0\.0\.1):3000\//.test(url)),'isolated UI sends no API requests to main3000');
  result={pass:true,browserChecks:checks,prerequisiteHttpAndDatabaseChecks:integration.httpAndDatabaseChecks,browser:version.Browser,viewports:[1365,375],screenshots:false,recordings:false,ml:integration.ml,scope:'Synthetic isolated PostgreSQL + HTTP3002 + Vite5174; portal upload/submit, manager assignment, CBTD acceptance, original request in Loan',limitations:['DOM and real interactions verified; pixel appearance not verified because screenshots were explicitly excluded.']};
}
try{await main();}
catch(error){console.error(JSON.stringify({pass:false,browserChecks:checks,error:error.message,runtimeErrors}));if(page)console.error(await evaluate('document.body.innerText.slice(-1800)').catch(()=>''));process.exitCode=1;}
finally{
  const failures=[];
  try{if(contextId)await browser.send('Target.disposeBrowserContext',{browserContextId:contextId});}catch(e){failures.push(e.message);}
  page?.close();browser?.close();
  if(vite&&vite.exitCode===null&&vite.signalCode===null){const exited=new Promise(resolve=>vite.once('exit',resolve));vite.kill();await Promise.race([exited,sleep(5000)]);if(vite.exitCode===null&&vite.signalCode===null)failures.push('Owned Vite did not exit');}
  try{if(tempFile){assert.equal(path.dirname(tempFile),tempDir);await fs.unlink(tempFile);}if(tempDir)await fs.rmdir(tempDir);}catch(e){failures.push(e.message);}
  try{cleanup=await h?.close();}catch(e){failures.push(e.message);}
  if(failures.length){console.error(JSON.stringify({cleanup:false,errors:failures}));process.exitCode=1;}
  else if(result)console.log(JSON.stringify({...result,cleanup}));
}
