import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function runPackageAChecks(ctx){
  const {h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,check}=ctx;
  const {manager,a,b,c,loan,request,call}=h.assignmentSafetyFixture;
  const transfer=(target,version)=>call(`/assignments/${loan.id}/reassign`,manager,{newOfficerId:target,expectedAssignmentVersion:version,clientRequestId:randomUUID(),reason:'Synthetic second manager screen'});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate(site+'/');await evaluate('localStorage.removeItem("sme_token");localStorage.removeItem("sme_active_role")');await navigate(site+'/?package_a='+randomUUID());
  await input('.login-card input[autocomplete=username]',manager.user.username);await input('.login-card input[type=password]',h.rolloutFixture.password);await click('Đăng nhập');await wait('document.querySelector(".account-trigger")');
  await evaluate('document.querySelector("button[data-tab=assignments]").click()');
  async function open(){
    await wait(`[...document.querySelectorAll('.assignments-view tbody tr')].some(r=>r.textContent.includes(${JSON.stringify(loan.applicationCode)})&&r.querySelector('button')&&!r.querySelector('button').disabled)`,'ready assignment row');
    await evaluate(`(()=>{const row=[...document.querySelectorAll('.assignments-view tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(loan.applicationCode)}));row.querySelector('button').click();})()`);
    await wait('document.querySelector(".modal-content select")');
    await evaluate('Promise.all(document.querySelector(".modal-overlay").getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))');
  }
  await open();
  check(await evaluate('document.querySelector(".modal-content select").value===""'),'recipient requires explicit selection');
  await input('.modal-content select',c.user.id);await input('.modal-content textarea','   ');
  check(await evaluate('document.querySelector(".modal-content button[type=submit]").disabled'),'whitespace reason disabled in UI');
  await input('.modal-content textarea','Synthetic stale manager screen');assert.equal((await transfer(b.user.id,0)).status,201);
  await click('Xác nhận Điều chuyển');await wait('document.querySelector(".modal-content [role=alert]")');
  check(await evaluate('document.querySelector(".modal-content button[type=submit]").disabled'),'stale form cannot silently resubmit');
  check((await h.db.loanApplication.findUniqueOrThrow({where:{id:loan.id}})).assignedTo===b.user.id,'stale UI preserves committed owner');
  await screenshot('package-a-01-conflict');await click('Tải lại phân công');await wait('!document.querySelector(".modal-content [role=alert]")');
  check(await evaluate(`document.querySelector('.modal-content').textContent.includes(${JSON.stringify(b.user.username)})&&document.querySelector('.modal-content select').value===''`),'reload shows current owner and clears old choice');
  await input('.modal-content select',c.user.id);await input('.modal-content textarea','Synthetic explicit reconfirmation');await click('Xác nhận Điều chuyển');await wait('!document.querySelector(".modal-content")');
  check((await h.db.loanApplication.findUniqueOrThrow({where:{id:loan.id}})).assignedTo===c.user.id,'explicit reconfirmation commits against fresh version');

  // Real API commits, then only its response is hidden from this browser once.
  await open();await input('.modal-content select',a.user.id);await input('.modal-content textarea','Synthetic lost response retry');
  await evaluate(`(()=>{const original=window.fetch;window.__assignmentBodies=[];window.__dropAssignment=true;window.fetch=async(...args)=>{const [url,options]=args;const selected=String(url).includes('/assignments/${loan.id}/reassign')&&options?.method==='POST';if(selected)window.__assignmentBodies.push(JSON.parse(options.body));const r=await original(...args);if(selected&&window.__dropAssignment){window.__dropAssignment=false;throw new TypeError('Synthetic response lost after commit');}return r;};})()`);
  await click('Xác nhận Điều chuyển');await wait('document.querySelector(".modal-content")?.textContent.includes("Không kết nối được máy chủ")');
  const history=await h.db.applicationAssignment.count({where:{applicationId:loan.id}});
  check((await h.db.loanApplication.findUniqueOrThrow({where:{id:loan.id}})).assignedTo===a.user.id,'lost response still committed exactly once');
  await click('Xác nhận Điều chuyển');await wait('!document.querySelector(".modal-content")');
  check(await evaluate('window.__assignmentBodies.length===2&&window.__assignmentBodies[0].clientRequestId===window.__assignmentBodies[1].clientRequestId'),'network retry preserves operation UUID');
  check(await h.db.applicationAssignment.count({where:{applicationId:loan.id}})===history,'browser retry creates no extra handover');
  await screenshot('package-a-02-retry-receipt');
  await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await open();await screenshot('package-a-03-modal-mobile');
  check(await evaluate('document.querySelector(".modal-content").getBoundingClientRect().width<=innerWidth+2'),'assignment modal fits mobile viewport');await click('Hủy');

  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await staffOpen(manager.user.username,request.reference);
  await input('.intake-assignment select',a.user.id);await input('.intake-assignment textarea','Synthetic stale Portal choice');
  const command={officerId:c.user.id,expectedAssignedTo:b.user.id,expectedAssignmentVersion:request.assignmentVersion,clientRequestId:randomUUID(),note:'Synthetic second Portal manager'};
  assert.equal((await call(`/portal-intakes/${request.id}/assign`,manager,command)).status,201);
  await click('Điều chuyển đề nghị');await wait('document.querySelector(".intake-assignment")?.textContent.includes("Tải lại phân công")');
  check(await evaluate('document.querySelector(".intake-assignment-form button").disabled'),'Portal stale choice also requires reload');
  await click('Tải lại phân công');await wait(`document.querySelector('.intake-assignment select')?.value===${JSON.stringify(c.user.id)}`);
  await input('.intake-assignment select',a.user.id);await input('.intake-assignment textarea','Synthetic Portal lost response');
  await evaluate(`(()=>{const original=window.fetch;window.__portalBodies=[];window.__dropPortal=true;window.fetch=async(...args)=>{const [url,options]=args;const selected=String(url).includes('/portal-intakes/${request.id}/assign')&&options?.method==='POST';if(selected)window.__portalBodies.push(JSON.parse(options.body));const r=await original(...args);if(selected&&window.__dropPortal){window.__dropPortal=false;throw new TypeError('Synthetic Portal response lost');}return r;};})()`);
  await click('Điều chuyển đề nghị');await wait('document.querySelector(".intake-assignment")?.textContent.includes("Không kết nối được máy chủ")');
  const portalHistory=await h.db.portalAssignment.count({where:{requestId:request.id}});
  await click('Điều chuyển đề nghị');await wait('document.querySelector(".intake-assignment")?.textContent.includes("Thao tác đã được ghi nhận")');
  check(await evaluate('window.__portalBodies.length===2&&window.__portalBodies[0].clientRequestId===window.__portalBodies[1].clientRequestId'),'Portal network retry preserves UUID');
  check(await h.db.portalAssignment.count({where:{requestId:request.id}})===portalHistory,'Portal browser retry creates no duplicate history');
  check(await evaluate(`document.querySelector('.intake-assignment select').value===${JSON.stringify(a.user.id)}&&document.querySelector('.intake-assignment-form button').disabled`),'saved Portal form cannot immediately repeat old target');
  await screenshot('package-a-04-portal-retry');
}
