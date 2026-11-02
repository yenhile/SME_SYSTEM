// Extra acceptance checks run by check-sme-rollout-browser.mjs --round1.
// All accounts, loans, uploads and mail belong to the runner-owned schema/inbox.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export async function runRound1Checks(ctx){
  const {h,f,officer,site,port,page,connection,evaluate,wait,input,click,navigate,screenshot,api,check,evidence,require,sleep}=ctx;
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  const accountA=await h.db.portalAccount.findUniqueOrThrow({where:{email:f.portalEmail}});
  const accountB=await h.db.portalAccount.create({data:{email:'round1-other-'+randomUUID()+'@example.test',contactName:'Synthetic second account',phone:'0900000000',verifiedAt:new Date(),passwordHash:await require('bcryptjs').hash(f.password,4)}});
  const loginB=await api('/portal/auth/login',{}, {email:accountB.email,password:f.password});
  const marker='PRIVATE UNSENT CONTENT OF ACCOUNT A';await input('#v2-companyName',marker);
  const created=await page.send('Target.createTarget',{url:site+'/portal'});let other;
  try{
    let target;for(let i=0;i<50;i++){target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.id===created.targetId);if(target)break;await sleep(100);}
    other=connection(target.webSocketDebuggerUrl);await other.ready;
    for(let i=0;i<50;i++){const r=await other.send('Runtime.evaluate',{expression:'location.origin',returnByValue:true});if(r.result.value===site)break;await sleep(100);}
    await other.send('Runtime.evaluate',{expression:'localStorage.setItem("sme_portal_token",'+JSON.stringify(loginB.accessToken)+')'});
    await wait('document.querySelector(".portal-auth")&&document.body.innerText.includes("tab khác")','old account context closed');
    check(await h.db.portalRequest.count({where:{accountId:accountB.id}})===0,'cross-tab change cannot create account A draft under B');
    check(await evaluate('Object.keys(sessionStorage).filter(k=>k.startsWith('+JSON.stringify('sme_portal_v2:'+accountA.id+':')+')).some(k=>sessionStorage.getItem(k).includes('+JSON.stringify(marker)+'))'),'private recovery retained under A');
    check(await evaluate('localStorage.getItem("sme_portal_token")==='+JSON.stringify(loginB.accessToken)),'B token retained');
    await screenshot('r1-cross-tab-protected');
  }finally{other?.close();await page.send('Target.closeTarget',{targetId:created.targetId});}
  const raceToken=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
  await h.db.portalAccount.update({where:{id:accountB.id},data:{passwordResetHash:createHash('sha256').update(raceToken).digest('hex'),passwordResetExpiresAt:new Date(Date.now()+600000)}});
  const race=await Promise.all([1,2].map(()=>fetch(h.base+'/portal/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:raceToken,password:'RacePassword234!',confirmPassword:'RacePassword234!'})})));
  check(JSON.stringify(race.map(r=>r.status).sort())===JSON.stringify([201,400]),'real PostgreSQL allows exactly one concurrent reset');

  // Locked record always uses server contents, even with a stale private recovery.
  const published=await h.db.portalRequest.findUniqueOrThrow({where:{id:h.expandedFixtures[0].id}}),local='LOCAL RECOVERY IS NOT THE SUBMITTED COMPANY';
  await evaluate('localStorage.setItem("sme_portal_token",'+JSON.stringify(f.portalToken)+');sessionStorage.setItem('+JSON.stringify('sme_portal_v2_active:'+accountA.id)+','+JSON.stringify(published.id)+');sessionStorage.setItem('+JSON.stringify('sme_portal_v2:'+accountA.id+':'+published.id)+','+JSON.stringify(JSON.stringify({data:{...published.data,companyName:local},baseRevision:published.revision-1,step:1,updatedAt:new Date().toISOString(),conflict:true}))+')');
  await navigate(site+'/portal');await wait('document.querySelector("#v2-companyName")');
  check(await evaluate('document.querySelector("#v2-companyName").value==='+JSON.stringify(published.data.companyName)),'locked record displays server value');
  check(await evaluate('document.querySelector(".v2-retained-recovery")?.textContent.includes('+JSON.stringify(local)+')'),'local recovery shown separately');
  check(!await evaluate('!!document.querySelector(".v2-conflict")'),'locked recovery cannot activate editable conflict');
  await screenshot('r2-server-and-private-recovery');
  await evaluate('sessionStorage.removeItem('+JSON.stringify('sme_portal_v2_active:'+accountA.id)+');sessionStorage.removeItem('+JSON.stringify('sme_portal_v2:'+accountA.id+':'+published.id)+')');
  await navigate(site+'/portal');await click('Tạo đề nghị vay');await click('Tiếp tục');await wait('document.querySelector("#v2-loanType")');
  const products=await evaluate('[...document.querySelector("#v2-loanType").options].map(o=>o.value).filter(Boolean)');check(JSON.stringify(products)===JSON.stringify(['VAY_VON_LUU_DONG']),'new V2 offers only supported products');
  await screenshot('r3-supported-products');

  // Exercise the actual upload/replace/withdraw controls with a valid synthetic PDF.
  const uploadDraft=await api('/portal/requests',{token:f.portalToken},{formVersion:2,clientRequestId:randomUUID(),data:h.browserData});
  await evaluate('sessionStorage.setItem('+JSON.stringify('sme_portal_v2_active:'+accountA.id)+','+JSON.stringify(uploadDraft.id)+')');await navigate(site+'/portal');await wait('document.querySelector("#v2-companyName")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Hồ sơ tài liệu")).click()');await wait('document.querySelector(".portal-document-manager")');
  await input('select[aria-label="Loại tài liệu 1"]','A_BUSINESS_REGISTRATION');const file=path.join(evidence,'synthetic-upload.pdf');await fs.writeFile(file,h.browserPdf);
  async function chooseFile(){const dom=await page.send('DOM.getDocument'),node=await page.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'.portal-upload-editor input[type=file]'});await page.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});await wait('document.querySelector(".portal-upload-queue")');await click('Tải các tệp đang chờ');await wait('!document.querySelector(".portal-upload-queue")');}
  await chooseFile();const first=await h.db.portalDocument.findFirstOrThrow({where:{requestId:uploadDraft.id}});await click('Thay thế');await chooseFile();
  const docs=await h.db.portalDocument.findMany({where:{requestId:uploadDraft.id},orderBy:{version:'asc'}});check(docs.length===2&&docs[1].supersedesId===first.id,'replacement preserves previous document');
  await click('Rút tài liệu');await wait('document.body.innerText.includes("Đã rút khỏi hồ sơ hiện hành")');check(!!(await h.db.portalDocument.findUnique({where:{id:docs[1].id}})).withdrawnAt,'withdrawal is persisted');

  const smtpKeys=['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER'],saved=Object.fromEntries(smtpKeys.map(k=>[k,process.env[k]]));
  const inbox=await require('./scripts/dev-mailbox.cjs').startMailbox({smtpPort:0,httpPort:0});let completeFlow;
  try{
    Object.assign(process.env,{SMTP_HOST:'127.0.0.1',SMTP_PORT:'1',SMTP_SECURE:'false'});delete process.env.SMTP_USER;
    const freshEmail='round1-flow-'+randomUUID()+'@example.test';
    await evaluate('localStorage.removeItem("sme_portal_token")');await navigate(site+'/portal');await click('Tạo tài khoản doanh nghiệp');
    await input('.portal-auth input[type=email]',freshEmail);await input('.portal-auth input[type=password]',f.password);
    await input('.portal-auth input:not([type])','Synthetic full flow');await input('.portal-auth input[type=tel]','0900000000');await click('Đăng ký');
    await wait('document.querySelector(".portal-auth h2")?.textContent==="Xác minh email"&&document.querySelector(".portal-auth [role=alert]")');
    check(await evaluate('document.querySelector(".portal-auth input[type=email]").value==='+JSON.stringify(freshEmail)),'SMTP failure retains email and opens recovery');
    const pending=await h.db.portalAccount.findUniqueOrThrow({where:{email:freshEmail}});check(pending.verificationHash===null&&!pending.verifiedAt,'SMTP failure leaves pending account with no unusable OTP');
    const duplicate=await api('/portal/auth/register',{}, {email:freshEmail,password:f.password,contactName:'Synthetic full flow',phone:'0900000000'});check(!duplicate.message.includes('được tạo'),'duplicate registration makes no false creation claim');
    await screenshot('r4-email-delivery-failure');process.env.SMTP_PORT=String(inbox.smtpPort);
    await click('Gửi lại mã xác minh');await wait('document.querySelector(".portal-auth [role=status]")');
    const messages=await(await fetch('http://127.0.0.1:'+inbox.httpPort+'/api/messages')).json(),mail=messages.find(m=>m.to.includes(freshEmail));assert.ok(mail);
    const code=mail.text.match(/\b\d{6}\b/)[0];await input('.portal-auth input[autocomplete=one-time-code]',code);await click('Xác minh email','.portal-auth form button');await wait('document.querySelector(".portal-auth h2")?.textContent==="Đăng nhập doanh nghiệp"');
    const freshLogin=await api('/portal/auth/login',{}, {email:freshEmail,password:f.password}),owner={token:freshLogin.accessToken};
    const beforeReset=await api('/portal/requests',owner,{formVersion:2,clientRequestId:randomUUID(),data:{companyName:'Existing draft before reset'}});
    // Password reset is exercised in the browser, while API verifies revocation and ownership.
    await click('Quên mật khẩu?');await input('.portal-auth input[type=email]',freshEmail);await click('Gửi liên kết đặt lại');await wait('document.querySelector(".portal-auth [role=status]")');
    let resetMail;for(let i=0;i<100;i++){resetMail=(await(await fetch('http://127.0.0.1:'+inbox.httpPort+'/api/messages')).json()).find(m=>m.to.includes(freshEmail)&&m.text.includes('?reset='));if(resetMail)break;await sleep(100);}assert.ok(resetMail);
    const token=resetMail.text.match(/[?&]reset=([a-f0-9]{64})/)[1],stored=await h.db.portalAccount.findUniqueOrThrow({where:{email:freshEmail}});
    check(stored.passwordResetHash===createHash('sha256').update(token).digest('hex'),'DB contains only reset token hash');
    // The application deliberately replaces the URL immediately to remove its token.
    await page.send('Page.navigate',{url:site+'/portal?reset='+token});await wait('document.querySelector(".portal-auth h2")?.textContent==="Đặt lại mật khẩu"&&document.readyState==="complete"');
    check(await evaluate('!location.search.includes("reset=")'),'reset token removed from browser URL');
    const newPassword='Round1NewPassword456!';await input('.portal-auth label:nth-child(1) input',newPassword);await input('.portal-auth label:nth-child(2) input',newPassword);await screenshot('r5-reset-form');await click('Đặt lại mật khẩu','.portal-auth form button');
    await wait('document.querySelector(".portal-auth h2")?.textContent==="Đăng nhập doanh nghiệp"&&document.querySelector(".portal-auth [role=status]")');
    const expired=await fetch(h.base+'/portal/requests',{headers:{Authorization:'Bearer '+owner.token}});check(expired.status===401,'old portal JWT revoked after reset');
    const reused=await fetch(h.base+'/portal/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:newPassword,confirmPassword:newPassword})});check(reused.status===400,'reset link cannot be reused');
    await input('.portal-auth input[type=email]',freshEmail);await input('.portal-auth input[type=password]',newPassword);await click('Đăng nhập');await wait('document.querySelector(".portal-request-list")');
    const freshNewLogin=await api('/portal/auth/login',{}, {email:freshEmail,password:newPassword});owner.token=freshNewLogin.accessToken;
    check(freshNewLogin.account.id===freshLogin.account.id,'reset retains the same account');
    const afterReset=await api('/portal/requests/'+beforeReset.id,owner);check(afterReset.data.companyName==='Existing draft before reset','new login retains access to pre-reset application');
    await page.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await screenshot('r5-mobile-signed-in');check(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'recovery flow mobile fits viewport');
    completeFlow=await submitToDecision(ctx,owner);
    await fs.writeFile(path.join(evidence,'round1-acceptance.json'),JSON.stringify({pass:true,crossTab:true,canonicalLockedRecord:true,supportedProducts:products,smtpRecovery:true,singleUseReset:true,oldPortalSessionRevoked:true,documentUi:true,completeFlow,recoveryMigrationRepeated:2,publicDataModified:false},null,2));
  }finally{await inbox.close();for(const k of smtpKeys)saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k];}
}

