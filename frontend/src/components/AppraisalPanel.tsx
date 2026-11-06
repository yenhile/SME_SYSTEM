import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { REPORT_FORM_FIELDS } from '../appraisalWorkspace';
import { useAuth } from '../context/AuthContext';
import type { LoanApplication } from '../types';

const fields: Record<string,string> = Object.fromEntries(REPORT_FORM_FIELDS);
interface ReportVersion {id:string;sequence:number;content:Record<string,string>;submittedBy:string;submittedAt:string}
interface Report {
  id: string;
  revision: number;
  status: string;
  draft: Record<string, string>;
  clarification?: { message: string };
  versions: ReportVersion[];
  decidedVersionId?: string | null;
  evidenceChanged?: boolean;
  makerChecker?: {
    isIndependent: boolean;
    canClarify: boolean;
    clarifyBlockReason: string | null;
  };
}
const statusLabels:Record<string,string>={DRAFT:'Đang lập',SUBMITTED:'Đã trình, chờ quyết định',CLARIFICATION_REQUIRED:'CBTD cần làm rõ',DECIDED:'Đã có quyết định'};
const decidableVersion=(report:Report|null)=>report?.status==='SUBMITTED'&&!report.evidenceChanged?report.versions[0]?.id:undefined;
export function AppraisalPanel({loan,evidenceKey,onChanged,onVersion}:{loan:LoanApplication;evidenceKey?:string;onChanged:()=>void;onVersion:(id?:string)=>void}) {
  const {user,activeRole}=useAuth();
  const [report,setReport]=useState<Report|null>(null),[content,setContent]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[message,setMessage]=useState('');
  const identity=`${loan.id}:${activeRole}:${user?.id}`;
  const epoch=useRef(0);
  useEffect(()=>{
    epoch.current++;
    let live=true;setLoading(true);setBusy(false);setReport(null);setContent({});setError('');onVersion(undefined);
    api.get<Report|null>(`/appraisals/${loan.id}`).then(r=>{
      if(live){
        const safeReport = r ?? null;
        setReport(safeReport);
        setContent(safeReport?.draft ?? {});
        onVersion(decidableVersion(safeReport));
      }
    })
      .catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;epoch.current++;};
  },[identity,loan.updatedAt,evidenceKey]);
  const ended=!!loan.completedAt||loan.currentStage==='HOAN_TAT';
  const editable=!ended&&!loan.coordinationRestrictions?.writeBlocked&&activeRole==='CBTD'&&loan.assignedTo===user?.id&&(!report||['DRAFT','CLARIFICATION_REQUIRED'].includes(report.status));
  async function run(kind:'draft'|'submit'|'clarify') {
    const requestEpoch=epoch.current;
    setBusy(true);setError('');setNotice('');
    try {
      const body={expectedRevision:report?.revision??0,clientRequestId:crypto.randomUUID(),...(kind==='draft'?{content}:kind==='clarify'?{message}: {})};
      const next=kind==='draft'?await api.put<Report>(`/appraisals/${loan.id}/draft`,body):await api.post<Report>(`/appraisals/${loan.id}/${kind}`,body);
      if(requestEpoch!==epoch.current)return;
      const safeNext = next ?? null;
      setReport(safeNext);setContent(safeNext?.draft ?? {});onVersion(decidableVersion(safeNext));
      setNotice(kind==='draft'?'Đã lưu bản nháp.':kind==='submit'?'Đã trình tờ trình.':'Đã gửi yêu cầu làm rõ cho CBTD.');onChanged();
    } catch(e){if(requestEpoch===epoch.current)setError((e as Error).message);} finally{if(requestEpoch===epoch.current)setBusy(false);}
  }
  return <section className="card appraisal-panel" aria-label="Tờ trình tín dụng" style={{padding:20}}>
    <h3>Tờ trình tín dụng</h3><p>{loading?'Đang tải tờ trình…':statusLabels[report?.status??'DRAFT']}</p>
    {error&&<p role="alert" className="portal-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {report?.status==='CLARIFICATION_REQUIRED'&&<p className="portal-notice">Yêu cầu làm rõ: {report.clarification?.message}</p>}
    {activeRole==='THAM_QUYEN'&&report?.evidenceChanged&&loan.currentStatus!=='SUPPLEMENT_REQUIRED'&&<p role="alert" className="portal-error">Căn cứ đã thay đổi sau khi tờ trình được trình (có chứng từ hoặc yêu cầu bổ sung mới). Hãy yêu cầu CBTD làm rõ và trình lại; sau đó mới phê duyệt hoặc từ chối được.</p>}
    {report?.decidedVersionId&&<p>Quyết định trên phiên bản {report.versions.find(version=>version.id===report.decidedVersionId)?.sequence??'—'}.</p>}
    {!loading&&<><div className="portal-field-grid">{Object.entries(fields).map(([key,label])=><label key={key}>{label}
      <textarea aria-label={label} rows={3} maxLength={10000} disabled={busy} readOnly={!editable} value={content[key]??''} onChange={e=>setContent({...content,[key]:e.target.value})}/>
    </label>)}</div>
    {editable&&<div>
      <div className="portal-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={()=>void run('draft')}>Lưu nháp tờ trình</button>
        <button className="btn btn-primary" disabled={busy||!report||JSON.stringify(content)!==JSON.stringify(report.draft)} onClick={()=>void run('submit')}>Trình tờ trình</button>
      </div>
      <p style={{ fontSize: '12px', marginTop: 6, color: 'var(--text-muted)' }}>
        {(!report || JSON.stringify(content) !== JSON.stringify(report.draft)) ? (
          <span>* Vui lòng bấm <strong>Lưu nháp tờ trình</strong> trước khi <strong>Trình tờ trình</strong> để hệ thống chốt bản nháp vào hồ sơ.</span>
        ) : (
          <span style={{ color: 'var(--success, #16a34a)' }}>✓ Bản nháp đã lưu khớp nội dung. Cán bộ có thể bấm <strong>Trình tờ trình</strong>.</span>
        )}
      </p>
    </div>}
    {!ended&&!loan.coordinationRestrictions?.writeBlocked&&activeRole==='THAM_QUYEN'&&report?.status==='SUBMITTED'&&<div>
      <label>Nội dung cần CBTD làm rõ
        <textarea
          aria-label="Nội dung cần CBTD làm rõ"
          maxLength={4000}
          value={message}
          onChange={e=>setMessage(e.target.value)}
          disabled={busy || report?.makerChecker?.canClarify === false || loan.makerCheckerRestrictions?.decisionBlocked === true}
        />
      </label>
      {(report?.makerChecker?.canClarify === false || loan.makerCheckerRestrictions?.decisionBlocked === true) && (
        <p role="alert" className="portal-error" style={{ marginTop: 6, fontSize: '13px' }}>
          {report?.makerChecker?.clarifyBlockReason || loan.makerCheckerRestrictions?.decisionBlockReason || 'Bạn không đủ điều kiện độc lập để yêu cầu làm rõ tờ trình này (Maker-Checker).'}
        </p>
      )}
      <button
        className="btn btn-warning"
        disabled={busy || !message.trim() || report?.makerChecker?.canClarify === false || loan.makerCheckerRestrictions?.decisionBlocked === true}
        onClick={()=>void run('clarify')}
      >
        Yêu cầu làm rõ tờ trình
      </button>
    </div>}
    <p>Người lập và người quyết định phải độc lập. Làm rõ nội bộ không tạm dừng SLA.</p>
    {(report?.versions ?? []).map(v=><details key={v.id}><summary>Phiên bản {v.sequence} · {new Date(v.submittedAt).toLocaleString('vi-VN')}</summary><dl>{Object.entries(v.content).map(([k,text])=><div key={k}><dt>{fields[k]??k}</dt><dd style={{whiteSpace:'pre-wrap'}}>{text||'Không ghi thêm'}</dd></div>)}</dl></details>)}
    </>}
  </section>;
}
