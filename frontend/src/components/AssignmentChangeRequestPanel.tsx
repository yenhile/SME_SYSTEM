import {useEffect,useRef,useState} from 'react';
import {api,ApiError} from '../api/client';
import {useAuth} from '../context/AuthContext';

export type CoordinationSubject={type:'LOAN'|'PORTAL';id:string;assignmentVersion?:number;ownerId?:string|null;closed?:boolean};
export interface CoordinationReceipt{
  id:string;subjectType:'LOAN'|'PORTAL';subjectId:string;subjectCode:string;requestedById:string;
  requester?:{fullName:string;username:string};reasonCode:string;reason:string;status:string;requestVersion:number;
  createdAt:string;resolvedAt?:string;decisionReason?:string;resolutionCode?:string;managerRecipientCount:number;
  currentOwnerId:string|null;currentAssignmentVersion:number;currentCaseLinkAllowed:boolean;canResolve:boolean;canCancel:boolean;
  prediction?:{status:string;message:string};replayed?:boolean;
}
/** Admin chỉ xem biên nhận; nút gửi, rút, quyết định do server trả về theo vai trò. */
const COORDINATION_VIEWERS=['CBTD','QUAN_LY','ADMIN'];
const reasons:Record<string,string>={WORKLOAD:'Quá tải công việc',UNAVAILABLE:'Không thể tiếp tục xử lý',ASSIGNMENT_MISMATCH:'Phân công chưa phù hợp',CONFLICT_OF_INTEREST:'Xung đột lợi ích',OTHER:'Lý do khác'};
export const coordinationStatus:Record<string,string>={PENDING:'Chờ quản lý xử lý',APPROVED:'Đã chấp thuận điều phối',REJECTED:'Không chấp thuận điều phối',CANCELLED:'CBTD đã rút',OBSOLETE:'Hết hiệu lực'};
export function AssignmentChangeRequestPanel({subject,requestId,onChanged,onOpenCase}:{subject?:CoordinationSubject;requestId?:string;onChanged?:()=>void|Promise<void>;onOpenCase?:(subject:{type:'LOAN'|'PORTAL';id:string})=>void}){
  const {user,activeRole}=useAuth();
  const [rows,setRows]=useState<CoordinationReceipt[]>([]),[cap,setCap]=useState<{enabled:boolean;conflictOfInterestEnabled:boolean;reasonCodes?:string[];restriction?:string|null}|null>(null);
  const [officers,setOfficers]=useState<{id:string;fullName:string;username:string;totalAssignedCount:number}[]>([]);
  const [reasonCode,setReasonCode]=useState('WORKLOAD'),[reason,setReason]=useState(''),[target,setTarget]=useState(''),[decision,setDecision]=useState('');
  const [confirm,setConfirm]=useState(false),[noConflict,setNoConflict]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const operation=useRef<{key:string;id:string}|null>(null),lock=useRef(false),alive=useRef(true);
  const scope=`${user?.id}:${activeRole}:${subject?.type}:${subject?.id}:${requestId??''}`;
  const current=useRef(scope);current.current=scope;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function load(){
    const started=scope;setLoading(true);
    try{
      const path=requestId?`/assignment-change-requests/${requestId}`:`/assignment-change-requests?subjectType=${subject!.type}&subjectId=${encodeURIComponent(subject!.id)}`;
      const [capability,data,users]=await Promise.all([api.get<typeof cap>(subject?.type==='LOAN'?`/assignment-change-requests/capabilities?subjectType=LOAN&subjectId=${encodeURIComponent(subject.id)}`:'/assignment-change-requests/capabilities'),api.get<CoordinationReceipt|CoordinationReceipt[]>(path),activeRole==='QUAN_LY'?api.get<typeof officers>('/assignments/officer-workloads'):Promise.resolve([])]);
      if(alive.current&&current.current===started){setCap(capability);if(capability?.reasonCodes?.length&&!capability.reasonCodes.includes(reasonCode))setReasonCode(capability.reasonCodes[0]);setRows(Array.isArray(data)?data:[data]);setOfficers(users);setError('');}
    }catch(e){if(alive.current&&current.current===started)setError((e as Error).message);}
    finally{if(alive.current&&current.current===started)setLoading(false);}
  }
  useEffect(()=>{setRows([]);setCap(null);setConflict(false);setReason('');setTarget('');setDecision('');setNotice('');operation.current=null;if(COORDINATION_VIEWERS.includes(activeRole??''))void load();else setLoading(false);},[scope]);
  const pending=rows.some(r=>r.status==='PENDING');
  const canCreate=!!subject&&activeRole==='CBTD'&&subject.ownerId===user?.id&&!subject.closed&&!pending&&Number.isSafeInteger(subject.assignmentVersion)&&(!rows.length||rows.every(r=>r.currentOwnerId===user?.id));
  async function execute(kind:'create'|'approve'|'reject'|'cancel',row?:CoordinationReceipt){
    if(lock.current||conflict)return;
    const started=scope;
    const fields=kind==='create'?{subjectType:subject!.type,subjectId:subject!.id,expectedAssignmentVersion:subject!.assignmentVersion,reasonCode,reason:reason.trim()}:{expectedRequestVersion:row!.requestVersion,expectedAssignmentVersion:row!.currentAssignmentVersion,...(kind==='cancel'?{}:{decisionReason:decision.trim()}),...(kind==='approve'?{newOfficerId:target}:{}),...(kind==='reject'?{confirmCanContinue:confirm,...(row!.reasonCode==='CONFLICT_OF_INTEREST'&&noConflict?{resolutionCode:'NO_CONFLICT_CONFIRMED'}:{})}:{})};
    const path=kind==='create'?'/assignment-change-requests':`/assignment-change-requests/${row!.id}/${kind}`;
    const key=JSON.stringify([path,fields]);if(operation.current?.key!==key)operation.current={key,id:crypto.randomUUID()};
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      const saved=await api.post<CoordinationReceipt>(path,{...fields,clientRequestId:operation.current.id});
      if(!alive.current||current.current!==started)return;
      operation.current=null;setTarget('');setDecision('');setConfirm(false);setNoConflict(false);setReason('');
      setRows(old=>[...old.filter(x=>x.id!==saved.id),saved]);
      setNotice(`${saved.replayed?'Thao tác đã được ghi nhận trước đó. ':''}${coordinationStatus[saved.status]??saved.status}.${saved.prediction?' '+saved.prediction.message:''}`);
      window.dispatchEvent(new Event('sme-notifications-refresh'));
      try{await onChanged?.();}catch{setError('Thao tác đã được lưu; chưa làm mới được hồ sơ. Vui lòng tải lại.');}
    }catch(e){if(alive.current&&current.current===started){if(e instanceof ApiError&&e.status===409)setConflict(true);setError((e as Error).message);}}
    finally{lock.current=false;if(alive.current&&current.current===started)setBusy(false);}
  }
  if(!COORDINATION_VIEWERS.includes(activeRole??''))return null;
  return <section className="coordination-panel portal-card" aria-label="Đề nghị điều phối">
    <div className="portal-section-heading"><h3>Đề nghị điều phối</h3><button type="button" className="btn btn-secondary" disabled={busy||loading} onClick={async()=>{operation.current=null;setConflict(false);await onChanged?.();await load();}}>Tải lại điều phối</button></div>
    <p>Đề nghị chuyển người xử lý nội bộ do quản lý quyết định. Gửi đề nghị không đổi người phụ trách hoặc cách tính SLA.</p>
    {loading&&<p role="status">Đang tải đề nghị điều phối…</p>}{error&&<p role="alert" className="error-message">{error}</p>}{notice&&<p role="status" className="portal-notice">{notice}</p>}
    {conflict&&<p role="alert">Thông tin đã thay đổi. Tải lại điều phối và đối chiếu trước khi xác nhận mới.</p>}
    {canCreate&&cap?.restriction&&<p role="note" className="portal-notice">{cap.restriction}</p>}
    {canCreate&&cap?.enabled&&<form className="coordination-create" onSubmit={e=>{e.preventDefault();void execute('create');}}>
      <label>Nhóm lý do<select aria-label="Nhóm lý do điều phối" value={reasonCode} disabled={busy||conflict} onChange={e=>setReasonCode(e.target.value)}>{Object.entries(reasons).filter(([code])=>(code!=='CONFLICT_OF_INTEREST'||cap.conflictOfInterestEnabled)&&(!cap.reasonCodes||cap.reasonCodes.includes(code))).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
      <label>Lý do cụ thể<textarea aria-label="Lý do đề nghị điều phối" required maxLength={2000} value={reason} disabled={busy||conflict} onChange={e=>setReason(e.target.value)}/></label>
      {reasonCode==='CONFLICT_OF_INTEREST'&&<p className="portal-error">Khi gửi, bạn sẽ bị chặn ghi nghiệp vụ trên hồ sơ liên quan đến khi quản lý giải quyết; không được tự rút để bỏ chặn.</p>}
      <button className="btn btn-primary" disabled={busy||conflict||!reason.trim()}>Gửi đề nghị điều phối</button>
    </form>}
    {!loading&&!rows.length&&<p>Chưa có đề nghị điều phối.</p>}
    <div className="coordination-receipts">{rows.map(row=><article key={row.id} className="coordination-receipt" data-coordination-id={row.id}>
      <h4>{row.subjectCode} · {coordinationStatus[row.status]}</h4><p>Người gửi: {row.requester?.fullName||row.requester?.username||'CBTD'} · {new Date(row.createdAt).toLocaleString('vi-VN')}</p>
      <p><strong>{reasons[row.reasonCode]}</strong>: {row.reason}</p>
      {row.status==='PENDING'&&row.managerRecipientCount===0&&<p role="alert" className="portal-error">Chưa có QLCN hợp lệ nhận thông báo. Đề nghị vẫn đang chờ; cần bố trí người có thẩm quyền điều phối.</p>}
      {row.reasonCode==='CONFLICT_OF_INTEREST'&&row.status==='PENDING'&&<p className="portal-error">Đang chờ giải quyết xung đột lợi ích. Người gửi bị chặn ghi nghiệp vụ; hồ sơ chưa được chốt quyết định tín dụng.</p>}
      {row.decisionReason&&<p>Kết quả/lý do: {row.decisionReason}</p>}{row.resolutionCode==='PORTAL_ACCEPTED'&&<p>Đề nghị Portal đã tiếp nhận; nếu còn nhu cầu, gửi đề nghị mới tại hồ sơ vay.</p>}
      {!row.currentCaseLinkAllowed&&<p>Biên nhận nội bộ được giữ để theo dõi; quyền xử lý hồ sơ hiện tại thuộc người được phân công.</p>}
      {row.currentCaseLinkAllowed&&onOpenCase&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>onOpenCase({type:row.subjectType,id:row.subjectId})}>Mở hồ sơ hiện tại</button>}
      {row.canCancel&&<button type="button" className="btn btn-secondary" disabled={busy||conflict} onClick={()=>void execute('cancel',row)}>Rút đề nghị điều phối</button>}
      {row.canResolve&&<div className="coordination-decision">
        <label>Cán bộ nhận bàn giao<select aria-label="Cán bộ nhận bàn giao" value={target} disabled={busy||conflict} onChange={e=>setTarget(e.target.value)}><option value="">Chọn cán bộ</option>{officers.filter(o=>o.id!==row.currentOwnerId&&o.id!==user?.id).map(o=><option value={o.id} key={o.id}>{o.fullName||o.username} · {o.totalAssignedCount} công việc</option>)}</select></label>
        <label>Căn cứ quyết định<textarea aria-label="Căn cứ quyết định điều phối" maxLength={2000} value={decision} disabled={busy||conflict} onChange={e=>setDecision(e.target.value)}/></label>
        <button type="button" className="btn btn-primary" disabled={busy||conflict||!target||!decision.trim()} onClick={()=>void execute('approve',row)}>Chấp thuận và bàn giao</button>
        <label><input type="checkbox" checked={confirm} disabled={busy||conflict} onChange={e=>setConfirm(e.target.checked)}/>Tôi xác nhận CBTD hiện tại còn đủ điều kiện và thực tế có thể tiếp tục xử lý</label>
        {row.reasonCode==='CONFLICT_OF_INTEREST'&&<label><input type="checkbox" checked={noConflict} disabled={busy||conflict} onChange={e=>setNoConflict(e.target.checked)}/>Tôi đã đối chiếu và có căn cứ kết luận không có xung đột lợi ích; căn cứ được ghi ở trên</label>}
        <button type="button" className="btn btn-secondary" disabled={busy||conflict||!decision.trim()||!confirm||(row.reasonCode==='CONFLICT_OF_INTEREST'&&!noConflict)} onClick={()=>void execute('reject',row)}>Không chấp thuận điều phối</button>
      </div>}
    </article>)}</div>
  </section>;
}
