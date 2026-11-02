import {useEffect,useRef,useState} from 'react';
import {api} from '../api/client';
import {portalApi} from './client';
import {DocumentLink} from './DocumentLink';
import type {PortalDocument,PortalRequest} from './model';

type Item={id:string;label:string;documentIds:string[];guidance?:string;reviewCriteria?:string[];review:null|{decision:string;message:string}};
type Submission={id:string;sequence:number;submittedAt:string;returnedAt?:string;returnItems:{itemId:string;label:string;message:string}[];snapshot:{data:Record<string,unknown>;documents:PortalDocument[]};changes:{fields:string[];addedDocuments:string[];removedDocuments:string[]}};
type Correction={message:string;requestedAt:string;status?:'PENDING'|'APPROVED'|'REJECTED';resolution?:string;resolvedAt?:string};
export type IntakeCycleView={requestId:string;revision:number;status:string;currentSubmissionId:string|null;canAccept:boolean;checklist:Item[];submissions:Submission[];correctionRequest?:Correction;correctionHistory?:Correction[];issues:{id:string;status:string;publicMessage:string;description?:string;proposal?:string;resolution?:string;kind?:string;context?:{before?:Record<string,unknown>;proposed?:Record<string,unknown>;decision?:string}}[]};
const names:Record<string,string>={annualRevenue:'Doanh thu',annualRevenueBasis:'Nguồn doanh thu',revenuePeriod:'Kỳ báo cáo',companyName:'Tên doanh nghiệp',taxCode:'Mã số thuế',representative:'Người gửi',representativeName:'Người đại diện',capitalPlan:'Phương án vốn',loanPurpose:'Mục đích vay',collateral:'Bảo đảm',hasExistingDebt:'Dư nợ',submissionDeclaration:'Cam kết',industry:'Ngành nghề',charterCapital:'Vốn điều lệ',proposedAmount:'Số tiền đề nghị',loanTermMonths:'Thời hạn vay'};

