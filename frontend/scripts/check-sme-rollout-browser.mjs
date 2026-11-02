// Owned headless Chrome, Vite and real approved-policy HTTP/PostgreSQL namespace.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runRound1Checks} from './round1-portal-checks.mjs';
import {runPackageAChecks} from './package-a-assignment-checks.mjs';
import {runCoordinationBrowserChecks} from './round2-coordination-checks.mjs';
import {runRound3BrowserChecks} from './round3-intake-checks.mjs';
const frontend=fileURLToPath(new URL('../',import.meta.url)),root=path.dirname(frontend.replace(/[\\/]$/,''));
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {startIsolated}=require('./scripts/check-portal-v2-intake.cjs');
const {runRolloutChecks}=require('./scripts/check-sme-rollout.cjs');
const {assignmentFixture}=require('./scripts/assignment-fixtures.cjs');
const site='http://localhost:5174';
let h,vite,chrome,page,profile,profileResolved;
let checks=0,interruptReview=false,interruptedReviewId;const errors=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evidence=path.join(root,'.codex_tmp','sme-rollout',String(Date.now()));
const check=(v,m)=>{assert.ok(v,m);checks++;};
function connection(url){const ws=new WebSocket(url);let sequence=0;const pending=new Map();const ready=new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data),p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text);
    else if(msg.method==='Fetch.requestPaused'){if(interruptReview&&msg.params.request.method==='POST'){interruptReview=false;interruptedReviewId=true;void page.send('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'ConnectionClosed'}).catch(e=>errors.push(e.message));}else void page.send('Fetch.continueResponse',{requestId:msg.params.requestId}).catch(e=>errors.push(e.message));}
  });
  return {ready,close:()=>ws.close(),send:async(method,params={})=>{await ready;const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
async function evaluate(expression){const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function wait(expression,label=expression){for(let i=0;i<160;i++){if(await evaluate(`Boolean(${expression})`))return;await sleep(100);}throw Error(`Browser timeout ${label}; `+await evaluate('document.body.innerText.slice(-1800)'));}
async function click(text,selector='button'){await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length&&!e.disabled)`,'enabled button '+text);await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)}&&x.getClientRects().length);if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(text)});e.click();})()`);}
async function input(selector,value){await wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&(e.tagName!=='SELECT'||[...e.options].some(o=>o.value===${JSON.stringify(String(value))}));})()`,'ready input '+selector);await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function navigate(url){await page.send('Page.navigate',{url});await wait(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'`,'navigation');}
async function api(endpoint,actor={},body,method=body===undefined?'GET':'POST'){body=await assignmentFixture(h.db,endpoint,body);const r=await fetch(h.base+endpoint,{method,headers:{...(actor.token?{Authorization:`Bearer ${actor.token}`} :{}),...(actor.role?{'X-Active-Role':actor.role}:{}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d=await r.json();assert.ok(r.ok,`${endpoint} HTTP ${r.status}: ${JSON.stringify(d.message??'')}`);return d;}
async function screenshot(name){await fs.mkdir(evidence,{recursive:true});const r=await page.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(evidence,name+'.png'),Buffer.from(r.data,'base64'));}
async function portalOpen(reference){await navigate(site+'/portal?cycle_review='+randomUUID());await wait(`document.querySelector('.portal-request-list')||document.querySelector('.portal-auth')||document.querySelector('.portal-wizard')`,'portal');if(await evaluate(`!!document.querySelector('.portal-auth')`)){await input('.portal-auth input[type=email]',h.browserFixture.portalEmail);await input('.portal-auth input[type=password]',h.browserFixture.password);await click('Đăng nhập');}
  await wait(`document.querySelector('.v2-heading h1')?.textContent.includes(${JSON.stringify(reference)})||[...document.querySelectorAll('.portal-request-row')].some(x=>x.textContent.includes(${JSON.stringify(reference)})&&!x.disabled)`,'enabled request row');
  if(await evaluate(`document.querySelector('.v2-heading h1')?.textContent.includes(${JSON.stringify(reference)})`))return;
  await evaluate(`(()=>{const row=[...document.querySelectorAll('.portal-request-row')].find(x=>x.textContent.includes(${JSON.stringify(reference)}));if(!row)throw Error('Missing request');row.click();})()`);await wait(`document.querySelector('.portal-wizard')`,'wizard');}
async function staffOpen(username,reference){await navigate(site+'/');await evaluate('localStorage.removeItem("sme_token");localStorage.removeItem("sme_active_role")');await navigate(site+'/?cycle_login='+randomUUID());await wait(`document.querySelector('.login-card input[autocomplete=username]')`,'staff login');await input('.login-card input[autocomplete=username]',username);await input('.login-card input[type=password]',h.browserFixture.password);await click('Đăng nhập');await wait(`document.querySelector('.account-trigger')`,'workspace');await evaluate(`document.querySelector('button[data-tab=loans]').click()`);await wait(`document.querySelector('.portal-tabs')`,'loans');await click('Chờ tiếp nhận');await wait(`document.querySelector('.portal-intake table')`,'intake');
  await wait(`[...document.querySelectorAll('.portal-intake tbody tr')].some(x=>x.textContent.includes(${JSON.stringify(reference)}))`,'request row');await evaluate(`(()=>{const r=[...document.querySelectorAll('.portal-intake tbody tr')].find(x=>x.textContent.includes(${JSON.stringify(reference)}));[...r.querySelectorAll('button')].find(b=>b.textContent.includes('Xem đề nghị')).click();})()`);await wait(`document.querySelector('.intake-details')`,'details');}
async function reviewUi(itemId,accepted,message=''){await wait(`document.querySelector('[data-item-id="${itemId}"]')`,'review item');if(message)await input(`[data-item-id="${itemId}"] textarea`,message);await click(accepted?'Kiểm tra đạt':'Yêu cầu sửa mục này',`[data-item-id="${itemId}"] button`);await wait(`document.querySelector('[data-item-id="${itemId}"]')?.textContent.includes(${JSON.stringify(accepted?'Đã kiểm tra đạt':message)})&&!document.querySelector('[data-item-id="${itemId}"] button')?.disabled`,'review saved');}
async function main(){
  h=await startIsolated({approvedIntake:true,coordinationMigration:process.argv.includes('--round2'),accountRecoveryMigration:process.argv.includes('--round1'),uploadRoot:path.join(root,'.codex_tmp','rollout-uploads-'+randomUUID())});
  const integration=await runRolloutChecks(h);check(integration.pass,'API and PostgreSQL checks');
  const round3=process.argv.includes('--round3')?await require('./scripts/check-round3-intake.cjs').runRound3Checks(h):undefined;
  const coordination=process.argv.includes('--round2')?await require('./scripts/check-round2-assignments.cjs').runCoordinationChecks(h):undefined;
  const safety=process.argv.includes('--package-a')?await require('./scripts/check-assignment-safety.cjs').runAssignmentSafetyChecks(h):undefined;
  process.env.PORTAL_V2_ROLLOUT_ENABLED='true';
  const f=h.rolloutFixture,officer={token:f.officerToken,role:'CBTD'};
  // API maker/checker checks temporarily give this synthetic officer a second role.
  // Ordinary UI acceptance uses a single-role fixture; role switching remains R6.
  await h.db.userRole.deleteMany({where:{userId:f.officerId,role:{code:'THAM_QUYEN'}}});
  const loan=await h.db.loanApplication.findUnique({where:{id:f.loanId}});
  const form=new FormData();form.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'browser-source.pdf');form.append('documentType','PHAP_LY');
  await api('/documents/'+loan.id,officer,form);
  await api('/loan-applications/'+loan.id+'/set-amount',officer,{officialAmount:10000000000},'PUT');
  await api('/loan-applications/'+loan.id+'/check-documents',officer,{isComplete:true},'PUT');
  let viteLog='';
  vite=spawn(process.execPath,[path.join(frontend,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5174','--strictPort'],{cwd:frontend,env:{...process.env,VITE_API_URL:h.base},windowsHide:true,stdio:['ignore','pipe','pipe']});
  vite.stdout.on('data',x=>viteLog+=x);vite.stderr.on('data',x=>viteLog+=x);
  for(let i=0;i<100;i++){if(vite.exitCode!==null)throw Error('Vite stopped: '+viteLog.slice(-1500));try{if((await fetch(site)).ok)break;}catch{}await sleep(100);}
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'sme-intake-chrome-'));profileResolved=await fs.realpath(profile);
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<100;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await sleep(100);}assert.ok(port,'Chrome ready');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();page=connection(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await page.ready;await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.confirm=()=>true'});await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  async function openLoan(username){
    await navigate(site+'/');await evaluate('localStorage.removeItem("sme_token");localStorage.removeItem("sme_active_role")');await navigate(site+'/?rollout='+randomUUID());
    await input('.login-card input[autocomplete=username]',username);await input('.login-card input[type=password]',f.password);await click('Đăng nhập');await wait('document.querySelector(".account-trigger")','staff signed in');
    await evaluate('document.querySelector("button[data-tab=loans]").click()');await click('Danh sách bảng');
    await wait('[...document.querySelectorAll("tbody tr")].some(r=>r.textContent.includes('+JSON.stringify(loan.applicationCode)+'))','loan row');
    await evaluate('[...document.querySelectorAll("tbody tr")].find(r=>r.textContent.includes('+JSON.stringify(loan.applicationCode)+')).click()');
    await wait('document.querySelector(".appraisal-panel textarea")','report panel');
  }
  await openLoan(f.officerUsername);
  for(const [key,value] of Object.entries(f.content)){const labels={legalAssessment:'Đánh giá pháp lý và đại diện',businessAssessment:'Hoạt động kinh doanh và phương án vốn',financialAssessment:'Phân tích tài chính và tài liệu làm căn cứ',repaymentSource:'Dòng tiền và nguồn trả nợ',collateralAssessment:'Bảo đảm (ghi không áp dụng nếu có căn cứ)',risks:'Rủi ro và biện pháp kiểm soát',recommendation:'Kết luận đề xuất và căn cứ',proposedConditions:'Điều kiện đề xuất (nếu có)'};await input('textarea[aria-label="'+labels[key]+'"]',value);}
  await click('Lưu nháp tờ trình');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("Đã lưu bản nháp")','draft saved');await screenshot('01-cbtd-draft');
  await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await screenshot('01b-report-mobile');check(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'report mobile fits viewport');await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await click('Trình tờ trình');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("Đã trình, chờ quyết định")','submitted');
  check((await h.db.appraisalReportVersion.count({where:{report:{applicationId:loan.id}}}))===1,'browser submit persists a version');
  await openLoan(f.approverUsername);
  check(await evaluate('[...document.querySelectorAll(".appraisal-panel textarea")].filter(t=>t.getAttribute("aria-label")!=="Nội dung cần CBTD làm rõ").every(t=>t.readOnly)'),'approver cannot edit report');
  await input('textarea[aria-label="Nội dung cần CBTD làm rõ"]','Please clarify the documented repayment source.');await click('Yêu cầu làm rõ tờ trình');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("CBTD cần làm rõ")','clarification saved');await screenshot('02-approver-clarification');
  check(!(await evaluate('[...document.querySelectorAll(".modal-footer button")].some(b=>b.textContent.includes("Phê duyệt Khoản vay"))')),'approval hidden while clarification open');
  await openLoan(f.officerUsername);await input('textarea[aria-label="Dòng tiền và nguồn trả nợ"]','Clarified synthetic repayment evidence.');await click('Lưu nháp tờ trình');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("Đã lưu bản nháp")','revised draft saved');await click('Trình tờ trình');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("Đã trình, chờ quyết định")','resubmitted');
  await openLoan(f.approverUsername);await click('Phê duyệt Khoản vay');await click('Xác nhận Phê duyệt');await wait('document.querySelector(".appraisal-panel")?.textContent.includes("Đã có quyết định")','approved');await screenshot('03-approved-versioned-report');
  const final=await h.db.loanApplication.findUnique({where:{id:loan.id}});check(final.currentStatus==='APPROVED','UI approval persisted');check(await h.db.appraisalReportVersion.count({where:{report:{applicationId:loan.id}}})===2,'UI correction preserved both versions');
  await navigate(site+'/portal');await wait('document.querySelector(".portal-auth input[type=email]")','portal login');await input('.portal-auth input[type=email]',f.portalEmail);await input('.portal-auth input[type=password]',f.password);await click('Đăng nhập');await click('Tạo đề nghị vay');
  await input('select#v2-businessScope','SERVICES');await wait('document.querySelector("select#v2-serviceProofMode")','service evidence choice');await input('select#v2-serviceProofMode','ACCEPTANCE_INVOICE');
  check(await evaluate('document.querySelector("select#v2-businessScope").options.length>=4'),'supported scopes shown');await screenshot('04-service-portal');
  await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await screenshot('05-service-mobile');check(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'mobile fits viewport');
  if(process.argv.includes('--round1'))await runRound1Checks({h,f,officer,site,port,page,connection,evaluate,wait,input,click,navigate,screenshot,api,check,evidence,require,sleep});
  if(safety)await runPackageAChecks({h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,check});
  if(coordination)await runCoordinationBrowserChecks({h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,check,require});
  if(round3)await runRound3BrowserChecks({h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,portalOpen,check});
  check(errors.length===0,'no browser runtime exceptions');
  const result={pass:true,browserChecks:checks,apiChecks:integration.checks,portalRegressionChecks:integration.portalRegressionChecks,assignmentSafety:safety,coordination,round3,migration:integration.migration,evidence,schema:h.schema};
  await fs.writeFile(path.join(evidence,'acceptance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
try{await main();}catch(e){if(page)await screenshot('failure').catch(()=>{});console.error('ROLLOUT_BROWSER_FAILED:',e.message);process.exitCode=1;}
finally{page?.close();if(chrome){chrome.kill();await sleep(600);}if(vite)vite.kill();if(h)console.log(JSON.stringify({cleanup:await h.close()}));if(profile&&profileResolved===await fs.realpath(profile).catch(()=>null)&&path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('sme-intake-chrome-'))await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
