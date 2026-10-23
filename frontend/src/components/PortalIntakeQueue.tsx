import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api, ApiError } from '../api/client';
import type { Company, RoleCode } from '../types';
import { loanTypes, requestStatus, type PortalFormConfig, type PortalRequest } from '../portal/model';
import { IntakeAssignment } from './IntakeAssignment';
import { PortalIntakeDetails, canAcceptIntake, intakeData, intakeMoney, mvpFinancialConfirmationRequired } from './PortalIntakeDetails';

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
  const acceptEnabled = !!selected && canAcceptIntake(selected, config);
  return <section className="portal-intake">
    <div className="portal-section-heading"><div><h2>Đề nghị từ cổng doanh nghiệp</h2><p>Kiểm tra thông tin và tài liệu trước khi tiếp nhận thành hồ sơ vay.</p></div><button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { await Promise.all([load(), loadConfig()]); if (selected) { setSelected(await api.get<PortalRequest>(`/portal-intakes/${selected.id}`)); setMatch(null); setConfirmed(false); } })}>Làm mới</button></div>
    {error && <p role="alert" className="error-message">{error}</p>}{configError && <p role="alert" className="error-message">Không tải được cấu hình tiếp nhận: {configError}. Chức năng tiếp nhận V2 được giữ khóa.</p>}{busy && <p role="status">Đang xử lý…</p>}
    {selected ? <>
      <button className="portal-link portal-back" disabled={busy} onClick={() => { setSelected(null); setMatch(null); setConfirmed(false); }}>← Quay lại danh sách</button>
      <section className="portal-card"><div className="portal-section-heading"><h2>{selected.reference}</h2><span className="portal-status">{requestStatus[selected.status]}</span></div>
        <IntakeAssignment key={selected.id + ':' + selected.assignedTo} request={selected} activeRole={activeRole} disabled={busy} onUpdated={async request => { setSelected(request); setMatch(null); setConfirmed(false); await load(); }} />
        <PortalIntakeDetails request={selected} config={config} busy={busy} />
        {selected.formVersion === 2 && !acceptEnabled && selected.status !== 'ACCEPTED' && <p className="portal-notice">Tiếp nhận V2 đang khóa theo cấu hình máy chủ. Thông tin và phân công hiện có vẫn được giữ nguyên.</p>}
        {selected.status === 'ASSIGNED' && activeRole === 'CBTD' && <>
          <button className="btn btn-secondary" disabled={busy || !acceptEnabled} onClick={() => void run(async () => { setMatch(await api.get(`/portal-intakes/${selected.id}/company-match`)); setConfirmed(false); })}>Kiểm tra doanh nghiệp để tiếp nhận</button>
          {match && <><div className="portal-intake-match">{match.found ? <><p>Đã có doanh nghiệp: <strong>{match.company?.companyName}</strong> — MST: {match.company?.taxCode}.</p><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi xác nhận dùng doanh nghiệp hiện có để tạo hồ sơ vay. Thông tin doanh nghiệp hiện có sẽ được giữ nguyên.</label></> : <p>Chưa có doanh nghiệp trùng mã số thuế. Tiếp nhận sẽ tạo doanh nghiệp và hồ sơ vay từ đề nghị này.</p>}</div>{match.found&&match.financialReadiness&&<div className="portal-notice"><p>{match.financialReadiness.message}</p>{!!match.financialReadiness.differences.length&&<ul>{match.financialReadiness.differences.map(key=><li key={key}>{({annualRevenue:'Doanh thu năm',charterCapital:'Vốn điều lệ',establishedYear:'Năm thành lập',industry:'Ngành nghề'} as Record<string,string>)[key]??key}: đề nghị {String((selected.data as unknown as Record<string,unknown>)[key]??'Chưa có')} · Company {String((match.company as unknown as Record<string,unknown>)?.[key]??'Chưa có')}</li>)}</ul>}{mvpFinancialConfirmationRequired(selected)&&<label><input type="checkbox" checked={financialConfirmed} disabled={!match.financialReadiness.compatible} onChange={e=>setFinancialConfirmed(e.target.checked)}/>Tôi đã đối chiếu nguồn và kỳ tài chính {match.financialReadiness.annualPeriod}; dữ liệu Company hiện hữu còn phù hợp.</label>}</div>}<button className="btn btn-primary" disabled={busy || !acceptEnabled || (match.found && !confirmed) || (match.found && mvpFinancialConfirmationRequired(selected) && (!financialConfirmed || !match.financialReadiness?.compatible))} onClick={() => { if (acceptEnabled && window.confirm('Xác nhận tiếp nhận đề nghị và tạo hồ sơ vay?')) void run(async () => { const result = await api.post<{ loanId: string; request: PortalRequest }>(`/portal-intakes/${selected.id}/accept`, match.found ? { confirmExistingCompany: confirmed, confirmExistingCompanyFinancials: financialConfirmed } : {}); if(!isCurrent())return; setSelected(result.request); onRefresh(); onSelectLoan(result.loanId); await load(); }); }}>Tiếp nhận thành hồ sơ vay</button></>}
        </>}
        {selected.status === 'SUBMITTED' && <p>Đề nghị đang chờ quản lý phân công.</p>}{selected.status === 'ASSIGNED' && activeRole !== 'CBTD' && <p>CBTD được giao sẽ kiểm tra và tiếp nhận.</p>}{selected.loanId && <button className="btn btn-primary" disabled={busy} onClick={() => onSelectLoan(selected.loanId!)}>Mở hồ sơ vay đã tiếp nhận</button>}
      </section>
    </> : <section className="portal-card"><div className="data-table-container"><table className="data-table"><thead><tr><th>Mã đề nghị</th><th>Doanh nghiệp</th><th>Loại vay</th><th>Mục đích vay</th><th>Đơn vị mong muốn</th><th>Số tiền đề nghị</th><th>Ngày gửi</th><th>Trạng thái</th><th>Phân công đề nghị</th><th /></tr></thead><tbody>{items.map(item => { const data = intakeData(item); return <tr key={item.id}>
      <td>{item.reference}</td><td>{data.companyName || '—'}<small style={{ display: 'block' }}>MST: {data.taxCode || '—'}</small></td><td>{data.loanType ? loanTypes[data.loanType] ?? data.loanType : '—'}</td><td>{data.loanPurpose || '—'}</td><td>{data.preferredBranch || '—'}</td><td>{intakeMoney(data.proposedAmount)}</td><td>{item.submittedAt && Number.isFinite(Date.parse(item.submittedAt)) ? new Date(item.submittedAt).toLocaleString('vi-VN') : '—'}</td><td>{requestStatus[item.status]}</td><td>{item.assignedOfficer?.fullName || item.assignedOfficer?.username || 'Chưa phân công'}{item.status === 'ACCEPTED' && <small style={{ display: 'block' }}>CBTD được phân công trước tiếp nhận</small>}</td><td><button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { const detail = await api.get<PortalRequest>(`/portal-intakes/${item.id}`); setSelected(detail); setMatch(null); setConfirmed(false); })}>Xem đề nghị</button></td>
    </tr>; })}{!busy && !error && !items.length && <tr><td colSpan={10}>Chưa có đề nghị từ cổng doanh nghiệp.</td></tr>}</tbody></table></div></section>}
  </section>;
}
