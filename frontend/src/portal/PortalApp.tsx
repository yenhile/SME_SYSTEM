import { Fragment, useEffect, useRef, useState } from 'react';
import { PortalWizard, activeDraftKey } from './PortalWizard';
import type { PortalFormConfig } from './model';
import { ArrowLeft, Building2, CheckCircle2, Clock, FileEdit, FileText, LogOut, Plus, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { portalApi, PORTAL_TOKEN_KEY, setPortalToken, syncPortalSession, portalSessionVersion, isPortalSessionCurrent } from './client';
import { draftPayload, fields, groups, loanTypes, requestStatus, validateRequest, type GroupCode, type PortalAccount, type PortalData, type PortalRequest } from './model';
import '../portal.css';
import './review.css';
import { PortalAuth } from './PortalAuth';
import { DocumentLink } from './DocumentLink';
import { SupplementPanel } from '../components/SupplementPanel';
import { PortalApplicationTracking, type PortalTracking } from './PortalApplicationTracking';
import { PortalHome } from './PortalHome';
import type { SupplementView } from './supplements';

export function RequestFields({ data, errors = {}, readOnly = false, onChange }: { data: PortalData; errors?: Record<string, string>; readOnly?: boolean; onChange?: (data: PortalData) => void }) {
  return <div className="portal-field-grid">{fields.map(field => <label key={field.key}>{field.label}<span className="portal-required"> *</span>{field.key === 'loanType' ? <select value={data.loanType ?? ''} disabled={readOnly} aria-invalid={!!errors[field.key]} onChange={e => onChange?.({ ...data, loanType: e.target.value })}><option value="">Chọn loại vay</option>{Object.entries(loanTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input type={field.type || 'text'} value={(data[field.key] as string | number | undefined) ?? ''} readOnly={readOnly} min={field.min} max={field.max} step={field.type === 'number' ? '1' : undefined} maxLength={field.key === 'taxCode' ? 13 : 1000} aria-invalid={!!errors[field.key]} onChange={e => onChange?.({ ...data, [field.key]: field.type === 'number' ? e.target.value === '' ? undefined : Number(e.target.value) : e.target.value })} />}{errors[field.key] && <small className="portal-error">{errors[field.key]}</small>}</label>)}</div>;
}

function RequestEditor({ initial, onBack, onSaved, onClone }: { onClone?: (r:PortalRequest)=>Promise<void>; initial: PortalRequest | null; onBack: () => void; onSaved: () => void }) {
  const [request, setRequest] = useState(initial); const [data, setData] = useState<PortalData>(initial?.data ?? {});
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [files, setFiles] = useState<Partial<Record<GroupCode, File[]>>>({}); const [fileKeys, setFileKeys] = useState<Partial<Record<GroupCode, number>>>({});
  const editable = !request || request.status === 'DRAFT';
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  async function save() {
    const validation = validateRequest(data, false); setErrors(validation); if (Object.keys(validation).length) throw new Error('Vui lòng kiểm tra các trường thông tin được đánh dấu.');
    const payload = { data: draftPayload(data) };
    const saved = request ? await portalApi.put<PortalRequest>(`/requests/${request.id}`, payload) : await portalApi.post<PortalRequest>('/requests', payload);
    setRequest(saved); setData(saved.data); setDirty(false); onSaved(); return saved;
  }
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <section className="portal-editor"><button className="portal-link portal-back" disabled={busy} onClick={() => { if (!dirty || window.confirm('Thông tin chưa lưu sẽ bị mất. Quay lại danh sách?')) onBack(); }}><ArrowLeft size={16} /> Danh sách đề nghị</button><div className="portal-section-heading"><div><span className="portal-eyebrow">ĐỀ NGHỊ VAY DOANH NGHIỆP</span><h1>{request?.reference || 'Tạo đề nghị vay'}</h1></div><span className={`portal-status ${request?.status === 'ACCEPTED' ? 'accepted' : ''}`}>{requestStatus[request?.status ?? 'DRAFT']}</span></div>
    {request?.formVersion!==2&&request?.status==='DRAFT'&&onClone&&<div className="portal-notice"><p>Bản nháp V1 được giữ nguyên. Chuyển sang V2 bằng bản sao dữ liệu; tài liệu cần tải lại và khai bổ sung theo checklist mới.</p><button className="btn btn-primary" disabled={busy} onClick={()=>void run(()=>onClone(request))}>Tạo đề nghị V2 từ nháp này</button></div>}
    {!editable && <p className="portal-notice">Đề nghị đã gửi và được khóa chỉnh sửa.{request?.submittedAt && ` Ngày gửi: ${new Date(request.submittedAt).toLocaleString('vi-VN')}.`}{request?.status === 'ACCEPTED' && ' Ngân hàng đã tiếp nhận để xử lý.'}</p>}
    {error && <p role="alert" className="portal-error portal-alert">{error}</p>}{notice && <p role="status" className="portal-notice">{notice}</p>}
    <fieldset disabled={busy} className="portal-fieldset"><section className="portal-card"><div className="portal-card-title"><Building2 size={20} /><div><h2>Thông tin doanh nghiệp & nhu cầu vốn</h2><p>Có thể lưu nháp khi chưa điền đủ. Các trường có dấu * cần hoàn tất trước khi gửi.</p></div></div><RequestFields data={data} errors={errors} readOnly={!editable} onChange={next => { setData(next); setDirty(true); setConfirmSubmit(false); }} /></section>
    <section className="portal-doc-section"><div className="portal-section-heading"><div><h2>Tài liệu đính kèm</h2><p>Hoàn tất cả 6 nhóm tài liệu trước khi gửi. Tối đa 10 MB mỗi tệp.</p></div></div><div className="portal-doc-grid">{groups.map(group => <section className="portal-card portal-doc-card" key={group.code}><div className="portal-group-heading"><span>{group.code}</span><h3>{group.name}</h3><small>{request?.documents.filter(doc => doc.documentGroup === group.code).length ?? 0} tệp</small></div><p>{group.description}</p><small>Định dạng: {group.accept.replaceAll('.', '').toUpperCase()}</small>
      <ul className="portal-file-list">{request?.documents.filter(doc => doc.documentGroup === group.code).map(doc => <li key={doc.id}><FileText size={16} /><div><DocumentLink fileName={doc.fileName} disabled={busy} load={() => portalApi.download(`/requests/${request.id}/documents/${doc.id}/download`)} /><small>{(doc.fileSize / 1024).toFixed(1)} KB</small></div>{editable && <button className="portal-link portal-danger" onClick={() => { if (window.confirm(`Xóa tệp “${doc.fileName}” khỏi bản nháp?`)) void run(async () => { await portalApi.delete(`/requests/${request.id}/documents/${doc.id}`); setRequest(current => current ? { ...current, documents: current.documents.filter(item => item.id !== doc.id) } : current); onSaved(); }); }}>Xóa</button>}</li>)}</ul>
      {editable && <div className="portal-upload"><input key={fileKeys[group.code] ?? 0} aria-label={`Chọn tệp nhóm ${group.code}`} type="file" multiple accept={group.accept} onChange={e => setFiles(current => ({ ...current, [group.code]: Array.from(e.target.files ?? []) }))} /><button className="btn btn-secondary" disabled={!files[group.code]?.length} onClick={() => void run(async () => {
        const pending = files[group.code] ?? [];
        for (const file of pending) { const extension = `.${file.name.split('.').pop()?.toLowerCase()}`; if (file.size > 10 * 1024 * 1024 || !group.accept.split(',').includes(extension)) { setErrors(current => ({ ...current, [group.code]: `Tệp ${file.name} không đúng định dạng hoặc vượt quá 10 MB.` })); return; } }
        const target = await save();
        for (const file of pending) {
          const form = new FormData(); form.append('documentGroup', group.code); form.append('file', file);
          await portalApi.post(`/requests/${target.id}/documents`, form);
          setFiles(current => ({ ...current, [group.code]: (current[group.code] ?? []).filter(item => item !== file) }));
          const fresh = await portalApi.get<PortalRequest>(`/requests/${target.id}`); setRequest(fresh);
        }
        setFileKeys(current => ({ ...current, [group.code]: (current[group.code] ?? 0) + 1 })); setErrors(current => { const next = { ...current }; delete next[group.code]; return next; }); onSaved(); setNotice(`Đã tải tài liệu nhóm ${group.code}.`);
      })}>Tải lên{files[group.code]?.length ? ` (${files[group.code]?.length})` : ''}</button></div>}
      {errors[group.code] && <p role="alert" className="portal-error">{errors[group.code]}</p>}</section>)}</div></section>
    {editable && <section className="portal-card portal-submit"><div><h2>Kiểm tra và gửi đề nghị</h2><p>Sau khi gửi, thông tin và tài liệu sẽ được khóa để ngân hàng tiếp nhận. Gửi đề nghị chưa phải phê duyệt khoản vay.</p></div><div className="portal-actions"><button className="btn btn-secondary" onClick={() => void run(async () => { await save(); setNotice('Đã lưu bản nháp.'); })}>Lưu nháp</button><button className="btn btn-primary" onClick={() => { const validation = validateRequest(data, true, request?.documents ?? []); setErrors(validation); if (Object.keys(validation).length) { setError('Vui lòng hoàn tất thông tin và đủ 6 nhóm tài liệu trước khi gửi.'); setConfirmSubmit(false); } else { setError(''); setConfirmSubmit(true); } }}>Gửi đề nghị</button></div>{confirmSubmit && <div className="portal-confirm" role="alert"><p>Xác nhận thông tin đã chính xác và gửi đề nghị đến ngân hàng?</p><button className="btn btn-primary" onClick={() => void run(async () => { const saved = await save(); const submitted = await portalApi.post<PortalRequest>(`/requests/${saved.id}/submit`); setRequest(submitted); setConfirmSubmit(false); onSaved(); setNotice('Đề nghị đã được gửi thành công.'); })}>Xác nhận gửi</button><button className="btn btn-secondary" onClick={() => setConfirmSubmit(false)}>Quay lại kiểm tra</button></div>}</section>}</fieldset>
  </section>;
}

export function PortalApp() {
  const [resetToken,setResetToken]=useState<string|null>(()=>new URL(location.href).searchParams.get('reset'));
  const [account, setAccount] = useState<PortalAccount | null>(null); const [checking, setChecking] = useState(!!localStorage.getItem(PORTAL_TOKEN_KEY));
  const [requests, setRequests] = useState<PortalRequest[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [supplementCounts, setSupplementCounts] = useState<Record<string, number>>({});
  const [supplementErrors, setSupplementErrors] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, PortalTracking | undefined>>({}); const [outcomesFailed, setOutcomesFailed] = useState(false);
  const loadSequence = useRef(0);
  const openSequence = useRef(0);
  const [editor, setEditor] = useState<PortalRequest | null | undefined>(undefined);
  const [config, setConfig] = useState<PortalFormConfig | null>(null); const [draftId, setDraftId] = useState('');
  const accountRef = useRef(account); accountRef.current = account;
  const clearView = () => { accountRef.current = null; loadSequence.current++; openSequence.current++; setAccount(null); setRequests([]); setSupplementCounts({}); setSupplementErrors([]); setOutcomes({}); setOutcomesFailed(false); setLoading(false); setChecking(false); setEditor(undefined); setConfig(null); };
  const logout = () => { setPortalToken(null); clearView(); };
  useEffect(() => {
    let live = true;
    const url=new URL(location.href);
    if(url.searchParams.has('reset')){url.searchParams.delete('reset');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
    const expired = () => { clearView(); setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); };
    const changed = () => { clearView(); setError('Phiên doanh nghiệp đã thay đổi ở tab khác. Vui lòng đăng nhập lại; bản nháp được giữ riêng theo tài khoản.'); };
    const storage = (event: StorageEvent) => { if (event.key === PORTAL_TOKEN_KEY || event.key === null) syncPortalSession(); };
    window.addEventListener('sme-portal-session-expired', expired);
    window.addEventListener('sme-portal-session-changed', changed);
    window.addEventListener('storage', storage);
    const version = portalSessionVersion();
    if (resetToken) setChecking(false);
    else if (localStorage.getItem(PORTAL_TOKEN_KEY)) portalApi.get<PortalAccount>('/auth/me').then(value => { if (live && isPortalSessionCurrent(version)) setAccount(value); }).catch(err => { if (live && isPortalSessionCurrent(version)) setError((err as Error).message); }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; window.removeEventListener('sme-portal-session-expired', expired); window.removeEventListener('sme-portal-session-changed', changed); window.removeEventListener('storage', storage); };
  }, []);
  async function load() {
    const owner = accountRef.current?.id; if (!owner) return;
    const sequence = ++loadSequence.current;
    const current = () => accountRef.current?.id === owner && loadSequence.current === sequence;
    setLoading(true); setError(''); setSupplementErrors([]); setSupplementCounts({});
    try {
      const values = await portalApi.get<PortalRequest[]>('/requests'); if (!current()) return; setRequests(values);
      const accepted = values.filter(item => item.status === 'ACCEPTED' && item.loanId);
      const [results, tracked] = await Promise.all([
        Promise.allSettled(accepted.map(item => portalApi.get<SupplementView[]>(`/requests/${item.id}/supplements`))),
        Promise.allSettled(accepted.map(item => portalApi.get<PortalTracking>(`/requests/${item.id}/status`))),
      ]);
      if (!current()) return;
      const outcomeMap: Record<string, PortalTracking> = {};
      tracked.forEach((result, index) => { if (result.status === 'fulfilled') outcomeMap[accepted[index].id] = result.value; });
      setOutcomes(outcomeMap); setOutcomesFailed(tracked.some(result => result.status === 'rejected'));
      const counts: Record<string, number> = {}; const failures: string[] = [];
      results.forEach((result, index) => { const item = accepted[index]; if (result.status === 'fulfilled') counts[item.id] = result.value.filter(supplement => supplement.status === 'PENDING').length; else failures.push(`${item.reference}: ${(result.reason as Error).message}`); });
      setSupplementCounts(counts); setSupplementErrors(failures);
    }
    catch (err) { if (current()) setError((err as Error).message); }
    finally { if (current()) setLoading(false); }
  }
  useEffect(() => {
    if (!account) return;
    let active = true;
    void load();
    portalApi.get<PortalFormConfig>('/requests/form-config').then(value => { if (active) setConfig(value); }).catch(err => { if (active) setError((err as Error).message); });
    let id: string | null = null; try { id = sessionStorage.getItem(activeDraftKey(account.id)); } catch { /* Browser storage is optional. */ }
    if (id && /^[a-f0-9-]{36}$/i.test(id)) {
      const draft = id;
      portalApi.get<PortalRequest>(`/requests/${draft}`).then(value => { if (active && value.formVersion === 2) { setDraftId(draft); setEditor(value); } }).catch(err => {
        if (!active) return;
        if ((err as { status?: number }).status === 404) {
          try { if (sessionStorage.getItem(`sme_portal_v2:${account.id}:${draft}`)) { setDraftId(draft); setEditor(null); } else sessionStorage.removeItem(activeDraftKey(account.id)); } catch { /* Keep dashboard available. */ }
        } else setError((err as Error).message);
      });
    }
    return () => { active = false; };
  }, [account]);
  function remember(id: string) { if (account) try { sessionStorage.setItem(activeDraftKey(account.id), id); } catch { /* Wizard reports recovery storage failures. */ } }
  function back() { if (account) try { sessionStorage.removeItem(activeDraftKey(account.id)); } catch { /* No state is lost on the server. */ } setEditor(undefined); void load(); }
  async function open(item: PortalRequest) {
    const owner = accountRef.current?.id;
    const sequence = ++openSequence.current;
    const current = () => accountRef.current?.id === owner && openSequence.current === sequence;
    setLoading(true); setError('');
    try { const fresh = await portalApi.get<PortalRequest>(`/requests/${item.id}`); if (!current()) return; setDraftId(fresh.id); if (fresh.formVersion === 2) remember(fresh.id); setEditor(fresh); }
    catch (err) { if (current()) setError((err as Error).message); } finally { if (current()) setLoading(false); }
  }
  function saved(value: PortalRequest) { if (accountRef.current?.id === account?.id) { setRequests(current => [value, ...current.filter(item => item.id !== value.id)]); setEditor(current=>current?.id===value.id?value:current); } }
  return <div className="portal-shell"><header className="portal-header"><a className="portal-brand" href="/portal"><BrandLogo subtitle="Cổng doanh nghiệp" /></a><div className="portal-header-actions">{account && <div className="portal-account-box"><div className="portal-account-meta"><span className="portal-account-name">{account.contactName}</span><small className="portal-account-email">{account.email}</small></div><button className="btn btn-secondary portal-logout-btn" onClick={() => { if (editor === undefined || window.confirm('Đăng xuất khỏi cổng doanh nghiệp? File chưa tải lên sẽ cần chọn lại. Nội dung nháp V2 chưa lưu được giữ để khôi phục trong tab này.')) logout(); }}><LogOut size={15} /> Đăng xuất</button></div>}</div></header>
    <main className="portal-main">{checking ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : !account ? <>{error && <p role="alert" className="portal-error">{error}</p>}<PortalAuth resetToken={resetToken} onResetConsumed={()=>setResetToken(null)} onLogin={setAccount} /></> : editor !== undefined ? <Fragment key="editor">{editor && editor.status !== 'DRAFT' && <PortalApplicationTracking key={editor.id+':'+editor.revision} requestId={editor.id} />}{((editor?.formVersion ?? (editor ? 1 : 2)) === 1 ? <RequestEditor key={editor?.id ?? 'new'} initial={editor} onBack={back} onSaved={() => void load()} onClone={config?.rolloutEnabled?async old=>{const r=await portalApi.post<PortalRequest>('/requests',{formVersion:2,clientRequestId:crypto.randomUUID(),data:old.data});setDraftId(r.id);remember(r.id);saved(r);setEditor(r);}:undefined} /> : config ? <PortalWizard key={draftId} initial={editor} draftId={draftId} account={account} config={config} onBack={back} onSaved={saved} /> : <section className="portal-card"><p role="status">{error || 'Đang tải cấu hình biểu mẫu…'}</p><button className="btn btn-secondary" onClick={back}>Về danh sách</button></section>)}{editor?.status === 'ACCEPTED' && editor.loanId && <details className="portal-card supplement-entry" open><summary>Bổ sung hồ sơ sau tiếp nhận</summary><SupplementPanel key={editor.id} mode="portal" requestId={editor.id} config={config} /></details>}</Fragment> : <Fragment key="list">
      <div className="portal-section-heading portal-dashboard-heading"><div><span className="portal-eyebrow">KHÔNG GIAN DOANH NGHIỆP</span><h1>Đề nghị vay của bạn</h1><p>Chuẩn bị hồ sơ, lưu nháp và theo dõi kết quả tiếp nhận.</p></div><button className="btn btn-primary portal-create-cta" disabled={!config?.previewEnabled || loading} onClick={() => { const id = crypto.randomUUID(); setDraftId(id); remember(id); setEditor(null); }}><Plus size={17} /> Tạo đề nghị vay</button></div>
      {error && <p role="alert" className="portal-error">{error}</p>}{config && !config.previewEnabled && <p className="v2-policy">Tạo bản nháp V2 chưa mở trong môi trường này. Bạn vẫn có thể xem các đề nghị hiện có.</p>}
      {supplementErrors.length > 0 && <div className="portal-error portal-alert" role="alert"><p>Không tải được tình trạng bổ sung. Bấm Làm mới để thử lại.</p><ul>{supplementErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}{Object.values(supplementCounts).some(count => count > 0) && <p className="portal-notice" role="status">Có {Object.values(supplementCounts).reduce((sum, count) => sum + count, 0)} yêu cầu bổ sung đang mở. Chọn đề nghị đã tiếp nhận để xem chi tiết và gửi tài liệu.</p>}
      <PortalHome contactName={account.contactName} requests={requests} supplementCounts={supplementCounts} outcomes={outcomes} outcomesFailed={outcomesFailed} onOpen={id => { const item = requests.find(request => request.id === id); if (item) void open(item); }} />
      <div className="v2-dashboard-stats portal-stats-grid">
        <section className="portal-stat-card stat-draft">
          <div className="portal-stat-header"><span className="portal-stat-label">Bản nháp đang chuẩn bị</span><span className="portal-stat-icon"><FileEdit size={16} /></span></div>
          <strong className="portal-stat-number">{requests.filter(item => item.status === 'DRAFT').length}</strong>
          <span className="portal-stat-hint">Hồ sơ chưa gửi, có thể chỉnh sửa tiếp</span>
        </section>
        <section className="portal-stat-card stat-submitted">
          <div className="portal-stat-header"><span className="portal-stat-label">Đã gửi, chờ ngân hàng tiếp nhận</span><span className="portal-stat-icon"><Clock size={16} /></span></div>
          <strong className="portal-stat-number">{requests.filter(item => ['SUBMITTED', 'ASSIGNED', 'RETURNED'].includes(item.status)).length}</strong>
          <span className="portal-stat-hint">Hồ sơ đang trong quy trình rà soát</span>
        </section>
        <section className="portal-stat-card stat-accepted">
          <div className="portal-stat-header"><span className="portal-stat-label">Ngân hàng đã tiếp nhận</span><span className="portal-stat-icon"><CheckCircle2 size={16} /></span></div>
          <strong className="portal-stat-number">{requests.filter(item => item.status === 'ACCEPTED').length}</strong>
          <span className="portal-stat-hint">Đã khởi tạo hồ sơ vay nội bộ chi nhánh</span>
        </section>
      </div>
      <section className="portal-card portal-table-card">
        <div className="portal-table-header">
          <div>
            <h2>Danh sách đề nghị</h2>
            <p className="portal-table-subtitle">Tất cả đề nghị vay trực tuyến của doanh nghiệp tại chi nhánh</p>
          </div>
          <button className="btn btn-secondary portal-refresh-btn" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Làm mới
          </button>
        </div>
        {loading && <p className="portal-table-loading" role="status">Đang tải đề nghị…</p>}
        {!loading && requests.length === 0 && !error && (
          <div className="portal-empty">
            <FileText size={36} />
            <h3>Bạn chưa có đề nghị vay</h3>
            <p>Tạo bản nháp và chuẩn bị hồ sơ theo từng bước.</p>
          </div>
        )}
        {requests.length > 0 && (
          <div className="portal-table-responsive">
            <table className="portal-data-table">
              <thead>
                <tr>
                  <th scope="col" className="col-ref">Mã hồ sơ &amp; Tên đề nghị</th>
                  <th scope="col" className="col-amount">Số tiền đề nghị</th>
                  <th scope="col" className="col-status">Trạng thái</th>
                  <th scope="col" className="col-action text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="portal-request-list">
                {requests.map(item => (
                  <tr
                    className="portal-request-row"
                    key={item.id}
                    onClick={() => void open(item)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void open(item); } }}
                  >
                    <td className="col-ref">
                      <div className="portal-row-info">
                        <div className="portal-ref-line">
                          <strong className="portal-ref-code">{item.reference}</strong>
                          <span className="v2-version">V{item.formVersion ?? 1}</span>
                        </div>
                        <span className="portal-company-text">{item.data.companyName || 'Chưa nhập tên doanh nghiệp'}</span>
                        <small className="portal-next-action">{item.status === 'DRAFT' ? 'Tiếp tục khai và chuẩn bị tài liệu' : item.status === 'RETURNED' ? 'Xem những mục được yêu cầu chỉnh sửa' : item.status === 'ACCEPTED' ? 'Theo dõi kết quả và yêu cầu bổ sung' : 'Đã gửi · Theo dõi tiến độ xử lý'}</small>
                        {item.status === 'ACCEPTED' && item.loanId && (
                          <small className="supplement-dashboard-status">
                            {supplementCounts[item.id] === undefined ? (loading ? 'Đang tải tình trạng bổ sung…' : 'Chưa tải được tình trạng bổ sung') : supplementCounts[item.id] > 0 ? `${supplementCounts[item.id]} yêu cầu bổ sung đang mở` : 'Không có yêu cầu bổ sung đang mở'}
                          </small>
                        )}
                      </div>
                    </td>
                    <td className="col-amount">
                      <span className="portal-amount-value">
                        {item.data.proposedAmount !== undefined ? `${Number(item.data.proposedAmount).toLocaleString('vi-VN')} VNĐ` : 'Chưa nhập số tiền'}
                      </span>
                    </td>
                    <td className="col-status">
                      <span className={`portal-status status-${item.status.toLowerCase()}`}>
                        {requestStatus[item.status]}
                      </span>
                    </td>
                    <td className="col-action text-right">
                      <button
                        type="button"
                        className="portal-table-action-link"
                        disabled={loading}
                        onClick={e => { e.stopPropagation(); void open(item); }}
                      >
                        {item.status === 'RETURNED' ? 'Chỉnh sửa và gửi lại →' : item.status === 'DRAFT' ? 'Tiếp tục khai →' : 'Xem chi tiết →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Fragment>}</main><footer className="portal-footer">SME Loan • Tiếp nhận đề nghị vay doanh nghiệp</footer></div>;
}
