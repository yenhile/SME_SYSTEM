export async function runRound3BrowserChecks(ctx){
 const {h,site,page,evaluate,wait,input,click,navigate,screenshot,staffOpen,portalOpen,check}=ctx;
 const f=h.round3Fixture,a=h.round3Actions;
 const has=selector=>'document.querySelector('+JSON.stringify(selector)+')';
 async function shot(name,selector){await evaluate('document.querySelector('+JSON.stringify(selector)+')?.scrollIntoView({block:"center"})');await screenshot(name);}
 const prior=h.browserFixture;h.browserFixture={...prior,password:f.password,portalEmail:f.portalEmail};
 async function record(){return h.db.portalRequest.findUniqueOrThrow({where:{id:f.requestId},include:{documents:{where:{withdrawnAt:null,nextVersion:{is:null}}}}});}
 async function enterprise(){await navigate(site+'/portal');await evaluate('localStorage.clear();sessionStorage.clear()');await portalOpen(f.reference);await wait('document.querySelector(".intake-cycle")');}
 try{
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await staffOpen(f.officerUsername,f.reference);
  await wait(has('textarea[aria-label="Lý do xử lý đề nghị xin sửa"]'));
  check(await evaluate('document.querySelector(".intake-cycle").textContent.includes("chưa thể tiếp nhận")'),'pending correction shown to officer');
  await input('textarea[aria-label="Lý do xử lý đề nghị xin sửa"]','Original information remains correct');await click('Không đồng ý trả sửa');
  await wait('document.querySelector(".intake-cycle").textContent.includes("Không đồng ý trả sửa.")');
  check((await record()).correctionRequest.status==='REJECTED','officer decision persisted');
  await shot('round3-01-officer-correction-decision','.intake-cycle');
  await enterprise();await wait('!!document.querySelector(".intake-cycle textarea")');
  await input('.intake-cycle textarea','Please permit correction of declared data');await click('Đề nghị ngân hàng cho chỉnh sửa');
  await wait('document.querySelector(".intake-cycle").textContent.includes("Đang chờ CBTD xử lý")');
  check((await record()).correctionRequest.status==='PENDING','enterprise can submit correction through UI');
  await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
  await shot('round3-02-enterprise-pending-mobile','.intake-cycle .portal-notice');check(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'enterprise correction fits mobile');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await staffOpen(f.officerUsername,f.reference);await wait(has('textarea[aria-label="Lý do xử lý đề nghị xin sửa"]'));
  await input('textarea[aria-label="Lý do xử lý đề nghị xin sửa"]','Return declared information for enterprise verification');await click('Đồng ý và trả sửa');
  await wait('document.querySelector(".intake-cycle").textContent.includes("Doanh nghiệp đang chỉnh sửa")');
  check((await record()).status==='RETURNED','UI approval opens data correction');
  let r=await record();r=a.expect(await a.call('/portal/requests/'+r.id+'/submit',a.portal,{expectedRevision:r.revision,documentIds:r.documents.map(d=>d.id)}),201,'UI scenario real resubmit');await a.reviewAll(r);
  await staffOpen(f.officerUsername,f.reference);await wait('[...document.querySelectorAll(".intake-cycle button")].some(b=>b.textContent.includes("Đối chiếu dữ liệu Company"))');
  await click('Đối chiếu dữ liệu Company');await wait(has('textarea[aria-label="Căn cứ đề nghị đối soát"]'));
  await input('textarea[aria-label="Căn cứ đề nghị đối soát"]','Submitted annual evidence is verified; Company is outdated');await click('Gửi đối soát Company');
  await wait('document.querySelector(".intake-cycle").textContent.includes("Đối soát Company")&& !'+has('textarea[aria-label="Căn cứ đề nghị đối soát"]'));
  check(await h.db.portalIntakeIssue.count({where:{requestId:f.requestId,status:'OPEN',kind:'COMPANY_RECONCILIATION'}})===1,'UI creates one scoped reconciliation');await shot('round3-03-officer-reconciliation','.intake-cycle section[aria-label]');
  await staffOpen(f.managerUsername,f.reference);await wait(has('textarea[aria-label="Căn cứ quyết định đối soát"]'));
  check(!await evaluate('[...document.querySelectorAll(".intake-cycle button")].some(b=>b.textContent==="Kiểm tra đạt")'),'manager cannot perform officer review');
  await input('textarea[aria-label="Căn cứ quyết định đối soát"]','Verified the submitted source; approve separate Company correction');await shot('round3-04-manager-reconciliation','textarea[aria-label="Căn cứ quyết định đối soát"]');await click('Xác nhận đối soát và cập nhật Company');
  await wait('!'+has('textarea[aria-label="Căn cứ quyết định đối soát"]')+'&&document.querySelector(".intake-cycle").textContent.includes("Đã xử lý")');
  r=await record();check(Number((await h.db.company.findUnique({where:{taxCode:r.data.taxCode}})).annualRevenue)===0,'UI manager decision updates only verified Company values');
  await staffOpen(f.officerUsername,f.reference);await wait('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Kiểm tra doanh nghiệp để tiếp nhận")&&!b.disabled)');await click('Kiểm tra doanh nghiệp để tiếp nhận');
  await wait('document.querySelector(".portal-intake-match input")');
  await evaluate('[...document.querySelectorAll(".portal-intake label")].find(l=>l.textContent.includes("Tôi xác nhận dùng doanh nghiệp")).querySelector("input").click()');
  await evaluate('[...document.querySelectorAll(".portal-intake label")].find(l=>l.textContent.includes("Tôi đã đối chiếu nguồn và kỳ tài chính")).querySelector("input").click()');
  await wait('[...document.querySelectorAll("button")].some(b=>b.textContent==="Tiếp nhận thành hồ sơ vay"&&!b.disabled)');await click('Tiếp nhận thành hồ sơ vay');
  await wait('!!document.querySelector(".modal-content")');r=await record();check(r.status==='ACCEPTED'&&!!r.loanId,'UI receives reconciled request into one loan');
  check((await h.db.loanApplication.findUnique({where:{id:r.loanId}})).currentStatus==='RECEIVED','UI receive persisted correct initial status');await screenshot('round3-05-received');
  await enterprise();await wait('document.querySelector(".intake-cycle").textContent.includes("Đã tiếp nhận")');check(await evaluate('document.querySelector(".intake-cycle").textContent.includes("Lịch sử xử lý đề nghị xin sửa")'),'enterprise sees retained correction history');
  await shot('round3-06-enterprise-accepted','.intake-cycle');
 }finally{h.browserFixture=prior;}
}
