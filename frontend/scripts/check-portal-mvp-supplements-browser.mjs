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
let checks=0;const runtimeErrors=[],requests=[],networkErrors=[];
let createEndpoint='',dropCreateResponses=0;const createIds=[];
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
const supplementDir=fileURLToPath(new URL('../../backend/uploads/supplements/',import.meta.url));
const ownedSupplementFiles=new Set(),priorSupplementFiles=new Set(await fs.readdir(supplementDir).catch(e=>{if(e.code==='ENOENT')return [];throw e;}));
const originalWrite=fs.writeFile;
async function staffOpen(f,code){
  await navigate(site+'/');
  await wait(`document.querySelector('.login-card input[autocomplete=username]')||document.querySelector('.account-trigger')`,'staff entry');
  if(await evaluate(`!!document.querySelector('.login-card')`)){
    await input('.login-card input[autocomplete=username]',f.officerUsername);await input('.login-card input[type=password]',f.password);await click('Đăng nhập');
    await wait(`document.querySelector('.account-trigger')`,'actual staff login');check(true,'actual CBTD login');
  }
  await evaluate(`document.querySelector('button[data-tab=loans]').click()`);await wait(`document.querySelector('.view-switcher')`,'loan list');await click('Danh sách bảng');
  await wait(`[...document.querySelectorAll('tbody tr')].some(row=>row.textContent.includes(${JSON.stringify(code)}))`,'fixture loan row');
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes(${JSON.stringify(code)})).click()`);
  await wait(`document.querySelector('.modal-content')`,'loan detail');
  await evaluate(`[...document.querySelectorAll('.modal-content button')].find(x=>x.textContent.includes('Yêu cầu bổ sung (')).click()`);
  await wait(`document.querySelector('.supplement-panel')&&!document.querySelector('.supplement-panel [role=status]')`,'supplement staff panel');
}
async function portalOpen(f,reference,expectPending=true){
  // Owned private context contains only this runner's fixture recovery state.
  await evaluate('sessionStorage.clear()');
  await navigate(site+'/portal');await wait(`document.querySelector('.portal-auth')||document.querySelector('.portal-request-list')`,'portal entry');
  if(await evaluate(`!!document.querySelector('.portal-auth')`)){
    await input('.portal-auth input[type=email]',f.portalEmail);await input('.portal-auth input[type=password]',f.password);await click('Đăng nhập');
  }
  await wait(`document.querySelector('.portal-request-list')`,'portal dashboard');
  const row=`[...document.querySelectorAll('.portal-request-row')].find(x=>x.textContent.includes(${JSON.stringify(reference)}))`;
  await wait(`${row}?.disabled===false`,'requested portal row loaded and enabled');
  if(expectPending){await wait(`${row}?.querySelector('.supplement-dashboard-status')?.textContent.includes('1 yêu cầu bổ sung đang mở')`,'dashboard actual pending supplement badge');check(true,'dashboard badge is backed by real supplement request');}
  await evaluate(`${row}.click()`);await wait(`document.querySelector('.supplement-card')&&!document.querySelector('.supplement-panel button:disabled')?.textContent.includes('Tải lại yêu cầu')`,'portal supplement panel');
}
async function uploadFromBrowser(){
  const doc=await page.send('DOM.getDocument');const node=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.supplement-item input[type=file]'});assert.ok(node.nodeId,'pending upload input');
  await page.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[tempFile]});
  await wait(`[...document.querySelectorAll('.supplement-upload button')].some(x=>!x.disabled)`,'file selected');
  await evaluate(`[...document.querySelectorAll('.supplement-upload button')].find(x=>!x.disabled).click()`);
  await wait(`document.querySelector('.supplement-panel [role=status]')?.textContent.includes('Đã tải tài liệu')`,'upload persisted');
  check(true,'real browser file upload');await click('Gửi tài liệu bổ sung (1)');
  await wait(`document.querySelector('.supplement-item .portal-status')?.textContent.includes('Đã gửi, chờ kiểm tra')`,'response persisted');
  check(await evaluate(`!document.querySelector('.supplement-item input[type=file]')`),'submitted item locked in browser');
}
async function main(){
  h=await startIsolated();const write=fs.writeFile;
  fs.writeFile=async function(file,bytes,options){const value=await write.call(this,file,bytes,options);const target=path.resolve(String(file));if(options?.flag==='wx'&&path.dirname(target)===path.resolve(supplementDir)&&!priorSupplementFiles.has(path.basename(target)))ownedSupplementFiles.add(path.basename(target));return value;};
  const integration=await runChecks(h);check(integration.pass,'baseline real HTTP/PostgreSQL prerequisites');
  const f=h.browserFixture;
  const request=await h.db.portalRequest.findFirstOrThrow({where:{status:'ACCEPTED',account:{email:f.portalEmail},loan:{currentStage:'TIEP_NHAN'}},include:{loan:true}});
  const snapshot=JSON.stringify({data:request.data,checklistSnapshot:request.checklistSnapshot});
  const initialCount=request.loan.supplementCount;
  check(request.loan.currentStage==='TIEP_NHAN','fixture loan is in CBTD reception');
  vite=spawn(process.execPath,[path.join(path.dirname(frontendRequire.resolve('vite/package.json')),'bin/vite.js'),'--configLoader','runner','--host','127.0.0.1','--port','5174','--strictPort'],{cwd:frontend,env:{...process.env,VITE_API_URL:h.base},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let viteLog='';vite.stdout.on('data',x=>{viteLog+=x;});vite.stderr.on('data',x=>{viteLog+=x;});
  for(let i=0;i<100;i++){if(vite.exitCode!==null)throw Error('Owned Vite failed: '+viteLog.slice(-1000));try{if((await fetch(site,{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}if(i===99)throw Error('Vite readiness timeout');await sleep(100);}
  const version=await(await fetch(cdp+'/json/version')).json();browser=connection(version.webSocketDebuggerUrl);await browser.ready;
  ({browserContextId:contextId}=await browser.send('Target.createBrowserContext'));({targetId}=await browser.send('Target.createTarget',{url:site+'/',browserContextId:contextId}));
  let target;for(let i=0;i<30;i++){target=(await(await fetch(cdp+'/json/list')).json()).find(x=>x.id===targetId);if(target)break;await sleep(100);}assert.ok(target,'owned browser target');
  page=connection(target.webSocketDebuggerUrl,msg=>{
    if(msg.method==='Runtime.exceptionThrown')runtimeErrors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.method==='Network.requestWillBeSent'){requests.push(msg.params.request.url);if(msg.params.request.url===createEndpoint&&msg.params.request.method==='POST')createIds.push(JSON.parse(msg.params.request.postData).clientRequestId);}
    if(msg.method==='Network.responseReceived'&&msg.params.response.status>=400)networkErrors.push({url:msg.params.response.url,status:msg.params.response.status});
    if(msg.method==='Network.loadingFailed')networkErrors.push({error:msg.params.errorText});
    if(msg.method==='Fetch.requestPaused'){
      const p=msg.params;
      if(p.request.url===createEndpoint&&p.request.method==='POST'&&p.responseStatusCode===201&&dropCreateResponses>0){dropCreateResponses--;void page.send('Fetch.failRequest',{requestId:p.requestId,errorReason:'Aborted'});}
      else void page.send('Fetch.continueRequest',{requestId:p.requestId});
    }
  });await page.ready;
  await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.confirm=()=>true'});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await staffOpen(f,request.loan.applicationCode);await wait(`[...document.querySelectorAll('.supplement-panel button')].find(x=>x.textContent==='Tạo yêu cầu bổ sung theo danh mục')?.disabled===false`,'catalog creation ready');await click('Tạo yêu cầu bổ sung theo danh mục');
  await input('.supplement-create > label textarea','Browser synthetic supplement');await input('.supplement-create select','B:B_FINANCIAL_STATEMENTS');await input('.supplement-create fieldset input','2025');await input('.supplement-create fieldset textarea','Browser requires annual statement');
  // Lose actual server responses after PostgreSQL commits, rather than mocking
  // the API. Retry must reuse UUID, then refresh must discover the committed ID.
  createEndpoint=h.base+`/supplements/${request.loanId}`;dropCreateResponses=2;
  await page.send('Fetch.enable',{patterns:[{urlPattern:createEndpoint,requestStage:'Response'}]});
  await click('Gửi yêu cầu & Tạm dừng SLA');await wait(`document.querySelector('.supplement-panel [role=alert]')`,'first committed create response lost');
  check(await h.db.supplementRequest.count({where:{applicationId:request.loanId}})===1,'lost create response still committed exactly one request');
  await click('Gửi yêu cầu & Tạm dừng SLA');await wait(`document.querySelector('.supplement-panel [role=alert]')`,'committed create retry response lost');
  check(createIds.length===2&&createIds[0]===createIds[1],'ambiguous create retry reuses original UUID');
  await page.send('Fetch.disable');await click('Tải lại yêu cầu');await wait(`document.querySelector('.supplement-card')`,'refresh discovers committed structured request');
  check(await evaluate(`![...document.querySelectorAll('.supplement-panel button')].some(x=>x.textContent==='Tạo yêu cầu bổ sung theo danh mục')&&!document.querySelector('.supplement-create')`),'reconciled pending request disables duplicate creation');
  check(await h.db.supplementRequest.count({where:{applicationId:request.loanId}})===1,'retry and reconciliation create no duplicate request');
  const created=await h.db.supplementRequest.findFirstOrThrow({where:{applicationId:request.loanId}});
  check(created.portalSupplement.items.length===1&&created.portalSupplement.items[0].documentTypeCode==='B_FINANCIAL_STATEMENTS','staff UI creates catalog item');
  check((await h.db.applicationStageHistory.findFirstOrThrow({where:{applicationId:request.loanId,exitedAt:null}})).pausedAt!==null,'request pauses real SLA');
  const {PDFDocument}=require('pdf-lib');const pdf=await PDFDocument.create();pdf.addPage([120,120]);tempDir=await fs.mkdtemp(path.join(os.tmpdir(),'sme-mvp-supp-browser-'));tempFile=path.join(tempDir,'browser-supplement.pdf');await fs.writeFile(tempFile,await pdf.save());
  await portalOpen(f,request.reference);await uploadFromBrowser();
  const sent=await h.db.supplementRequest.findUniqueOrThrow({where:{id:created.id}});const firstResponse=JSON.stringify(sent.portalSupplement.responses[0]);
  check(sent.portalSupplement.items[0].status==='SUBMITTED','browser response persisted');
  await staffOpen(f,request.loan.applicationCode);await wait(`document.querySelector('.supplement-review textarea')`,'staff review controls');await input('.supplement-review textarea','Browser public replacement reason');await click('Yêu cầu thay thế');
  await wait(`document.querySelector('.supplement-item .portal-status')?.textContent.includes('Cần thay thế')`,'rejected item');check(true,'staff UI requests replacement');
  await portalOpen(f,request.reference);check(await evaluate(`document.querySelector('.supplement-item').textContent.includes('Browser public replacement reason')`),'public reason visible to owner');await uploadFromBrowser();
  const replaced=await h.db.supplementRequest.findUniqueOrThrow({where:{id:created.id}});
  check(replaced.portalSupplement.files.length===2&&replaced.portalSupplement.files[1].version===2,'replacement versions persisted');check(JSON.stringify(replaced.portalSupplement.responses[0])===firstResponse,'original submitted manifest immutable');
  await staffOpen(f,request.loan.applicationCode);await wait(`document.querySelector('.supplement-review textarea')`,'replacement review controls');await input('.supplement-review textarea','Browser accepts replacement');await click('Chấp nhận mục');
  await wait(`[...document.querySelectorAll('.supplement-panel button')].find(x=>x.textContent.includes('Hoàn tất yêu cầu'))?.disabled===false`,'resolve unlocked only after acceptance');await click('Hoàn tất yêu cầu & Chạy lại SLA');
  await wait(`document.querySelector('.supplement-card .portal-status')?.textContent.includes('Đã hoàn tất')`,'request resolved');
  const after=await h.db.loanApplication.findUniqueOrThrow({where:{id:request.loanId}});check(after.currentStage==='TIEP_NHAN'&&after.currentStatus===request.loan.currentStatus&&after.supplementCount===initialCount+1,'existing count and stage/status semantics retained');
  check((await h.db.applicationStageHistory.findFirstOrThrow({where:{applicationId:request.loanId,exitedAt:null}})).pausedAt===null,'SLA resumed');
  const original=await h.db.portalRequest.findUniqueOrThrow({where:{id:request.id}});check(JSON.stringify({data:original.data,checklistSnapshot:original.checklistSnapshot})===snapshot,'portal original snapshot untouched');
  await portalOpen(f,request.reference,false);check(await evaluate(`!document.querySelector('.supplement-item input[type=file]')`),'resolved portal request read only');
  for(const width of [1365,375]){await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),`portal no page overflow ${width}`);check(await evaluate(`!!document.querySelector('.supplement-events')`),`history visible ${width}`);}
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await click('Danh sách đề nghị');await wait(`[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Tạo đề nghị vay')?.disabled===false`,'back to portal dashboard ready');await click('Tạo đề nghị vay');await wait(`document.getElementById('v2-establishedYear')`,'new year-only draft');
  check(await evaluate(`document.getElementById('v2-establishedYear')?.value===''&&document.getElementById('v2-establishedDate')?.value===''`),'new draft has no fabricated foundation date/year');
  await input('#v2-companyName','Browser annual source');await input('#v2-establishedYear','2018');await input('#v2-revenuePeriod','2025');await click('Lưu nháp');await wait(`document.querySelector('.v2-save-status .saved')`,'year-only draft saved');
  let annualDraft=await h.db.portalRequest.findFirstOrThrow({where:{status:'DRAFT',data:{path:['companyName'],equals:'Browser annual source'}}});
  check(annualDraft.data.establishedYear===2018&&!annualDraft.data.establishedDate,'year-only UI saves actual year without fake date');
  await step(4);await click('Chọn tài liệu nhóm B');await input('[aria-label="Loại tài liệu 1"]','B_FINANCIAL_STATEMENTS');await input('[aria-label="Kỳ tài liệu 1"]','2025');
  const annualDoc=await page.send('DOM.getDocument');const annualFile=await page.send('DOM.querySelector',{nodeId:annualDoc.root.nodeId,selector:'.portal-upload-editor input[type=file]'});assert.ok(annualFile.nodeId);await page.send('DOM.setFileInputFiles',{nodeId:annualFile.nodeId,files:[tempFile]});await wait(`document.querySelector('.portal-upload-queue')`,'annual source queued');await click('Tải các tệp đang chờ');await wait(`!document.querySelector('.portal-upload-queue')&&document.querySelector('.portal-document-row')`,'annual source uploaded');
  const sourceSection=`[...document.querySelectorAll('.portal-wizard section')].find(s=>s.querySelector(':scope > h3')?.textContent==='Nguồn doanh thu năm')`;
  await wait(`${sourceSection}?.querySelector('select option[value]:not([value=""])')`,'source option available');
  await evaluate(`(()=>{const s=${sourceSection};const e=s.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,e.options[1].value);e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`${sourceSection}.querySelector('input[type=checkbox]').click()`);await click('Lưu nháp');await wait(`document.querySelector('.v2-save-status .saved')`,'annual declaration saved');
  annualDraft=await h.db.portalRequest.findUniqueOrThrow({where:{id:annualDraft.id}});
  check(annualDraft.data.annualRevenueBasis?.fullYearCompleted===true&&!!annualDraft.data.annualRevenueBasis?.documentId,'annual source and full-year declaration persist in real database');
  await page.send('Page.reload');await wait(`document.querySelector('.portal-wizard')&&document.getElementById('v2-establishedYear')?.value==='2018'`,'year-only draft recovered');await step(4);
  check(await evaluate(`${sourceSection}.querySelector('select').value===${JSON.stringify(annualDraft.data.annualRevenueBasis.documentId)}&&${sourceSection}.querySelector('input[type=checkbox]').checked`),'annual source picker and confirmation survive reload');
  check(runtimeErrors.length===0,'no uncaught browser runtime exceptions');check(!requests.some(url=>/^https?:\/\/(localhost|127\.0\.0\.1):3000\//.test(url)),'no UI API request reached main3000');
  result={pass:true,browserChecks:checks,prerequisiteHttpAndDatabaseChecks:integration.httpAndDatabaseChecks,browser:version.Browser,viewports:[1365,375],screenshots:false,recordings:false,scope:'Real CBTD/portal browser supplements create/upload/respond/reject/replace/accept/resolve; year-only and annual-source save/reload against isolated HTTP3002 and Vite5174',limitations:['No screenshot or recording per PO; pixel appearance not verified.','Normal server policy OFF is checked by separate integration evidence; this browser uses isolated TEST_ONLY policy.']};
}
try{await main();}catch(error){console.error(JSON.stringify({pass:false,browserChecks:checks,error:error.message,runtimeErrors,networkErrors}));if(page)console.error(await evaluate('JSON.stringify({url:location.href,html:document.documentElement.outerHTML.slice(-2200)})').catch(()=>''));process.exitCode=1;}
finally{
  const failures=[];
  try{if(contextId)await browser.send('Target.disposeBrowserContext',{browserContextId:contextId});}catch(e){failures.push(e.message);}page?.close();browser?.close();
  if(vite&&vite.exitCode===null&&vite.signalCode===null){const exited=new Promise(resolve=>vite.once('exit',resolve));vite.kill();await Promise.race([exited,sleep(5000)]);if(vite.exitCode===null&&vite.signalCode===null)failures.push('Owned Vite did not exit');}
  try{if(tempFile){assert.equal(path.dirname(tempFile),tempDir);await fs.unlink(tempFile);}if(tempDir)await fs.rmdir(tempDir);}catch(e){failures.push(e.message);}
  try{
    if(h)for(const request of await h.db.supplementRequest.findMany())for(const file of request.portalSupplement?.files||[])ownedSupplementFiles.add(file.filePath);
    for(const name of ownedSupplementFiles){assert.match(name,/^[0-9a-f-]{36}$/i);assert.ok(!priorSupplementFiles.has(name));const target=path.resolve(supplementDir,name);assert.equal(path.dirname(target),path.resolve(supplementDir));await fs.unlink(target).catch(e=>{if(e.code!=='ENOENT')throw e;});}
    for(const name of priorSupplementFiles)assert.ok((await fs.readdir(supplementDir)).includes(name),'pre-existing nested upload preserved');
  }catch(e){failures.push(e.message);}
  try{cleanup=await h?.close();}catch(e){failures.push(e.message);}finally{fs.writeFile=originalWrite;}
  const cleanupResult={...cleanup,nestedSupplementFilesRemoved:ownedSupplementFiles.size,preExistingNestedFilesPreserved:priorSupplementFiles.size};
  if(failures.length){console.error(JSON.stringify({cleanup:false,errors:failures}));process.exitCode=1;}else console.log(JSON.stringify({...result,cleanup:cleanupResult}));
}
