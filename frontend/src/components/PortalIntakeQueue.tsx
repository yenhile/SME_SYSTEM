import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api, ApiError } from '../api/client';
import type { Company, RoleCode } from '../types';
import { loanTypes, requestStatus, type PortalFormConfig, type PortalRequest } from '../portal/model';
import { IntakeAssignment } from './IntakeAssignment';
import {AssignmentChangeRequestPanel} from './AssignmentChangeRequestPanel';
import {comparedValue,IntakeCyclePanel,type IntakeCycleView} from '../portal/IntakeCyclePanel';
import { compactMoney } from '../loanListDisplay';
import './loan-table.css';
import { PortalIntakeDetails, canAcceptIntake, intakeData, intakeMoney, mvpFinancialConfirmationRequired } from './PortalIntakeDetails';

const intakeTone: Record<string, string> = { DRAFT: 'gray', SUBMITTED: 'amber', ASSIGNED: 'blue', RETURNED: 'red', ACCEPTED: 'green' };

export function PortalIntakeQueue({ activeRole, onSelectLoan, onRefresh, target }: { activeRole: RoleCode | null; onSelectLoan: (id: string) => void; onRefresh: () => void; target?: { id: string; revision: number } | null }) {
  const scopeKey=`${activeRole}:${target?.id??''}:${target?.revision??''}`;
  const scope=useRef({key:scopeKey,version:0});const mounted=useRef(true);
  if(scope.current.key!==scopeKey)scope.current={key:scopeKey,version:scope.current.version+1};
  const scopeVersion=scope.current.version;
  const isCurrent=()=>mounted.current&&scope.current.version===scopeVersion;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  function guarded<T>(setter:Dispatch<SetStateAction<T>>):Dispatch<SetStateAction<T>> {return value=>{if(isCurrent())setter(value);};}
  const [items, setItemsRaw] = useState<PortalRequest[]>([]); const [selected, setSelectedRaw] = useState<PortalRequest | null>(null); const setItems=guarded(setItemsRaw); const setSelected=guarded(setSelectedRaw);
  const [busy, setBusyRaw] = useState(false); const [error, setErrorRaw] = useState(''); const setBusy=guarded(setBusyRaw); const setError=guarded(setErrorRaw);
  const [config, setConfigRaw] = useState<PortalFormConfig | null>(null); const [configError, setConfigErrorRaw] = useState(''); const setConfig=guarded(setConfigRaw); const setConfigError=guarded(setConfigErrorRaw);
  const [match, setMatchRaw] = useState<{ found: boolean; company?: Company; financialReadiness?:{compatible:boolean;requiresConfirmation:boolean;differences:string[];message:string;annualPeriod:string|null} } | null>(null); const [confirmed, setConfirmedRaw] = useState(false); const setMatch=guarded(setMatchRaw); const setConfirmed=guarded(setConfirmedRaw);
  const [financialConfirmed,setFinancialConfirmedRaw]=useState(false); const setFinancialConfirmed=guarded(setFinancialConfirmedRaw);
  const [cycle,setCycle]=useState<IntakeCycleView|null>(null);
  useEffect(()=>{setFinancialConfirmed(false);},[selected?.id,match]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (err) { setError((err as Error).message); setMatch(null); setConfirmed(false); if (err instanceof ApiError && [403, 404].includes(err.status)) setSelected(null); } finally { setBusy(false); } }
  async function load() { setItems(await api.get<PortalRequest[]>('/portal-intakes')); }
  async function loadConfig() {
    setConfig(null); setConfigError('');
    try { setConfig(await api.get<PortalFormConfig>('/portal-intakes/form-config')); }
    catch (err) { setConfigError((err as Error).message); }
  }
  useEffect(() => {
    let disposed = false;
    setSelected(null); setMatch(null); setConfirmed(false); setBusy(true); setError(''); setConfig(null); setConfigError('');
    // Catalog failure stays visible independently of queue/API failure.
    api.get<PortalFormConfig>('/portal-intakes/form-config').then(value => { if (!disposed) setConfig(value); }).catch(err => { if (!disposed) setConfigError((err as Error).message); });
    Promise.all([api.get<PortalRequest[]>('/portal-intakes'), target ? api.get<PortalRequest>(`/portal-intakes/${target.id}`) : Promise.resolve(null)])
      .then(([requests, detail]) => { if (!disposed) { setItems(requests); setSelected(detail); } })
      .catch(err => { if (!disposed) { setItems([]); setError((err as Error).message); } })
      .finally(() => { if (!disposed) setBusy(false); });
    return () => { disposed = true; };
  }, [target, activeRole]);
  const acceptEnabled = !selected?.coordinationRestrictions?.writeBlocked && !!selected && canAcceptIntake(selected, config) && (!config?.intakeCycleEnabled||selected.formVersion!==2||(cycle?.requestId===selected.id&&cycle.revision===selected.revision&&cycle.canAccept));
  return <section className="portal-intake">
    <div className="portal-section-heading"><h2>Đề nghị từ cổng doanh nghiệp</h2><button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { await Promise.all([load(), loadConfig()]); if (selected) { setSelected(await api.get<PortalRequest>(`/portal-intakes/${selected.id}`)); setMatch(null); setConfirmed(false); } })}>Làm mới</button></div>
    {error && <p role="alert" className="error-message">{error}</p>}{configError && <p role="alert" className="error-message">Không tải được cấu hình tiếp nhận: {configError}. Chức năng tiếp nhận V2 được giữ khóa.</p>}{busy && <p role="status">Đang xử lý…</p>}
    {selected ? <>
      <button className="portal-link portal-back" disabled={busy} onClick={() => { setSelected(null); setMatch(null); setConfirmed(false); }}>← Quay lại danh sách</button>
      <section className="portal-card"><div className="portal-section-heading"><h2>{selected.reference}</h2><span className="portal-status">{requestStatus[selected.status]}</span></div>
        <IntakeAssignment key={selected.id} request={selected} activeRole={activeRole} disabled={busy} onUpdated={async request => { setSelected(request); setMatch(null); setConfirmed(false); await load(); }} />
        <AssignmentChangeRequestPanel key={'coordination:'+selected.id} subject={{type:'PORTAL',id:selected.id,assignmentVersion:selected.assignmentVersion,ownerId:selected.assignedTo,closed:!['ASSIGNED','RETURNED'].includes(selected.status)}} onChanged={async()=>{setSelected(await api.get<PortalRequest>(`/portal-intakes/${selected.id}`));await load();}}/>
        {selected.coordinationRestrictions?.writeBlocked&&<p role="alert" className="portal-error">Bạn đang chờ giải quyết xung đột lợi ích; các thao tác ghi nghiệp vụ trên đề nghị này bị chặn.</p>}
        {selected.formVersion===2&&config?.intakeCycleEnabled&&<IntakeCyclePanel key={selected.id+':'+activeRole} request={selected} mode="staff" activeRole={activeRole} onState={setCycle} onUpdated={r=>{setSelected(r);setMatch(null);setConfirmed(false);void load();}}/>}
        {selected.formVersion===2&&config?.intakeCycleEnabled?<details><summary>Xem thông tin và tài liệu đã gửi</summary><PortalIntakeDetails request={selected} config={config} busy={busy}/></details>:<PortalIntakeDetails request={selected} config={config} busy={busy}/>}
        {selected.formVersion === 2 && !acceptEnabled && selected.status !== 'ACCEPTED' && <p className="portal-notice">Chưa đủ điều kiện tiếp nhận: cần kiểm tra đạt các mục bắt buộc và xử lý các vướng mắc. Nếu cấu hình chưa mở, chức năng vẫn được giữ khóa.</p>}
        {selected.status === 'ASSIGNED' && activeRole === 'CBTD' && <>
          <button className="btn btn-secondary" disabled={busy || !acceptEnabled} onClick={() => void run(async () => { setMatch(await api.get(`/portal-intakes/${selected.id}/company-match`)); setConfirmed(false); })}>Kiểm tra doanh nghiệp để tiếp nhận</button>
          {match && <><div className="portal-intake-match">{match.found ? <><p>Đã có doanh nghiệp: <strong>{match.company?.companyName}</strong> — MST: {match.company?.taxCode}.</p><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi xác nhận dùng doanh nghiệp hiện có để tạo hồ sơ vay. Thông tin doanh nghiệp hiện có sẽ được giữ nguyên.</label></> : <p>Chưa có doanh nghiệp trùng mã số thuế. Tiếp nhận sẽ tạo doanh nghiệp và hồ sơ vay từ đề nghị này.</p>}</div>{match.found&&match.financialReadiness&&<div className="portal-notice"><p>{match.financialReadiness.message}</p>{!!match.financialReadiness.differences.length&&<ul>{match.financialReadiness.differences.map(key=><li key={key}>{({annualRevenue:'Doanh thu năm',charterCapital:'Vốn điều lệ',establishedYear:'Năm thành lập',industry:'Ngành nghề',representativeName:'Người đại diện',phone:'Điện thoại',address:'Địa chỉ'} as Record<string,string>)[key]??key}: đề nghị {comparedValue(key,(selected.data as unknown as Record<string,unknown>)[key])} · Đã lưu {comparedValue(key,(match.company as unknown as Record<string,unknown>)?.[key])}</li>)}</ul>}{mvpFinancialConfirmationRequired(selected)&&<label><input type="checkbox" checked={financialConfirmed} disabled={!match.financialReadiness.compatible} onChange={e=>setFinancialConfirmed(e.target.checked)}/>Tôi đã đối chiếu nguồn và kỳ tài chính {match.financialReadiness.annualPeriod}; dữ liệu doanh nghiệp đã lưu còn phù hợp.</label>}</div>}<button className="btn btn-primary" disabled={busy || !acceptEnabled || (match.found && !confirmed) || (match.found && mvpFinancialConfirmationRequired(selected) && (!financialConfirmed || !match.financialReadiness?.compatible))} onClick={() => { if (acceptEnabled && window.confirm('Xác nhận tiếp nhận đề nghị và tạo hồ sơ vay?')) void run(async () => { const result = await api.post<{ loanId: string; request: PortalRequest }>(`/portal-intakes/${selected.id}/accept`, {...(match.found?{confirmExistingCompany:confirmed,confirmExistingCompanyFinancials:financialConfirmed}:{}),...(config?.intakeCycleEnabled&&selected.formVersion===2?{expectedRevision:selected.revision,submissionId:cycle?.currentSubmissionId}:{})}); if(!isCurrent())return; setSelected(result.request); onRefresh(); onSelectLoan(result.loanId); await load(); }); }}>Tiếp nhận thành hồ sơ vay</button></>}
        </>}
        {selected.status === 'SUBMITTED' && <p>Đề nghị đang chờ quản lý phân công.</p>}{selected.status === 'ASSIGNED' && activeRole !== 'CBTD' && <p>CBTD được giao sẽ kiểm tra và tiếp nhận.</p>}{selected.loanId && <button className="btn btn-primary" disabled={busy} onClick={() => onSelectLoan(selected.loanId!)}>Mở hồ sơ vay đã tiếp nhận</button>}
      </section>
    </> : <div className="lt-container"><table className="lt-table lt-intake-table" aria-busy={busy}><thead><tr><th scope="col">Mã đề nghị</th><th scope="col">Doanh nghiệp</th><th scope="col">Nhu cầu vay</th><th scope="col">Ngày gửi</th><th scope="col">Trạng thái</th><th scope="col"><span className="lt-sr-only">Thao tác</span></th></tr></thead><tbody>{items.map(item => { const data = intakeData(item); const sent = item.submittedAt && Number.isFinite(Date.parse(item.submittedAt)) ? new Date(item.submittedAt) : null; const officer = item.assignedOfficer?.fullName || item.assignedOfficer?.username; const open = () => void run(async () => { const detail = await api.get<PortalRequest>(`/portal-intakes/${item.id}`); setSelected(detail); setMatch(null); setConfirmed(false); }); return <tr key={item.id} className="lt-row" onClick={() => { if (!busy) open(); }}>
      <td data-label="Mã đề nghị"><span className="lt-code">{item.reference}</span><span className="lt-chip">Portal{item.formVersion === 2 ? ' V2' : ''}</span></td>
      <td data-label="Doanh nghiệp"><span className="lt-clamp" title={data.companyName}>{data.companyName || '—'}</span><span className="lt-sub">MST {data.taxCode || '—'}</span></td>
      <td data-label="Nhu cầu vay"><strong>{compactMoney(data.proposedAmount)}</strong><span className="lt-sub">{data.loanType ? loanTypes[data.loanType] ?? data.loanType : '—'}</span>{data.loanPurpose && <span className="lt-sub lt-clamp" title={data.loanPurpose}>{data.loanPurpose}</span>}{data.preferredBranch && <span className="lt-sub">Đơn vị mong muốn: {data.preferredBranch}</span>}</td>
      <td data-label="Ngày gửi" className="lt-nowrap">{sent ? <>{sent.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}<span className="lt-sub">{sent.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</span></> : '—'}</td>
      <td data-label="Trạng thái"><span className={`lt-status lt-status-${intakeTone[item.status] ?? 'gray'}`}>{requestStatus[item.status]}</span><span className="lt-sub">{officer ? `CBTD: ${officer}` : 'Chưa phân công CBTD'}</span>{item.status === 'ACCEPTED' && <span className="lt-sub">Đang phụ trách hồ sơ vay: {item.currentLoanOfficer?.fullName || item.currentLoanOfficer?.username || 'Chưa xác định'}</span>}</td>
      <td data-label="Thao tác" className="lt-nowrap lt-intake-action"><button type="button" className="btn btn-secondary" disabled={busy} onClick={event => { event.stopPropagation(); open(); }}>Xem đề nghị</button></td>
    </tr>; })}{!busy && !error && !items.length && <tr className="lt-message"><td colSpan={6}><strong>Chưa có đề nghị từ cổng doanh nghiệp</strong><p>Đề nghị doanh nghiệp gửi sẽ xuất hiện tại đây.</p></td></tr>}</tbody></table></div>}
  </section>;
}