async function submitToDecision(ctx,owner){
  const {h,f,officer,api,check}=ctx;
  const data={...h.browserData,taxCode:'900'+String(Date.now()).slice(-10),annualRevenueBasis:undefined};
  let request=await api('/portal/requests',owner,{formVersion:2,clientRequestId:randomUUID(),data});
  const coverage={A:['A_BUSINESS_REGISTRATION','A_CHARTER','A_REPRESENTATIVE_AUTHORITY','A_REPRESENTATIVE_ID'].map(documentTypeCode=>({documentTypeCode})),B:[{documentTypeCode:'B_FINANCIAL_STATEMENTS',period:data.revenuePeriod,components:['BALANCE_SHEET','INCOME_STATEMENT','CASH_FLOW_STATEMENT','NOTES']}],C:['C_PRODUCTION_PLAN','C_BUSINESS_CONTRACT'].map(documentTypeCode=>({documentTypeCode})),D:['D_LOAN_REQUEST','D_CAPITAL_PLAN'].map(documentTypeCode=>({documentTypeCode}))};
  for(const [group,metadata] of Object.entries(coverage)){const form=new FormData();form.append('file',new Blob([h.browserPdf],{type:'application/pdf'}),'full-flow-'+group+'.pdf');form.append('documentGroup',group);form.append('coverage',JSON.stringify(metadata));form.append('clientUploadId',randomUUID());form.append('expectedRevision',String(request.revision));request=await api('/portal/requests/'+request.id+'/documents',owner,form);}
  const source=request.documents.find(d=>d.documentGroup==='B');request=await api('/portal/requests/'+request.id,owner,{data:{...request.data,annualRevenueBasis:{documentId:source.id,fullYearCompleted:true}},expectedRevision:request.revision},'PUT');
  const {navigate,evaluate,input,click,wait,screenshot,site}=ctx;
  const principal=await api('/portal/auth/me',owner);
  await evaluate('sessionStorage.setItem('+JSON.stringify('sme_portal_v2_active:'+principal.id)+','+JSON.stringify(request.id)+')');await navigate(site+'/portal');await wait('document.querySelector("#v2-companyName")');
  const privateName='LOCAL EDIT WHILE OTHER SESSION SUBMITS';await input('#v2-companyName',privateName);
  request=await api('/portal/requests/'+request.id+'/submit',owner,{expectedRevision:request.revision,documentIds:request.documents.map(d=>d.id)});
  await click('Lưu nháp');await wait('document.querySelector(".v2-conflict")');await click('Xem bản mới nhất');await wait('document.querySelector(".v2-compare")');
  check(!await evaluate('[...document.querySelectorAll(".v2-conflict button")].some(b=>b.textContent.includes("Giữ nội dung"))'),'remote submitted record cannot offer saving local edits');
  await click('Dùng bản trên hệ thống');await wait('!document.querySelector(".v2-conflict")&&document.querySelector(".v2-retained-recovery")');
  check(await evaluate('document.querySelector("#v2-companyName").value==='+JSON.stringify(request.data.companyName)),'conflict resolution uses server data when remote becomes locked');
  check(await evaluate('document.querySelector(".v2-retained-recovery").textContent.includes('+JSON.stringify(privateName)+')'),'conflict resolution retains unsent private edit separately');
  await screenshot('r2-remote-submitted-during-edit');
  const manager={token:f.managerToken,role:'QUAN_LY'};request=await api('/portal-intakes/'+request.id+'/assign',manager,{officerId:f.officerId,expectedAssignedTo:null,expectedRevision:request.revision});
  const cycle=await api('/portal-intakes/'+request.id+'/intake-cycle',officer);
  for(const item of cycle.checklist)request=await api('/portal-intakes/'+request.id+'/review',officer,{expectedRevision:request.revision,clientRequestId:randomUUID(),submissionId:cycle.currentSubmissionId,itemId:item.id,decision:'ACCEPTED'});
  const intake=await api('/portal-intakes/'+request.id+'/accept',officer,{expectedRevision:request.revision,submissionId:cycle.currentSubmissionId});
  await api('/loan-applications/'+intake.loanId+'/set-amount',officer,{officialAmount:data.proposedAmount},'PUT');await api('/loan-applications/'+intake.loanId+'/check-documents',officer,{isComplete:true},'PUT');
  const reportPath='/appraisals/'+intake.loanId,operation=(r,extra={})=>({expectedRevision:r?.revision??0,clientRequestId:randomUUID(),...extra});
  let report=await api(reportPath+'/draft',officer,operation(null,{content:f.content}),'PUT');report=await api(reportPath+'/submit',officer,operation(report));
  const login=await api('/auth/login',{}, {username:f.approverUsername,password:f.password}),reviewer={token:login.accessToken,role:'THAM_QUYEN'};
  report=await api(reportPath+'/clarify',reviewer,operation(report,{message:'Synthetic clarification for full round1 flow'}));report=await api(reportPath+'/draft',officer,operation(report,{content:{...f.content,repaymentSource:'Clarified synthetic full-flow source'}}),'PUT');report=await api(reportPath+'/submit',officer,operation(report));
  await api('/workflow/'+intake.loanId+'/transition',reviewer,{targetStage:'HOAN_TAT',targetStatus:'APPROVED',approvedAmount:data.proposedAmount,interestRate:8,reportVersionId:report.versions[0].id});
  const tracking=await api('/portal/requests/'+request.id+'/status',owner),final=await h.db.loanApplication.findUniqueOrThrow({where:{id:intake.loanId}});
  check(final.currentStatus==='APPROVED'&&tracking.status.code==='APPROVED'&&report.versions.length===2,'new signup through clarified report and final approval');
  return{requestId:request.id,loanId:intake.loanId,proposedAmount:data.proposedAmount,portalStatus:tracking.status.code,reportVersions:2};
}