export function IntakeCyclePanel({request,mode,activeRole,onUpdated,onState}:{request:PortalRequest;mode:'portal'|'staff';activeRole?:string|null;onUpdated:(r:PortalRequest)=>void;onState?:(v:IntakeCycleView|null)=>void}) {
  const [view,setView]=useState<IntakeCycleView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[messages,setMessages]=useState<Record<string,string>>({}),[correction,setCorrection]=useState('');
  const [description,setDescription]=useState(''),[proposal,setProposal]=useState(''),[publicMessage,setPublicMessage]=useState(''),[resolutions,setResolutions]=useState<Record<string,string>>({});
  const [decisionReason,setDecisionReason]=useState(''),[dataCorrection,setDataCorrection]=useState('');
  const [companyMatch,setCompanyMatch]=useState<{found:boolean;companyHash:string|null;company?:Record<string,unknown>;financialReadiness?:{compatible:boolean;differences:string[];message:string}}|null>(null),[companyReason,setCompanyReason]=useState('');
  const scope=`${request.id}:${request.revision}:${mode}:${activeRole}`;
  const current=useRef(scope);current.current=scope;
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const lock=useRef(false),operations=useRef(new Map<string,string>()),stateCallback=useRef(onState);stateCallback.current=onState;
  const prefix=mode==='portal'?`/requests/${request.id}`:`/portal-intakes/${request.id}`;
  const transport=mode==='portal'?portalApi:api;
  useEffect(()=>{let active=true;setView(null);setError('');setBusy(false);setCompanyMatch(null);stateCallback.current?.(null);
    transport.get<IntakeCycleView>(`${prefix}/intake-cycle`).then(v=>{if(active){setView(v);stateCallback.current?.(v);}}).catch(e=>{if(active)setError((e as Error).message);});
    return()=>{active=false;};
  },[scope]);
  async function action(endpoint:string,payload:Record<string,unknown>) {
    if(lock.current)return;
    const key=JSON.stringify([scope,endpoint,payload]);
    const clientRequestId=operations.current.get(key)??crypto.randomUUID();operations.current.set(key,clientRequestId);
    lock.current=true;setBusy(true);setError('');
    try{const saved=await transport.post<PortalRequest>(`${prefix}/${endpoint}`,{...payload,expectedRevision:request.revision,clientRequestId});
      if(alive.current&&current.current===scope){operations.current.delete(key);onUpdated(saved);}
    }catch(e){if(alive.current&&current.current===scope)setError((e as Error).message+' Có thể thử lại cùng thao tác hoặc tải lại đề nghị.');}
    finally{lock.current=false;if(alive.current&&current.current===scope)setBusy(false);}
  }
  const canReview=mode==='staff'&&activeRole==='CBTD'&&request.status==='ASSIGNED'&&!request.coordinationRestrictions?.writeBlocked;
  const pendingCorrection=!!view?.correctionRequest&&(!view.correctionRequest.status||view.correctionRequest.status==='PENDING');
  return <section className="portal-card intake-cycle" aria-label="Lịch sử gửi và kiểm tra đề nghị">
    <h3>Gửi, kiểm tra và chỉnh sửa đề nghị</h3>
    {error&&<p role="alert" className="portal-error">{error}</p>}
    <button className="btn btn-secondary" disabled={busy} onClick={async()=>{setError('');try{const r=await transport.get<PortalRequest>(prefix);if(alive.current&&current.current===scope)onUpdated(r);}catch(e){if(alive.current&&current.current===scope)setError((e as Error).message);}}}>Tải lại đề nghị</button>
    {!view&&!error&&<p role="status">Đang tải lịch sử kiểm tra…</p>}
    {view&&<>
      <p>{request.status==='RETURNED'?'Doanh nghiệp đang chỉnh sửa. Bản đã gửi trước vẫn được giữ nguyên.':request.status==='ASSIGNED'?'Đang chờ ngân hàng kiểm tra bản đã gửi.':request.status==='ACCEPTED'?'Đã tiếp nhận; các yêu cầu sau đó được xử lý tại hồ sơ vay.':'Chuẩn bị và gửi hồ sơ theo checklist.'}</p>
      {view.correctionRequest&&<section className="portal-notice"><p>Doanh nghiệp đề nghị chỉnh sửa: {view.correctionRequest.message}</p><p>{pendingCorrection?'Đang chờ CBTD xử lý; chưa thể tiếp nhận.':view.correctionRequest.status==='APPROVED'?'Đã đồng ý trả sửa.':'Không đồng ý trả sửa.'} {view.correctionRequest.resolution}</p>
        {canReview&&pendingCorrection&&<><label>Lý do xử lý đề nghị xin sửa<textarea aria-label="Lý do xử lý đề nghị xin sửa" maxLength={4000} disabled={busy} value={decisionReason} onChange={e=>setDecisionReason(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy||!decisionReason.trim()} onClick={()=>void action('correction-decision',{submissionId:view.currentSubmissionId,decision:'APPROVE',reason:decisionReason.trim()})}>Đồng ý và trả sửa</button><button className="btn btn-secondary" disabled={busy||!decisionReason.trim()} onClick={()=>void action('correction-decision',{submissionId:view.currentSubmissionId,decision:'REJECT',reason:decisionReason.trim()})}>Không đồng ý trả sửa</button></>}
      </section>}
      {!!view.correctionHistory?.length&&<details><summary>Lịch sử xử lý đề nghị xin sửa</summary>{view.correctionHistory.map((c,i)=><p key={i}>{c.message} · {c.status==='APPROVED'?'Đồng ý':'Không đồng ý'}: {c.resolution}</p>)}</details>}
      {request.status==='RETURNED'&&<section><h4>Danh sách cần chỉnh sửa</h4><ul>{view.submissions[0]?.returnItems.map(i=><li key={i.itemId}><strong>{i.label}</strong>: {i.message}</li>)}</ul></section>}
      {view.checklist.length>0&&<section><h4>Kiểm tra lần gửi hiện tại</h4>{view.checklist.map(item=><section className="portal-card intake-review-item" key={item.id} data-item-id={item.id}>
        <strong>{item.label}</strong><p>{item.review?.decision==='ACCEPTED'?'Đã kiểm tra đạt':item.review?.decision==='NEEDS_CORRECTION'?'Cần chỉnh sửa':'Đã cung cấp, chờ kiểm tra'}</p>
        <ul>{view.submissions[0]?.snapshot.documents.filter(d=>item.documentIds.includes(d.id)).map(d=><li key={d.id}><DocumentLink fileName={d.fileName} disabled={busy} load={()=>transport.download(`${prefix}/documents/${d.id}/download`)}/></li>)}</ul>
        {item.review?.message&&<p>{item.review.message}</p>}
        {canReview&&<><p>{item.guidance}</p><ul>{item.reviewCriteria?.map(c=><li key={c}>{c}</li>)}</ul><label>Ghi nhận / lý do cần sửa<textarea maxLength={4000} value={messages[item.id]??''} disabled={busy} onChange={e=>setMessages(m=>({...m,[item.id]:e.target.value}))}/></label>
          <button className="btn btn-secondary" disabled={busy} onClick={()=>void action('review',{submissionId:view.currentSubmissionId,itemId:item.id,decision:'ACCEPTED',...(messages[item.id]?.trim()?{message:messages[item.id].trim()}:{})})}>Kiểm tra đạt</button>
          <button className="btn btn-secondary" disabled={busy||!messages[item.id]?.trim()} onClick={()=>void action('review',{submissionId:view.currentSubmissionId,itemId:item.id,decision:'NEEDS_CORRECTION',message:messages[item.id].trim()})}>Yêu cầu sửa mục này</button>
        </>}
      </section>)}</section>}
      {canReview&&!pendingCorrection&&<><label>Dữ liệu cần doanh nghiệp chỉnh sửa (nếu có)<textarea maxLength={4000} disabled={busy} value={dataCorrection} onChange={e=>setDataCorrection(e.target.value)}/></label><button className="btn btn-primary" disabled={busy||(!dataCorrection.trim()&&!view.checklist.some(i=>i.review?.decision==='NEEDS_CORRECTION'))} onClick={()=>{if(window.confirm('Gửi danh sách chỉnh sửa tổng hợp cho doanh nghiệp?'))void action('return-correction',{submissionId:view.currentSubmissionId,...(dataCorrection.trim()?{dataCorrectionMessage:dataCorrection.trim()}:{})});}}>Trả đề nghị để chỉnh sửa</button></>}
      {mode==='portal'&&!pendingCorrection&&['SUBMITTED','ASSIGNED'].includes(request.status)&&view.currentSubmissionId&&<section><h4>Tự phát hiện thông tin cần sửa?</h4><label>Nội dung cần chỉnh sửa<textarea disabled={busy} maxLength={4000} value={correction} onChange={e=>setCorrection(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy||!correction.trim()} onClick={()=>void action('request-correction',{message:correction.trim()})}>Đề nghị ngân hàng cho chỉnh sửa</button><p>Ngân hàng xem xét trả sửa; thao tác này chưa tự mở khóa hồ sơ.</p></section>}
      {canReview&&<section className="portal-card" aria-label="Đối soát doanh nghiệp hiện hữu"><h4>Đối soát doanh nghiệp hiện hữu</h4><button className="btn btn-secondary" disabled={busy} onClick={async()=>{setError('');try{const match=await api.get<NonNullable<typeof companyMatch>>(`${prefix}/company-match`);if(alive.current&&current.current===scope)setCompanyMatch(match);}catch(e){if(alive.current&&current.current===scope)setError((e as Error).message);}}}>Đối chiếu dữ liệu Company</button>
        {companyMatch&&<><p>{!companyMatch.found?'Chưa có Company hiện hữu.':companyMatch.financialReadiness?.message}</p>{companyMatch.financialReadiness?.differences.map(k=><p key={k}><strong>{names[k]??k}</strong>: Company {String(companyMatch.company?.[k]??'Chưa có')} · Bản gửi {String(view.submissions[0]?.snapshot.data[k]??'Chưa có')}</p>)}
          {companyMatch.found&&companyMatch.financialReadiness?.compatible===false&&!view.issues.some(i=>i.kind==='COMPANY_RECONCILIATION'&&i.status==='OPEN')&&<><p>Nếu doanh nghiệp khai sai, dùng mục trả sửa dữ liệu. Nếu Company cũ hoặc sai, gửi căn cứ để QLCN xác minh qua đối soát riêng.</p><label>Căn cứ đề nghị đối soát<textarea aria-label="Căn cứ đề nghị đối soát" maxLength={4000} disabled={busy} value={companyReason} onChange={e=>setCompanyReason(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy||!companyReason.trim()} onClick={()=>void action('company-reconciliation',{submissionId:view.currentSubmissionId,companyHash:companyMatch.companyHash,reason:companyReason.trim()})}>Gửi đối soát Company</button></>}
        </>}
      </section>}
      <section><h4>Vướng mắc cần xử lý</h4>{view.issues.map(i=><article key={i.id}><strong>{i.status==='OPEN'?'Đang xử lý':'Đã xử lý'}</strong><p>{i.publicMessage}</p>{mode==='staff'&&<><p>Vấn đề: {i.description}</p><p>Phương án / đầu mối: {i.proposal}</p>{i.kind==='COMPANY_RECONCILIATION'&&<><h5>Đối soát Company</h5>{Object.keys(i.context?.proposed??{}).map(k=><p key={k}>{names[k]??k}: {String(i.context?.before?.[k]??'Chưa có')} → {String(i.context?.proposed?.[k]??'Chưa có')}</p>)}
              {activeRole==='QUAN_LY'&&i.status==='OPEN'&&<><label>Căn cứ quyết định đối soát<textarea aria-label="Căn cứ quyết định đối soát" maxLength={4000} disabled={busy} value={resolutions[i.id]??''} onChange={e=>setResolutions(r=>({...r,[i.id]:e.target.value}))}/></label><button className="btn btn-primary" disabled={busy||!resolutions[i.id]?.trim()} onClick={()=>{if(window.confirm('Xác nhận cập nhật Company theo bản gửi đã đối soát? Dữ liệu Company của các hồ sơ vay cũ được giữ lại.'))void action('company-reconciliation/resolve',{issueId:i.id,decision:'APPROVE',reason:resolutions[i.id].trim()});}}>Xác nhận đối soát và cập nhật Company</button><button className="btn btn-secondary" disabled={busy||!resolutions[i.id]?.trim()} onClick={()=>void action('company-reconciliation/resolve',{issueId:i.id,decision:'REJECT',reason:resolutions[i.id].trim()})}>Không chấp thuận đối soát</button></>}
            </>}{i.resolution&&<p>Kết quả: {i.resolution}</p>}</>}{activeRole==='QUAN_LY'&&i.status==='OPEN'&&i.kind!=='COMPANY_RECONCILIATION'&&<><label>Kết quả xử lý<textarea disabled={busy} maxLength={4000} value={resolutions[i.id]??''} onChange={e=>setResolutions(r=>({...r,[i.id]:e.target.value}))}/></label><button disabled={busy||!resolutions[i.id]?.trim()} onClick={()=>void action('issues',{issueId:i.id,resolution:resolutions[i.id].trim()})}>Ghi nhận đã xử lý</button></>}</article>)}
        {activeRole==='QUAN_LY'&&request.status!=='ACCEPTED'&&view.currentSubmissionId&&<><label>Vấn đề nội bộ<textarea disabled={busy} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Phương án và người chịu trách nhiệm<textarea disabled={busy} maxLength={4000} value={proposal} onChange={e=>setProposal(e.target.value)}/></label><label>Thông báo cho doanh nghiệp<textarea disabled={busy} maxLength={4000} value={publicMessage} onChange={e=>setPublicMessage(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy||![description,proposal,publicMessage].every(s=>s.trim())} onClick={()=>void action('issues',{description:description.trim(),proposal:proposal.trim(),publicMessage:publicMessage.trim()})}>Ghi nhận vướng mắc chặn tiếp nhận</button></>}
      </section>
      <h4>Lịch sử các lần gửi ({view.submissions.length})</h4>{view.submissions.map(s=><details className="intake-submission" key={s.id}><summary>Lần gửi {s.sequence} · {new Date(s.submittedAt).toLocaleString('vi-VN')}{s.returnedAt?' · Đã trả sửa':''}</summary>
        <p>Thông tin thay đổi: {s.changes.fields.map(f=>names[f]??f).join(', ')||'Không thay đổi'}. Tài liệu thêm: {s.changes.addedDocuments.length}; bỏ khỏi bản mới: {s.changes.removedDocuments.length}.</p>
        <dl>{Object.entries(s.snapshot.data).filter(([k,v])=>names[k]&&typeof v!=='object').map(([k,v])=><div key={k}><dt>{names[k]}</dt><dd>{typeof v==='boolean'?(v?'Có':'Không'):String(v??'Chưa khai')}</dd></div>)}</dl>
        <ul>{s.snapshot.documents.map(d=><li key={d.id}><DocumentLink fileName={d.fileName} disabled={busy} load={()=>transport.download(`${prefix}/documents/${d.id}/download`)}/></li>)}</ul>
      </details>)}
    </>}
  </section>;
}
