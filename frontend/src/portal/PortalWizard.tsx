import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, FileText, LockKeyhole, Plus, Save, Trash2 } from 'lucide-react';
import { portalApi, PortalApiError } from './client';
import { loanTypes } from './model';
import type { PortalAccount, PortalData, PortalFormConfig, PortalRequest, PortalChecklist } from './model';
import { capitalTotals, normalizeV2, validateV2, sameDraft, initialDraftState, loanTypeOptions, type DraftRecovery } from './wizard';
import { DocumentManager } from './DocumentManager';
import { canEditCycle, canSendCycle } from './intake-cycle';
import { IntakeCyclePanel } from './IntakeCyclePanel';
import { PortalReview, ChecklistOverview } from './PortalReview';
import { reviewNotices } from './review';

const steps = ['Thông tin doanh nghiệp', 'Nhu cầu vay', 'Phương án vốn', 'Hồ sơ tài liệu', 'Rà soát đề nghị'];
const money = (value?: number) => value === undefined ? 'Chưa khai' : `${value.toLocaleString('vi-VN')} VNĐ`;
const recoveryKey = (accountId: string, id: string) => `sme_portal_v2:${accountId}:${id}`;
export const activeDraftKey = (accountId: string) => `sme_portal_v2_active:${accountId}`;
type Readiness={dataReady:boolean;canSubmit:false;issues:{code:string;path:string;step:number;message:string}[];note:string};
function readRecovery(accountId: string, id: string): DraftRecovery | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(recoveryKey(accountId, id)) || 'null');
    return value && typeof value.data === 'object' && value.data !== null && !Array.isArray(value.data) && Number.isSafeInteger(value.baseRevision) ? value : null;
  } catch { return null; }
}
type FieldProps = { path: string; label: string; value?: string | number; type?: string; hint?: string; error?: string; onChange: (value: string | number | undefined) => void; readOnly?: boolean; options?: Record<string, string>; };
function Field({ path, label, value, type = 'text', hint, error, onChange, readOnly, options }: FieldProps) {
  return <label className={`v2-field ${type === 'textarea' ? 'v2-wide' : ''}`} htmlFor={`v2-${path}`}>
    <span>{label}</span>
    {options ? <select id={`v2-${path}`} value={value ?? ''} disabled={readOnly} aria-invalid={!!error} aria-describedby={error ? `v2-error-${path}` : undefined} onChange={e => onChange(e.target.value || undefined)}><option value="">Chọn thông tin</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
      : type === 'textarea' ? <textarea id={`v2-${path}`} rows={3} maxLength={4000} value={value ?? ''} readOnly={readOnly} aria-invalid={!!error} aria-describedby={error ? `v2-error-${path}` : undefined} onChange={e => onChange(e.target.value)} />
        : <input id={`v2-${path}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={type === 'number' ? 'any' : undefined} maxLength={4000} value={value ?? ''} readOnly={readOnly} aria-invalid={!!error} onChange={e => onChange(type === 'number' ? e.target.value === '' ? undefined : Number(e.target.value) : e.target.value)} />}
    {hint && <small>{hint}</small>}{error && <small id={`v2-error-${path}`} className="portal-error">{error}</small>}
  </label>;
}
const labels: Record<string, string> = { companyName: 'Tên doanh nghiệp', taxCode: 'Mã số thuế', companyType: 'Loại hình doanh nghiệp', industry: 'Ngành nghề hoạt động', establishedDate: 'Ngày thành lập', establishedYear: 'Năm thành lập', address: 'Địa chỉ trụ sở', representativeName: 'Người đại diện pháp luật', phone: 'Điện thoại doanh nghiệp', contactName: 'Người liên hệ hồ sơ', contactPosition: 'Chức vụ người liên hệ', contactPhone: 'Điện thoại người liên hệ', contactEmail: 'Email liên hệ', annualRevenue: 'Doanh thu gần nhất (VNĐ)', revenuePeriod: 'Kỳ báo cáo doanh thu', charterCapital: 'Vốn điều lệ (VNĐ)', loanType: 'Loại khoản vay', loanPurpose: 'Mục đích vay', proposedAmount: 'Số tiền đề nghị ngân hàng (VNĐ)', loanTermMonths: 'Thời hạn dự kiến (tháng)', neededAt: 'Thời điểm cần vốn', preferredBranch: 'Chi nhánh mong muốn', collateral: 'Thông tin bảo đảm', hasExistingDebt: 'Dư nợ hiện tại', capitalPlan: 'Phương án vốn' };
function show(value: unknown): string {
  if (value === undefined || value === '') return 'Chưa khai';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return value.toLocaleString('vi-VN');
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('mode' in o) return `${({ PROPOSED: 'Có tài sản bảo đảm', NONE_REQUESTED: 'Đề nghị không bảo đảm', UNDECIDED: 'Chưa xác định' } as Record<string, string>)[String(o.mode)] || 'Chưa xác định'}${o.description ? ` · ${o.description}` : ''}`;
    return Object.entries(o).map(([key, item]) => {
      if (key === 'costs' && Array.isArray(item)) return item.map((cost: { name?: string; amount?: number; plannedAt?: string }, i) => `Hạng mục ${i + 1}: ${cost.name || 'Chưa nhập tên'} · ${money(cost.amount)} · Dự kiến chi: ${cost.plannedAt || 'Chưa khai'}`).join('\n');
      const names: Record<string, string> = { businessActivity: 'Hoạt động cần tài trợ', ownFunds: 'Vốn tự có', otherFunds: 'Nguồn vốn khác', otherFundsSource: 'Mô tả nguồn khác', useFrom: 'Bắt đầu sử dụng vốn', useTo: 'Kết thúc sử dụng vốn', repaymentSource: 'Nguồn thu trả nợ', recoveryDate: 'Thu hồi vốn dự kiến' };
      return `${names[key] || key}: ${['ownFunds', 'otherFunds'].includes(key) ? money(item as number | undefined) : show(item)}`;
    }).join('\n');
  }
  return loanTypes[String(value)] || String(value);
}

export function PortalWizard({ initial, draftId, account, config, onBack, onSaved }: { initial: PortalRequest | null; draftId: string; account: PortalAccount; config: PortalFormConfig; onBack: () => void; onSaved: (request: PortalRequest) => void }) {
  const [recovery] = useState(() => readRecovery(account.id, draftId));
  const [initialState] = useState(() => initialDraftState(initial, recovery, canEditCycle(initial, config), { contactName: account.contactName, contactPhone: account.phone, contactEmail: account.email }));
  const [retainedRecovery, setRetainedRecovery] = useState(initialState.retainedRecovery);
  const [request, setRequest] = useState(initial);
  const [data, setData] = useState<PortalData>(initialState.data);
  const [step, setStep] = useState(initialState.step);
  const [dirty, setDirty] = useState(initialState.dirty);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [pendingFiles, setPendingFiles] = useState(0); const [storageError, setStorageError] = useState('');
  const [readiness,setReadiness]=useState<Readiness|null>(null);const [readinessError,setReadinessError]=useState('');
  const [conflict, setConflict] = useState(initialState.conflict);
  const conflictRef = useRef(conflict);
  const [remote, setRemote] = useState<PortalRequest | null>(null);
  const [checklist, setChecklist] = useState<PortalChecklist | null>(null); const [checklistError, setChecklistError] = useState('');
  const [assessmentRevision,setAssessmentRevision]=useState<number|undefined>();
  const [showErrors, setShowErrors] = useState(false);
  const requestRef = useRef(request); const dataRef = useRef(data); const dirtyRef = useRef(dirty); const lock = useRef(false);
  const baseRevision = useRef(initialState.baseRevision);
  const editable = canEditCycle(request,config);
  const supportedTypes=config.supportedLoanTypes??['VAY_VON_LUU_DONG'];
  const productOptions=loanTypeOptions(loanTypes,supportedTypes,data.loanType);
  const approvedAssessment=checklist?.approvedIntakeAssessment;
  const canSendApproved=canSendCycle({enabled:!!config.canSubmit,editable,dirty,busy,conflict,pendingFiles,dataReady:approvedAssessment?.dataReady===true,assessmentRevision,revision:request?.revision});
  const issues = validateV2(normalizeV2(data), step === 5 || showErrors); const totals = capitalTotals(data);
  const issueFor = (path: string) => showErrors ? issues.find(issue => issue.path === path && issue.severity === 'error')?.message : undefined;
  const stash = (next: PortalData, nextStep = step) => {
    if (!dirtyRef.current) return;
    try { sessionStorage.setItem(recoveryKey(account.id, draftId), JSON.stringify({ data: next, baseRevision: baseRevision.current, step: nextStep, conflict: conflictRef.current, updatedAt: new Date().toISOString() })); setStorageError(''); }
    catch { setStorageError('Trình duyệt không lưu được bản khôi phục. Hãy Lưu nháp trước khi tải lại hoặc đóng trang.'); }
  };
  useEffect(() => { stash(data, step); }, [data, step]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirtyRef.current || pendingFiles > 0 || lock.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [pendingFiles]);
  useEffect(() => {
    if (!request) return;
    let active = true; setChecklistError('');setAssessmentRevision(undefined);
    portalApi.get<PortalChecklist>(`/requests/${request.id}/checklist`).then(value => { if (active) {setChecklist(value);setAssessmentRevision(request.revision);} }).catch(err => { if (active) setChecklistError((err as Error).message); });
    return () => { active = false; };
  }, [request?.id, request?.revision]);
  useEffect(()=>{if(!request)return;let current=true;setReadinessError('');setReadiness(null);portalApi.get<Readiness>(`/requests/${request.id}/readiness`).then(r=>{if(current)setReadiness(r);}).catch(e=>{if(current)setReadinessError((e as Error).message);});return()=>{current=false;};},[request?.id,request?.revision]);
  function change(next: PortalData) { dataRef.current = next; dirtyRef.current = true; setData(next); setDirty(true); setNotice(''); stash(next); }
  function markConflict() { conflictRef.current = true; setConflict(true); dirtyRef.current = true; setDirty(true); stash(dataRef.current); }
  function assign(key: keyof PortalData, value: unknown) { change({ ...dataRef.current, [key]: value }); }
  function plan(key: string, value: unknown) { change({ ...dataRef.current, capitalPlan: { ...dataRef.current.capitalPlan, [key]: value } }); }
  function received(saved: PortalRequest, formSaved = false) {
    const locked = !canEditCycle(saved, config);
    const unsent = locked && dirtyRef.current && !sameDraft(dataRef.current, saved.data);
    if (unsent) { stash(dataRef.current); setRetainedRecovery(readRecovery(account.id, draftId)); }
    requestRef.current = saved; baseRevision.current = saved.revision ?? 0; setRequest(saved);
    if (formSaved || locked) {
      dataRef.current = saved.data; dirtyRef.current = false; setData(saved.data); setDirty(false);
      if (!unsent && !retainedRecovery) try { sessionStorage.removeItem(recoveryKey(account.id, draftId)); } catch { /* Storage warning handled on next edit. */ }
    }
    onSaved(saved);
  }
  async function persist(): Promise<PortalRequest> {
    if (!editable) throw new Error('Bản nháp này hiện không mở chỉnh sửa.');
    if (conflict) throw new Error('Cần đối chiếu phiên bản trước khi lưu tiếp. Nội dung đang nhập được giữ lại.');
    if (requestRef.current && !dirtyRef.current) return requestRef.current;
    const errors = validateV2(normalizeV2(dataRef.current)).filter(issue => issue.severity === 'error');
    if (errors.length) { setShowErrors(true); setStep(errors[0].step); throw new Error(errors[0].message); }
    const payload = normalizeV2(dataRef.current);
    const saved = requestRef.current ? await portalApi.put<PortalRequest>(`/requests/${requestRef.current.id}`, { data: payload, expectedRevision: baseRevision.current }) : await portalApi.post<PortalRequest>('/requests', { formVersion: 2, clientRequestId: draftId, data: payload });
    // A create response may be a retry of a previously committed creation. If it
    // differs, retain local edits and use CAS on the next explicit save.
    if (!requestRef.current && !sameDraft(saved.data, payload)) {
      requestRef.current = saved; setRequest(saved); markConflict();
      throw new Error('Bản nháp đã tồn tại sau lần thử trước. Hãy đối chiếu với nội dung đang nhập trước khi lưu.');
    }
    received(saved, true); return saved;
  }
  async function run(action: () => Promise<void>): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); return true; }
    catch (err) { if (err instanceof PortalApiError && err.status === 409) markConflict(); setError((err as Error).message); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function mutate(action: (current: PortalRequest) => Promise<PortalRequest>): Promise<boolean> {
    return run(async () => {
      const current = await persist(); const saved = await action(current);
      // An idempotent file retry may return a newer form edited in another tab.
      // Never pair its revision with our old form without explicit resolution.
      if (!sameDraft(saved.data, dataRef.current)) {
        markConflict(); setRemote(saved);
        throw new Error('Tài liệu đã được xử lý nhưng thông tin hồ sơ đã thay đổi ở phiên khác. Hãy đối chiếu trước khi tiếp tục; nội dung đang nhập được giữ nguyên.');
      }
      received(saved); setNotice('Đã cập nhật tài liệu và lưu trên hệ thống.');
    });
  }
  async function navigate(next: number) {
    if (busy || next === step) return;
    if (editable && !conflict) { const ok = await run(async () => { await persist(); }); if (!ok) return; }
    setStep(next); setShowErrors(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function latest() {
    if (!requestRef.current || lock.current) return;
    await run(async () => { setRemote(await portalApi.get<PortalRequest>(`/requests/${requestRef.current!.id}`)); });
  }
  function useRemote(keepLocal: boolean) {
    if (!remote) return;
    keepLocal = keepLocal && canEditCycle(remote, config);
    if (keepLocal && !window.confirm('Bạn muốn giữ toàn bộ nội dung đang nhập để lưu lên phiên bản mới nhất? Những trường khác nhau trong bản trên hệ thống sẽ được thay bằng nội dung của bạn khi bạn bấm Lưu nháp.')) return;
    received(remote, !keepLocal); conflictRef.current = false; setConflict(false); setRemote(null); setError('');
    if (keepLocal) { dirtyRef.current = true; setDirty(true); stash(dataRef.current); setNotice('Đã chọn nội dung của bạn. Kiểm tra lại rồi bấm Lưu nháp.'); }
    else setNotice('Đã sử dụng bản mới nhất trên hệ thống.');
  }
  function jump(path: string, targetStep: number) { setStep(targetStep); setShowErrors(true); setTimeout(() => document.getElementById(`v2-${path}`)?.focus(), 50); }
  async function submitTestRequest() {
    if (!config.canSubmit || pendingFiles > 0 || !editable || conflict || (config.intakeCycleEnabled&&!canSendApproved)) return;
    if (!window.confirm(config.intakeCycleEnabled?'Xác nhận gửi đề nghị và tài liệu hiện tại cho ngân hàng kiểm tra? Bản gửi này được lưu và khóa chỉnh sửa.':'Gửi đề nghị bằng policy thử nghiệm trong môi trường cách ly? Đây không phải chính sách ngân hàng được duyệt để vận hành.')) return;
    await run(async () => {
      const saved = await persist();
      const sent = await portalApi.post<PortalRequest>(`/requests/${saved.id}/submit`, { expectedRevision: saved.revision, documentIds: saved.documents.map(doc => doc.id) });
      received(sent, true); setNotice(config.intakeCycleEnabled?'Đã gửi đề nghị cho ngân hàng kiểm tra. Chưa tạo hồ sơ vay hoặc bắt đầu SLA.':'Đã gửi đề nghị vào hàng chờ phân công trong môi trường test cách ly. Chưa tạo hồ sơ vay hoặc bắt đầu SLA.');
    });
  }
  function field(key: keyof PortalData, options: Partial<FieldProps> = {}) {
    return <Field key={key} path={key} label={labels[key]} value={data[key] as string | number | undefined} error={issueFor(key)} onChange={value => assign(key, value)} {...options} />;
  }
  function planField(key: string, label: string, type = 'text') {
    return <Field path={`capitalPlan.${key}`} label={label} value={data.capitalPlan?.[key as keyof NonNullable<PortalData['capitalPlan']>] as string | number | undefined} type={type} error={issueFor(`capitalPlan.${key}`)} onChange={value => plan(key, value)} />;
  }
  return <section className="portal-wizard">
    <button className="portal-link portal-back" disabled={busy || pendingFiles > 0} onClick={() => void run(async () => { if (dirtyRef.current) await persist(); onBack(); })}><ArrowLeft size={16} /> Danh sách đề nghị</button>
    <div className="v2-heading"><div><span className="portal-eyebrow">HỒ SƠ DOANH NGHIỆP · PHIÊN BẢN 2</span><h1>{request?.reference || 'Chuẩn bị đề nghị vay'}</h1><p>Khai thông tin từng bước, lưu nháp và tiếp tục khi thuận tiện.</p></div><span className="portal-status">{request?.status === 'RETURNED' ? 'Đang chỉnh sửa theo yêu cầu' : request?.status === 'DRAFT' || !request ? 'Bản nháp' : 'Đã khóa chỉnh sửa'}</span></div>
    {request&&request.status!=='DRAFT'&&config.intakeCycleEnabled&&<IntakeCyclePanel key={request.id} request={request} mode="portal" onUpdated={r=>{if(dirtyRef.current){setRemote(r);markConflict();}else{received(r,true);setNotice('Đã tải trạng thái mới nhất.');}}}/>}
    <nav className="v2-stepper" aria-label="Các bước chuẩn bị hồ sơ"><ol>{steps.map((name, index) => <li key={name} className={step === index + 1 ? 'active' : step > index + 1 ? 'visited' : ''}><button disabled={busy} aria-current={step === index + 1 ? 'step' : undefined} onClick={() => void navigate(index + 1)}><span>{index + 1}</span><strong>{name}</strong></button></li>)}</ol><div className="v2-progress" role="progressbar" aria-label="Vị trí trong biểu mẫu" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step}><span style={{ width: `${step * 20}%` }} /></div></nav>
    <div className="v2-save-status" role="status"><span className={dirty ? 'unsaved' : 'saved'}>{busy ? 'Đang lưu / xử lý…' : dirty ? 'Có nội dung chưa lưu trên hệ thống' : 'Đã lưu trên hệ thống'}</span><span>Bước {step}/5 · Tiến độ khai báo, không phải kết quả xét duyệt</span></div>
    {initialState.recoveryApplied && editable && <p className="portal-notice">Đã khôi phục nội dung chưa lưu trong tab này. File chưa tải lên cần được chọn lại; file đã lưu trên hệ thống vẫn được giữ nguyên.</p>}
    {retainedRecovery && <details className="portal-card v2-retained-recovery"><summary>Nội dung chưa gửi được giữ riêng trong tab</summary><p>Biểu mẫu bên dưới hiển thị bản đã lưu trên hệ thống. Nội dung sau đây chưa được ngân hàng tiếp nhận và không thay đổi bản đã gửi.</p><dl>{Object.keys(labels).filter(key => retainedRecovery.data[key as keyof PortalData] !== undefined).map(key => <div key={key}><dt>{labels[key]}</dt><dd>{show(retainedRecovery.data[key as keyof PortalData])}</dd></div>)}</dl></details>}
    {error && <p role="alert" className="portal-error portal-alert">{error}</p>}{storageError && <p role="alert" className="portal-error portal-alert">{storageError}</p>}{notice && <p role="status" className="portal-notice">{notice}</p>}
    {!editable && <p className="v2-policy"><LockKeyhole size={18} />{request && request.status !== 'DRAFT' ? 'Hồ sơ đã khóa, chỉ được xem.' : 'Chế độ lưu nháp V2 hiện chưa được bật hoặc phiên bản không tương thích. Nội dung đã lưu vẫn có thể xem.'}</p>}
    {config.rolloutEnabled&&<p className="portal-notice">Tiếp nhận vay vốn lưu động cho sản xuất, thương mại và dịch vụ, tối đa 10 tỷ đồng mỗi hồ sơ. Ngoài phạm vi này, vui lòng liên hệ ngân hàng.</p>}
    {Number(data.proposedAmount)>10000000000&&<p role="alert" className="portal-error">Số tiền vượt giới hạn tiếp nhận 10 tỷ đồng. Bạn có thể lưu nháp; cần điều chỉnh hoặc liên hệ ngân hàng trước khi gửi.</p>}
    {conflict && <section className="v2-conflict portal-card" role="alert"><h2>Bản nháp đã có phiên bản khác</h2><p>Nội dung đang nhập được giữ lại. Hãy đối chiếu trước khi lưu để tránh ghi đè thay đổi ở tab khác.</p><button className="btn btn-secondary" disabled={busy} onClick={() => void latest()}>Xem bản mới nhất</button>{remote && <><div className="v2-compare"><section><h3>Nội dung đang nhập</h3>{Object.keys(labels).filter(key => JSON.stringify(data[key as keyof PortalData]) !== JSON.stringify(remote.data[key as keyof PortalData])).map(key => <p key={key}><strong>{labels[key]}:</strong> {show(data[key as keyof PortalData])}</p>)}</section><section><h3>Bản trên hệ thống</h3>{Object.keys(labels).filter(key => JSON.stringify(data[key as keyof PortalData]) !== JSON.stringify(remote.data[key as keyof PortalData])).map(key => <p key={key}><strong>{labels[key]}:</strong> {show(remote.data[key as keyof PortalData])}</p>)}</section></div><div className="portal-actions"><button className="btn btn-secondary" onClick={() => useRemote(false)}>Dùng bản trên hệ thống</button>{canEditCycle(remote,config)&&<button className="btn btn-primary" onClick={() => useRemote(true)}>Giữ nội dung đang nhập để lưu tiếp</button>}</div></>}</section>}
    <fieldset className="portal-fieldset" disabled={busy || !editable || conflict}>
      {step === 1 && <section className="portal-card v2-form-card"><div className="portal-card-title"><Building2 size={22} /><div><h2>Thông tin doanh nghiệp</h2><p>Thông tin phục vụ tiếp nhận. Mã số thuế không thay thế việc đối chiếu pháp lý của ngân hàng.</p></div></div><div className="portal-field-grid">
        {field('companyName')}{field('taxCode', { readOnly:!!request?.submittedAt,hint: '10 hoặc 13 chữ số; thay chủ thể sau gửi cần lập đề nghị mới.' })}{field('companyType', { hint: 'Ví dụ: Công ty TNHH, Công ty cổ phần.' })}{field('industry')}
        {data.businessScope==='SERVICES'&&<Field path="serviceProofMode" label="Căn cứ doanh thu dịch vụ" value={data.serviceProofMode} options={{CONTRACT_OR_ORDER:'Hợp đồng hoặc đơn đặt dịch vụ',ACCEPTANCE_INVOICE:'Nghiệm thu kèm hóa đơn'}} onChange={v=>assign('serviceProofMode',v)}/>}
        <Field path="businessScope" label="Phạm vi hoạt động" value={data.businessScope} options={config.rolloutEnabled?{MANUFACTURING:'Sản xuất',TRADING:'Thương mại',SERVICES:'Dịch vụ',OTHER:'Khác / cần tư vấn'}:{MANUFACTURING:'Doanh nghiệp sản xuất',OTHER:'Hoạt động khác'}} onChange={value=>assign('businessScope',value)}/>
        <Field path="representative.mode" label="Tư cách người gửi" value={data.representative?.mode} options={{LEGAL_REPRESENTATIVE:'Người đại diện pháp luật',AUTHORIZED:'Người được ủy quyền'}} onChange={value=>assign('representative',{...data.representative,mode:value})}/>
        {data.representative?.mode==='AUTHORIZED'&&<Field path="representative.name" label="Họ tên người được ủy quyền" value={data.representative.name} onChange={value=>assign('representative',{...data.representative,name:value})}/>}
        {field('establishedDate', { type: 'date', onChange: value => change({ ...dataRef.current, establishedDate: value as string | undefined, establishedYear: value ? Number(String(value).slice(0, 4)) : undefined }) })}
        {!data.establishedDate && field('establishedYear', { type: 'number', hint: 'Nhập năm thực tế nếu chưa biết ngày chính xác; không tạo ngày giả.' })}
        {field('address')}{field('representativeName')}{field('phone', { type: 'tel' })}{field('contactName', { hint: 'Người phối hợp chuẩn bị hồ sơ, có thể khác người đại diện pháp luật.' })}{field('contactPosition')}{field('contactPhone', { type: 'tel' })}{field('contactEmail', { type: 'email' })}{field('annualRevenue', { type: 'number' })}{field('revenuePeriod', { hint: 'Năm lịch hoàn thành gần nhất, dạng YYYY; không quy đổi tháng/quý.' })}{field('charterCapital', { type: 'number' })}
      </div><p className="v2-footnote">Có thể lưu khi chưa điền đủ. Chính sách mô phỏng áp dụng năm lịch hoàn thành gần nhất; ví dụ gửi năm 2026 sử dụng năm 2025.</p></section>}
      {step === 2 && <section className="portal-card v2-form-card"><h2>Nhu cầu vay vốn</h2><p>Ghi rõ mục đích và thời điểm cần vốn để ngân hàng có cơ sở tiếp nhận.</p>{editable&&data.loanType&&!supportedTypes.includes(data.loanType)&&<p role="alert" className="portal-error">Loại vay đang lưu chưa được tiếp nhận trên cổng V2. Chọn vốn lưu động hoặc liên hệ ngân hàng; dữ liệu cũ được giữ để đối chiếu.</p>}<div className="portal-field-grid">{field('loanType', { options: productOptions })}{field('proposedAmount', { type: 'number', hint: 'Dùng chung cho phương án vốn ở bước 3.' })}{field('loanPurpose', { type: 'textarea', hint: 'Ví dụ: Mua nguyên vật liệu để thực hiện đơn hàng sản xuất.' })}{field('loanTermMonths', { type: 'number' })}{field('neededAt', { type: 'date' })}{field('preferredBranch', { hint: 'Tùy chọn; đây là mong muốn, chưa phải xác nhận ngân hàng tiếp nhận.' })}
        <Field path="collateral.mode" label="Hình thức bảo đảm dự kiến" value={data.collateral?.mode} options={{ PROPOSED: 'Có tài sản bảo đảm', NONE_REQUESTED: 'Đề nghị không bảo đảm', UNDECIDED: 'Chưa xác định' }} onChange={value => assign('collateral', { ...data.collateral, mode: value })} />
        {data.collateral?.mode === 'PROPOSED' && <Field path="collateral.description" label="Thông tin tài sản dự kiến" value={data.collateral.description} type="textarea" hint="Mô tả loại tài sản và giấy tờ đang có; chưa cần tự xác định giá trị thẩm định." onChange={value => assign('collateral', { ...data.collateral, description: value })} />}
        {data.collateral?.mode === 'NONE_REQUESTED' && <p className="v2-guidance">Đã ghi nhận đề nghị không bảo đảm. Bước chuẩn bị không bắt tải giấy tờ tài sản; ngân hàng sẽ xem xét theo chính sách được phê duyệt.</p>}
        <Field path="hasExistingDebt" label="Doanh nghiệp có dư nợ hiện tại?" value={data.hasExistingDebt === undefined ? '' : data.hasExistingDebt ? 'yes' : 'no'} options={{ yes: 'Có dư nợ', no: 'Không có dư nợ' }} onChange={value => assign('hasExistingDebt', value === undefined ? undefined : value === 'yes')} />
        {data.hasExistingDebt && <p className="v2-guidance">Chuẩn bị thông tin khoản vay, dư nợ và lịch trả nợ hiện có tại nhóm F ở bước Tài liệu. Không yêu cầu khai chỉ số thẩm định tín dụng.</p>}
      </div></section>}
      {step === 3 && <section className="portal-card v2-form-card"><h2>Phương án sử dụng vốn</h2><p>Diễn giải nhu cầu vốn bằng các hạng mục cụ thể. Không cần tính chỉ số thẩm định chuyên sâu.</p><div className="portal-field-grid">{planField('businessActivity', 'Hoạt động sản xuất / kinh doanh cần tài trợ', 'textarea')}</div><div className="v2-cost-heading"><h3>Hạng mục chi phí</h3><button className="btn btn-secondary" onClick={() => plan('costs', [...(data.capitalPlan?.costs ?? []), {}])} disabled={(data.capitalPlan?.costs?.length ?? 0) >= 100}><Plus size={16} /> Thêm hạng mục</button></div>
        <div className="v2-cost-list">{!data.capitalPlan?.costs?.length && <p className="v2-empty">Thêm các khoản chi như nguyên vật liệu, sản xuất hoặc chi phí phục vụ đơn hàng.</p>}{data.capitalPlan?.costs?.map((cost, index) => <div className="v2-cost-row" key={index}><span className="v2-row-number">{index + 1}</span><Field path={`capitalPlan.costs.${index}.name`} label="Hạng mục" value={cost.name} onChange={value => plan('costs', data.capitalPlan!.costs!.map((item, i) => i === index ? { ...item, name: value } : item))} /><Field path={`capitalPlan.costs.${index}.amount`} label="Số tiền (VNĐ)" type="number" value={cost.amount} error={issueFor(`capitalPlan.costs.${index}.amount`)} onChange={value => plan('costs', data.capitalPlan!.costs!.map((item, i) => i === index ? { ...item, amount: value } : item))} /><Field path={`capitalPlan.costs.${index}.plannedAt`} label="Dự kiến chi" type="date" value={cost.plannedAt} onChange={value => plan('costs', data.capitalPlan!.costs!.map((item, i) => i === index ? { ...item, plannedAt: value } : item))} /><button className="portal-link portal-danger v2-remove-cost" aria-label={`Xóa hạng mục ${index + 1}`} onClick={() => plan('costs', data.capitalPlan!.costs!.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>)}</div>
        <div className="v2-finance-summary"><div><span>Tổng nhu cầu vốn</span><strong>{money(totals.totalCosts)}</strong><small>Tự tính từ các hạng mục chi phí</small></div><div><span>Ngân hàng đề nghị tài trợ</span><strong>{money(data.proposedAmount)}</strong><button className="portal-link" onClick={() => void navigate(2)}>Chỉnh tại Nhu cầu vay →</button></div><div><span>Tổng nguồn vốn</span><strong>{money(totals.totalSources)}</strong><small>Ngân hàng + vốn tự có + nguồn khác</small></div></div>
        <div className="portal-field-grid">{planField('ownFunds', 'Vốn tự có (VNĐ)', 'number')}{planField('otherFunds', 'Nguồn vốn khác (VNĐ)', 'number')}{(data.capitalPlan?.otherFunds ?? 0) > 0 && planField('otherFundsSource', 'Mô tả nguồn vốn khác')}{planField('useFrom', 'Bắt đầu sử dụng vốn', 'date')}{planField('useTo', 'Kết thúc sử dụng vốn', 'date')}{planField('repaymentSource', 'Nguồn thu dự kiến để trả nợ', 'textarea')}{planField('recoveryDate', 'Thời điểm dự kiến thu hồi vốn', 'date')}</div>
        {totals.difference !== 0 && <p className="v2-guidance" role="status">Cần rà soát cân đối: tổng chi phí và tổng nguồn vốn chênh {money(Math.abs(totals.difference))}. Bạn vẫn có thể lưu nháp để hoàn thiện sau.</p>}
      </section>}

      <div hidden={step !== 4}>{request && <DocumentManager request={request} config={config} data={data} disabled={busy || !editable || conflict} onMutate={mutate} onPendingChange={setPendingFiles} onConflict={markConflict} />}{!request && step === 4 && <section className="portal-card"><p>Lưu nháp trước khi tải tài liệu.</p></section>}</div>
      <section hidden={step!==4} className="portal-card"><h3>Nguồn doanh thu năm</h3><p>Doanh thu năm phải có kỳ YYYY và tài liệu nguồn. Không tự quy đổi số quý/tháng. Chưa có dữ liệu năm thì tiếp tục lưu nháp, không phải từ chối tín dụng.</p><label>Tài liệu BCTC nguồn<select id="v2-annualRevenueBasis.documentId" disabled={busy||!editable||conflict} value={data.annualRevenueBasis?.documentId??''} onChange={e=>assign('annualRevenueBasis',{...data.annualRevenueBasis,documentId:e.target.value||undefined})}><option value="">Chọn tài liệu đã tải</option>{request?.documents.filter(d=>d.documentGroup==='B'&&d.coverage?.some(c=>c.documentTypeCode==='B_FINANCIAL_STATEMENTS')).map(d=><option key={d.id} value={d.id}>{d.fileName} · {d.coverage?.map(c=>c.period).filter(Boolean).join(', ')}</option>)}</select></label><label><input id="v2-annualRevenueBasis.fullYearCompleted" type="checkbox" disabled={busy||!editable||conflict} checked={data.annualRevenueBasis?.fullYearCompleted===true} onChange={e=>assign('annualRevenueBasis',{...data.annualRevenueBasis,fullYearCompleted:e.target.checked})}/>Tôi xác nhận nguồn doanh thu khai báo thuộc kỳ năm đã hoàn thành.</label><p>Đây là khai báo nguồn dữ liệu, chưa phải CBTD xác minh BCTC đủ thành phần.</p></section>
      {step === 4 && approvedAssessment && <section className="portal-card approved-checklist"><ChecklistOverview assessment={approvedAssessment} />{reviewNotices(checklist).filter(item => item.step === 4 && !item.path.startsWith('document:')).map(item => <p key={item.path}><button type="button" className="portal-link" onClick={() => jump(item.path, item.step)}>{item.message}</button></p>)}</section>}
      {step === 5 && <PortalReview data={data} request={request} config={config} checklist={checklist} issues={issues}
        busy={busy} editable={editable} conflict={conflict} dirty={dirty} pendingFiles={pendingFiles}
        fresh={assessmentRevision === request?.revision} checkError={!!checklistError || (!config.intakeCycleEnabled && !!readinessError)}
        readiness={!config.intakeCycleEnabled ? readiness : undefined}
        submitDisabled={Number(data.proposedAmount)>10000000000|| (config.intakeCycleEnabled?!canSendApproved:busy||!editable||conflict||!config.canSubmit||pendingFiles>0||checklist?.cannotSubmit!==false)}
        displayValue={show} onJump={jump} onSubmit={() => void submitTestRequest()}
        onSave={() => void run(async () => { await persist(); setNotice("Đã lưu bản nháp trên hệ thống."); })}
        onDeclaration={accepted => assign('submissionDeclaration', { accepted, version: config.approvedIntakePolicy!.policy.declaration.version })} />}
      </fieldset>
    <div className="v2-wizard-footer"><button className="btn btn-secondary" disabled={busy || step === 1} onClick={() => void navigate(step - 1)}><ArrowLeft size={16} /> Quay lại</button>{step < 5 && <><span className="v2-footer-spacer" /><button className="btn btn-secondary" disabled={busy || !editable || conflict} onClick={() => void run(async () => { await persist(); setNotice('Đã lưu bản nháp trên hệ thống.'); })}><Save size={16} /> Lưu nháp</button><button className="btn btn-primary" disabled={busy} onClick={() => void navigate(step + 1)}>Tiếp tục <ArrowRight size={16} /></button></>}</div>
    <p className="v2-footnote"><FileText size={14} /> Chỉ nội dung có trạng thái “Đã lưu trên hệ thống” được ngân hàng lưu trữ. Bản khôi phục trong tab không thay thế bản lưu trên hệ thống.</p>
  </section>;
}
