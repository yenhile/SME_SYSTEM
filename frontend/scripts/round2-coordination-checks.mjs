import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runCoordinationBrowserChecks(ctx){
  const {h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,check,require}=ctx;
  const f=h.coordinationFixture,{a,b,manager,uiLoan,uiPortal}=f;
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  async function login(username){await navigate(site+'/');await evaluate('localStorage.removeItem("sme_token");localStorage.removeItem("sme_active_role")');await navigate(site+'/?coordination='+randomUUID());await input('.login-card input[autocomplete=username]',username);await input('.login-card input[type=password]',h.rolloutFixture.password);await click('Đăng nhập');await wait('document.querySelector(".account-trigger")');}
  async function openLoan(username,loan){await login(username);await evaluate('document.querySelector("button[data-tab=loans]").click()');await click('Danh sách bảng');await wait(`[...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes(${JSON.stringify(loan.applicationCode)}))`);await evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(loan.applicationCode)})).click()`);await wait('document.querySelector(".modal-content .coordination-panel")');}
  async function managerQueue(code){await login(manager.user.username);await evaluate('document.querySelector("button[data-tab=assignments]").click()');await wait(`[...document.querySelectorAll('.coordination-queue tbody tr')].some(r=>r.textContent.includes(${JSON.stringify(code)}))`);await evaluate(`[...document.querySelectorAll('.coordination-queue tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(code)})).querySelector('button').click()`);await wait('document.querySelector(".coordination-decision")');}
  await openLoan(a.user.username,uiLoan);
  await input('textarea[aria-label="Lý do đề nghị điều phối"]','Synthetic ordinary workload request');await click('Gửi đề nghị điều phối');await wait('document.querySelector(".coordination-receipts")?.textContent.includes("Chờ quản lý xử lý")');
  check((await h.db.loanApplication.findUniqueOrThrow({where:{id:uiLoan.id}})).assignedTo===a.user.id,'request does not release assigned responsibility');await screenshot('round2-01-cbtd-request');
  await click('Rút đề nghị điều phối');await wait('document.querySelector(".coordination-receipts")?.textContent.includes("CBTD đã rút")');
  check(await evaluate('!!document.querySelector(".coordination-create")'),'ordinary request can be withdrawn and recreated');
  await input('select[aria-label="Nhóm lý do điều phối"]','CONFLICT_OF_INTEREST');await input('textarea[aria-label="Lý do đề nghị điều phối"]','Synthetic private conflict reported by original officer');await click('Gửi đề nghị điều phối');
  await wait('document.querySelector(".modal-content")?.textContent.includes("các thao tác ghi nghiệp vụ trên hồ sơ này bị chặn")');
  check(await evaluate('![...document.querySelectorAll(".coordination-receipt")].filter(r=>r.textContent.includes("Chờ quản lý xử lý")).some(r=>[...r.querySelectorAll("button")].some(b=>b.textContent.includes("Rút đề nghị")))'),'COI cannot be withdrawn through UI');
  check(await evaluate('[...document.querySelectorAll(".appraisal-panel textarea")].every(e=>e.disabled||e.readOnly)'),'COI blocks report editing in UI');await screenshot('round2-02-coi-protection');
  const pending=await h.db.assignmentChangeRequest.findFirstOrThrow({where:{applicationId:uiLoan.id,status:'PENDING'}});
  await managerQueue(uiLoan.applicationCode);await input('select[aria-label="Cán bộ nhận bàn giao"]',b.user.id);await input('textarea[aria-label="Căn cứ quyết định điều phối"]','Synthetic manager assigns independent officer');
  check(await evaluate('[...document.querySelectorAll(".coordination-decision button")].find(b=>b.textContent.includes("Không chấp thuận")).disabled'),'COI rejection requires confirmations');
  await evaluate(`(()=>{const original=window.fetch;window.__coordinationBodies=[];window.__dropCoordination=true;window.fetch=async(...args)=>{const [url,options]=args;const selected=String(url).includes('/assignment-change-requests/${pending.id}/approve')&&options?.method==='POST';if(selected)window.__coordinationBodies.push(JSON.parse(options.body));const r=await original(...args);if(selected&&r.ok&&window.__dropCoordination){window.__dropCoordination=false;throw new TypeError('Synthetic response lost after real coordination commit');}return r;};})()`);
  await click('Chấp thuận và bàn giao');await wait('document.querySelector(".coordination-panel")?.textContent.includes("Không kết nối được máy chủ")');
  check((await h.db.assignmentChangeRequest.findUniqueOrThrow({where:{id:pending.id}})).status==='APPROVED','lost response still committed approval');
  await click('Chấp thuận và bàn giao');await wait('document.querySelector(".coordination-panel")?.textContent.includes("Thao tác đã được ghi nhận trước đó")');
  check(await evaluate('window.__coordinationBodies.length===2&&window.__coordinationBodies[0].clientRequestId===window.__coordinationBodies[1].clientRequestId'),'approval retry preserves UUID');
  check(await h.db.applicationAssignment.count({where:{applicationId:uiLoan.id}})===1,'browser creates one handover history');await screenshot('round2-03-manager-approval-retry');
  // Original officer opens the receipt from notification, without current case access.
  await login(a.user.username);await evaluate('document.querySelector(".notification-trigger").click()');
  await wait(`[...document.querySelectorAll('.notification-item')].some(e=>e.textContent.includes(${JSON.stringify(uiLoan.applicationCode)})&&e.textContent.includes('đã có kết quả'))`);
  await evaluate(`[...document.querySelectorAll('.notification-item')].find(e=>e.textContent.includes(${JSON.stringify(uiLoan.applicationCode)})&&e.textContent.includes('đã có kết quả')).click()`);
  await wait(`document.querySelector('[aria-label="Biên nhận điều phối"]')&&document.querySelector('.coordination-panel')?.textContent.includes('quyền xử lý hồ sơ hiện tại thuộc người được phân công')`);
  await evaluate('Promise.all(document.querySelector(".modal-overlay").getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))');
  check(await evaluate('document.querySelector(".coordination-panel").textContent.includes("quyền xử lý hồ sơ hiện tại thuộc người được phân công")'),'old officer sees limited receipt');await screenshot('round2-04-former-officer-receipt');
  await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await screenshot('round2-05-receipt-mobile');check(await evaluate('document.querySelector(".modal-content").getBoundingClientRect().width<=innerWidth+2'),'receipt modal fits mobile');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await openLoan(b.user.username,uiLoan);await wait('document.querySelector(".coordination-history")');await evaluate('document.querySelector(".coordination-history").open=true');
  check(await evaluate('document.querySelector(".coordination-history").textContent.includes("Synthetic manager assigns independent officer")'),'new officer sees handover reason/history');
  check(!await evaluate('document.querySelector(".modal-content").textContent.includes("Synthetic private conflict reported by original officer")'),'new officer is not given original private request text');await screenshot('round2-06-current-officer-history');
  await staffOpen(a.user.username,uiPortal.reference);await input('textarea[aria-label="Lý do đề nghị điều phối"]','Synthetic Portal workload request');await click('Gửi đề nghị điều phối');await wait('document.querySelector(".coordination-panel")?.textContent.includes("Chờ quản lý xử lý")');
  await managerQueue(uiPortal.reference);await input('textarea[aria-label="Căn cứ quyết định điều phối"]','Synthetic manager confirms sender can continue');
  check(await evaluate('[...document.querySelectorAll(".coordination-decision button")].find(b=>b.textContent.includes("Không chấp thuận")).disabled'),'ordinary rejection requires ability confirmation');
  await evaluate('document.querySelector(".coordination-decision input[type=checkbox]").click()');await click('Không chấp thuận điều phối');await wait('document.querySelector(".coordination-panel")?.textContent.includes("Không chấp thuận điều phối.")');
  check((await h.db.portalRequest.findUniqueOrThrow({where:{id:uiPortal.id}})).assignedTo===a.user.id,'Portal rejection leaves owner unchanged');await screenshot('round2-07-portal-rejection');
  // Fault injection at the dependency only: real browser/API/DB handover remains real.
  const mlLoan=await f.loan(),{AssignmentsService}=require('./dist/modules/assignments/assignments.service'),service=h.app.get(AssignmentsService),original=service.predictionService.predictForApplication;
  try{
    service.predictionService.predictForApplication=async()=>{throw Error('Synthetic unavailable prediction');};
    await login(manager.user.username);await evaluate('document.querySelector("button[data-tab=assignments]").click()');await wait(`[...document.querySelectorAll('.assignments-view tbody tr')].some(r=>r.textContent.includes(${JSON.stringify(mlLoan.applicationCode)})&&r.querySelector('button')&&!r.querySelector('button').disabled)`);
    await evaluate(`[...document.querySelectorAll('.assignments-view tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(mlLoan.applicationCode)})).querySelector('button').click()`);await input('.modal-content select',b.user.id);await input('.modal-content textarea','Synthetic direct handover with ML failure');await click('Xác nhận Điều chuyển');await wait('!document.querySelector(".modal-content")&&document.querySelector(".assignments-view")?.textContent.includes("chưa cập nhật được dự báo")');
    check((await h.db.loanApplication.findUniqueOrThrow({where:{id:mlLoan.id}})).assignedTo===b.user.id,'truthful ML failure does not undo successful transfer');await screenshot('round2-08-truthful-prediction-failure');
  }finally{service.predictionService.predictForApplication=original;}
  const linked=await h.db.portalRequest.findFirstOrThrow({where:{status:'ACCEPTED',loan:{currentStage:'TIEP_NHAN',assignedTo:a.user.id}}});
  const linkedLoan=await h.db.loanApplication.findUniqueOrThrow({where:{id:linked.loanId}});
  assert.equal((await f.call(`/assignments/${linkedLoan.id}/reassign`,manager,{newOfficerId:b.user.id,reason:'Synthetic current owner projection',expectedAssignmentVersion:linkedLoan.assignmentVersion,clientRequestId:randomUUID()})).status,201);
  await staffOpen(manager.user.username,linked.reference);
  check(await evaluate('document.querySelector(".intake-assignment").textContent.includes("CBTD đang phụ trách hồ sơ vay")'),'accepted intake clearly identifies current Loan owner');await screenshot('round2-09-linked-current-owner');
}
