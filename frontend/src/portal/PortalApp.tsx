import { Fragment, useEffect, useRef, useState } from 'react';
import { PortalWizard, activeDraftKey } from './PortalWizard';
import type { PortalFormConfig } from './model';
import { ArrowLeft, Building2, FileText, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { portalApi, PORTAL_TOKEN_KEY, setPortalToken } from './client';
import { draftPayload, fields, groups, loanTypes, requestStatus, validateRequest, type GroupCode, type PortalAccount, type PortalData, type PortalRequest } from './model';
import '../portal.css';
import { DocumentLink } from './DocumentLink';
import { SupplementPanel } from '../components/SupplementPanel';
import { PortalApplicationTracking } from './PortalApplicationTracking';
import type { SupplementView } from './supplements';

function PortalAuth({ onLogin }: { onLogin: (account: PortalAccount) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [contactName, setContactName] = useState(''); const [phone, setPhone] = useState(''); const [code, setCode] = useState('');
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setMessage(''); };
  return <div className="portal-auth-layout"><section className="portal-intro"><span className="portal-eyebrow">SME • CỔNG DOANH NGHIỆP</span><h1>Khởi đầu nhu cầu vốn của doanh nghiệp</h1><p>Khai thông tin, chuẩn bị tài liệu và gửi đề nghị vay trực tuyến. Bạn có thể lưu nháp và tiếp tục bất cứ lúc nào.</p><div className="portal-intro-note"><ShieldCheck size={22} /><span>Hồ sơ của bạn được quản lý riêng trong tài khoản doanh nghiệp.</span></div></section><section className="portal-card portal-auth"><h2>{mode === 'login' ? 'Đăng nhập doanh nghiệp' : mode === 'register' ? 'Tạo tài khoản' : 'Xác minh email'}</h2><p>{mode === 'verify' ? 'Nhập mã xác minh được gửi đến email của bạn.' : 'Dùng email đã xác minh để quản lý đề nghị vay.'}</p>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try {
      if (mode === 'login') { const result = await portalApi.post<{ accessToken: string; account: PortalAccount }>('/auth/login', { email: email.trim(), password }); setPortalToken(result.accessToken); onLogin(result.account); }
      else if (mode === 'register') { await portalApi.post('/auth/register', { email: email.trim(), password, contactName: contactName.trim(), phone: phone.trim() }); setMode('verify'); setPassword(''); setMessage('Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh.'); }
      else { await portalApi.post('/auth/verify-email', { email: email.trim(), code: code.trim() }); setMode('login'); setCode(''); setMessage('Email đã được xác minh. Bạn có thể đăng nhập.'); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label>Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      {mode === 'register' && <><label>Người liên hệ<input required maxLength={200} value={contactName} onChange={e => setContactName(e.target.value)} /></label><label>Số điện thoại<input required type="tel" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></label></>}
      {mode !== 'verify' ? <label>Mật khẩu<input required type="password" minLength={mode === 'register' ? 8 : undefined} maxLength={72} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />{mode === 'register' && <small>Tối thiểu 8 ký tự, gồm chữ và số; tối đa 72 byte.</small>}</label> : <label>Mã xác minh<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value)} /></label>}
      {error && <p className="portal-error" role="alert">{error}</p>}{message && <p className="portal-notice" role="status">{message}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Đăng ký' : 'Xác minh email'}</button>
    </form><div className="portal-auth-links"><button className="portal-link" disabled={busy} onClick={() => changeMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Tạo tài khoản doanh nghiệp'}</button><button className="portal-link" disabled={busy} onClick={() => changeMode(mode === 'verify' ? 'login' : 'verify')}>{mode === 'verify' ? 'Quay lại đăng nhập' : 'Xác minh email'}</button>{mode === 'verify' && <button className="portal-link" disabled={busy || !email.trim()} onClick={async () => { setBusy(true); setError(''); try { await portalApi.post('/auth/resend-verification', { email: email.trim() }); setMessage('Đã yêu cầu gửi lại mã. Vui lòng kiểm tra email.'); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>Gửi lại mã xác minh</button>}</div></section></div>;
}

export function RequestFields({ data, errors = {}, readOnly = false, onChange }: { data: PortalData; errors?: Record<string, string>; readOnly?: boolean; onChange?: (data: PortalData) => void }) {
  return <div className="portal-field-grid">{fields.map(field => <label key={field.key}>{field.label}<span className="portal-required"> *</span>{field.key === 'loanType' ? <select value={data.loanType ?? ''} disabled={readOnly} aria-invalid={!!errors[field.key]} onChange={e => onChange?.({ ...data, loanType: e.target.value })}><option value="">Chọn loại vay</option>{Object.entries(loanTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input type={field.type || 'text'} value={(data[field.key] as string | number | undefined) ?? ''} readOnly={readOnly} min={field.min} max={field.max} step={field.type === 'number' ? '1' : undefined} maxLength={field.key === 'taxCode' ? 13 : 1000} aria-invalid={!!errors[field.key]} onChange={e => onChange?.({ ...data, [field.key]: field.type === 'number' ? e.target.value === '' ? undefined : Number(e.target.value) : e.target.value })} />}{errors[field.key] && <small className="portal-error">{errors[field.key]}</small>}</label>)}</div>;
}

function RequestEditor({ initial, onBack, onSaved }: { initial: PortalRequest | null; onBack: () => void; onSaved: () => void }) {
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
  const [account, setAccount] = useState<PortalAccount | null>(null); const [checking, setChecking] = useState(!!localStorage.getItem(PORTAL_TOKEN_KEY));
  const [requests, setRequests] = useState<PortalRequest[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [supplementCounts, setSupplementCounts] = useState<Record<string, number>>({});
  const [supplementErrors, setSupplementErrors] = useState<string[]>([]);
  const loadSequence = useRef(0);
  const openSequence = useRef(0);
  const [editor, setEditor] = useState<PortalRequest | null | undefined>(undefined);
  const [config, setConfig] = useState<PortalFormConfig | null>(null); const [draftId, setDraftId] = useState('');
  const accountRef = useRef(account); accountRef.current = account;
  const logout = () => { accountRef.current = null; loadSequence.current++; openSequence.current++; setPortalToken(null); setAccount(null); setRequests([]); setSupplementCounts({}); setSupplementErrors([]); setLoading(false); setEditor(undefined); setConfig(null); };
  useEffect(() => {
    const expired = () => { logout(); setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); };
    window.addEventListener('sme-portal-session-expired', expired);
    if (localStorage.getItem(PORTAL_TOKEN_KEY)) portalApi.get<PortalAccount>('/auth/me').then(setAccount).catch(err => setError((err as Error).message)).finally(() => setChecking(false));
    return () => window.removeEventListener('sme-portal-session-expired', expired);
  }, []);
  async function load() {
    const owner = accountRef.current?.id; if (!owner) return;
    const sequence = ++loadSequence.current;
    const current = () => accountRef.current?.id === owner && loadSequence.current === sequence;
    setLoading(true); setError(''); setSupplementErrors([]); setSupplementCounts({});
    try {
      const values = await portalApi.get<PortalRequest[]>('/requests'); if (!current()) return; setRequests(values);
      const accepted = values.filter(item => item.status === 'ACCEPTED' && item.loanId);
      const results = await Promise.allSettled(accepted.map(item => portalApi.get<SupplementView[]>(`/requests/${item.id}/supplements`)));
      if (!current()) return;
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
  function saved(value: PortalRequest) { if (accountRef.current?.id === account?.id) setRequests(current => [value, ...current.filter(item => item.id !== value.id)]); }
  return <div className="portal-shell"><header className="portal-header"><a className="portal-brand" href="/portal"><span><Building2 size={23} /></span><div>SME Loan<small>Cổng doanh nghiệp</small></div></a><div className="portal-header-actions">{account && <><span>{account.contactName}<small>{account.email}</small></span><button className="btn btn-secondary" onClick={() => { if (editor === undefined || window.confirm('Đăng xuất khỏi cổng doanh nghiệp? File chưa tải lên sẽ cần chọn lại. Nội dung nháp V2 chưa lưu được giữ để khôi phục trong tab này.')) logout(); }}><LogOut size={15} /> Đăng xuất</button></>}</div></header>
    <main className="portal-main">{checking ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : !account ? <>{error && <p role="alert" className="portal-error">{error}</p>}<PortalAuth onLogin={setAccount} /></> : editor !== undefined ? <Fragment key="editor">{editor && editor.status !== 'DRAFT' && <PortalApplicationTracking key={editor.id} requestId={editor.id} />}{((editor?.formVersion ?? (editor ? 1 : 2)) === 1 ? <RequestEditor key={editor?.id ?? 'new'} initial={editor} onBack={back} onSaved={() => void load()} /> : config ? <PortalWizard key={draftId} initial={editor} draftId={draftId} account={account} config={config} onBack={back} onSaved={saved} /> : <section className="portal-card"><p role="status">{error || 'Đang tải cấu hình biểu mẫu…'}</p><button className="btn btn-secondary" onClick={back}>Về danh sách</button></section>)}{editor?.status === 'ACCEPTED' && editor.loanId && <details className="portal-card supplement-entry" open><summary>Bổ sung hồ sơ sau tiếp nhận</summary><SupplementPanel key={editor.id} mode="portal" requestId={editor.id} config={config} /></details>}</Fragment> : <Fragment key="list">
      <div className="portal-section-heading"><div><span className="portal-eyebrow">KHÔNG GIAN DOANH NGHIỆP</span><h1>Đề nghị vay của bạn</h1><p>Chuẩn bị hồ sơ, lưu nháp và theo dõi kết quả tiếp nhận.</p></div><button className="btn btn-primary" disabled={!config?.previewEnabled || loading} onClick={() => { const id = crypto.randomUUID(); setDraftId(id); remember(id); setEditor(null); }}><Plus size={17} /> Tạo đề nghị vay</button></div>
      {error && <p role="alert" className="portal-error">{error}</p>}{config && !config.previewEnabled && <p className="v2-policy">Tạo bản nháp V2 chưa mở trong môi trường này. Bạn vẫn có thể xem các đề nghị hiện có.</p>}
      {supplementErrors.length > 0 && <div className="portal-error portal-alert" role="alert"><p>Không tải được tình trạng bổ sung. Bấm Làm mới để thử lại.</p><ul>{supplementErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}{Object.values(supplementCounts).some(count => count > 0) && <p className="portal-notice" role="status">Có {Object.values(supplementCounts).reduce((sum, count) => sum + count, 0)} yêu cầu bổ sung đang mở. Chọn đề nghị đã tiếp nhận để xem chi tiết và gửi tài liệu.</p>}<div className="v2-dashboard-stats"><section><strong>{requests.filter(item => item.status === 'DRAFT').length}</strong><span>Bản nháp đang chuẩn bị</span></section><section><strong>{requests.filter(item => ['SUBMITTED', 'ASSIGNED'].includes(item.status)).length}</strong><span>Đã gửi, chờ ngân hàng tiếp nhận</span></section><section><strong>{requests.filter(item => item.status === 'ACCEPTED').length}</strong><span>Ngân hàng đã tiếp nhận</span></section></div>
      <section className="portal-card"><div className="portal-section-heading"><h2>Danh sách đề nghị</h2><button className="btn btn-secondary" disabled={loading} onClick={() => void load()}>Làm mới</button></div>{loading && <p role="status">Đang tải đề nghị…</p>}{!loading && requests.length === 0 && !error && <div className="portal-empty"><FileText size={32} /><h3>Bạn chưa có đề nghị vay</h3><p>Tạo bản nháp và chuẩn bị hồ sơ theo từng bước.</p></div>}<div className="portal-request-list">{requests.map(item => <button className="portal-request-row" key={item.id} disabled={loading} onClick={() => void open(item)}><div><strong>{item.reference} <small className="v2-version">V{item.formVersion ?? 1}</small></strong><span>{item.data.companyName || 'Chưa nhập tên doanh nghiệp'}</span>{item.status === 'ACCEPTED' && item.loanId && <small className="supplement-dashboard-status">{supplementCounts[item.id] === undefined ? (loading ? 'Đang tải tình trạng bổ sung…' : 'Chưa tải được tình trạng bổ sung') : supplementCounts[item.id] > 0 ? `${supplementCounts[item.id]} yêu cầu bổ sung đang mở` : 'Không có yêu cầu bổ sung đang mở'}</small>}</div><span>{item.data.proposedAmount !== undefined ? `${Number(item.data.proposedAmount).toLocaleString('vi-VN')} VNĐ` : 'Chưa nhập số tiền'}</span><span className="portal-status">{requestStatus[item.status]}</span><span>{item.status === 'DRAFT' ? 'Tiếp tục khai →' : 'Xem chi tiết →'}</span></button>)}</div></section>
    </Fragment>}</main><footer className="portal-footer">SME Loan • Tiếp nhận đề nghị vay doanh nghiệp</footer></div>;
}
