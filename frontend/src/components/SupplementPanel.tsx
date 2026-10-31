import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { portalApi } from '../portal/client';
import { DocumentLink } from '../portal/DocumentLink';
import type { PortalFormConfig } from '../portal/model';
import { canRespond, canResolve, canReturn, currentManifest, latestFile, supplementError, loadStaffSupplements } from '../portal/supplements';
import type { SupplementDraftItem, SupplementFile, SupplementItem, SupplementView } from '../portal/supplements';
import '../portal.css';

const itemStatus = { PENDING: 'Chờ tài liệu', SUBMITTED: 'Đã gửi, chờ kiểm tra', ACCEPTED: 'Đã chấp nhận', REPLACE_REQUIRED: 'Cần thay thế' };
const eventLabels: Record<string, string> = { REQUESTED: 'Tạo yêu cầu', RETURNED: 'Gửi danh sách sửa', CREATED: 'Tạo yêu cầu', UPLOADED: 'Tải tài liệu', FILE_UPLOADED: 'Tải tài liệu', RESPONDED: 'Gửi bổ sung', RESPONSE_SUBMITTED: 'Gửi bổ sung', ACCEPTED: 'Chấp nhận mục', REPLACE_REQUIRED: 'Yêu cầu thay thế', ITEM_ACCEPTED: 'Chấp nhận mục', ITEM_REJECTED: 'Yêu cầu thay thế', RESOLVED: 'Hoàn tất yêu cầu' };
type Mode = 'portal' | 'staff';
interface CardProps {
  view: SupplementView; mode: Mode; canEdit: boolean; busy: boolean; config: PortalFormConfig | null;
  onUpload: (item: SupplementItem, file: File) => Promise<void>;
  onRespond: () => Promise<void>; onReview: (item: SupplementItem, accepted: boolean, message: string) => Promise<void>;
  onResolve: () => Promise<void>; onReturn: () => Promise<void>; download: (file: SupplementFile) => Promise<Blob>;
}

function SupplementItemRow({ item, ...props }: CardProps & { item: SupplementItem }) {
  const { view, mode, canEdit, busy, config } = props;
  const [file, setFile] = useState<File | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [message, setMessage] = useState('');
  const latest = latestFile(view, item.id);
  const definition = config?.groups.find(group => group.code === item.documentGroup)?.documentTypes.find(type => type.code === item.documentTypeCode);
  const pending = item.status === 'PENDING' || item.status === 'REPLACE_REQUIRED';
  return <section className="supplement-item"><div className="supplement-heading"><h4>{item.documentGroup} · {definition?.name ?? item.documentTypeCode}{item.period ? ` · ${item.period}` : ''}</h4><span className="portal-status">{itemStatus[item.status]}</span></div>
    <p>{item.reason}</p>{item.message && <p className="portal-notice">Ngân hàng phản hồi: {item.message}</p>}
    <ul className="supplement-files">{view.files.filter(value => value.itemId === item.id).map(value => <li key={value.id}><DocumentLink fileName={value.fileName} disabled={busy} load={() => props.download(value)} /><small>v{value.version} · {(value.fileSize / 1024).toFixed(1)} KB · {value.id === latest?.id ? 'Mới nhất' : 'Phiên bản trước'} · {value.submittedAt ? 'Đã gửi' : 'Chưa gửi'}</small></li>)}</ul>
    {mode === 'portal' && view.status === 'PENDING' && pending && <div className="supplement-upload"><label>Chọn tài liệu{latest ? ' thay thế phiên bản mới nhất' : ''}<input key={selectionVersion} type="file" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><button type="button" className="btn btn-secondary" disabled={busy || !file} onClick={() => { if (file) void props.onUpload(item, file).then(() => { setFile(null); setSelectionVersion(value => value + 1); }).catch(() => {}); }}>Tải lên{latest ? ' phiên bản mới' : ''}</button></div>}
    {mode === 'staff' && canEdit && view.status === 'PENDING' && item.status === 'SUBMITTED' && <div className="supplement-review"><label>Thông điệp gửi doanh nghiệp<textarea maxLength={2000} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /></label><div className="portal-actions"><button className="btn btn-success" disabled={busy || !message.trim()} onClick={() => void props.onReview(item, true, message.trim()).catch(() => {})}>Chấp nhận mục</button><button className="btn btn-warning" disabled={busy || !message.trim()} onClick={() => void props.onReview(item, false, message.trim()).catch(() => {})}>Yêu cầu thay thế</button></div></div>}
  </section>;
}

export function SupplementCard(props: CardProps) {
  const { view, mode, canEdit, busy } = props;
  return <article className="supplement-card"><div className="supplement-heading"><h3>{view.requestContent}</h3><span className="portal-status">{view.status === 'RESOLVED' ? 'Đã hoàn tất' : 'Đang bổ sung'}</span></div><p className="supplement-meta">Yêu cầu ngày {new Date(view.requestedAt).toLocaleString('vi-VN')}{view.deadlineAt ? ` · Hạn: ${new Date(view.deadlineAt).toLocaleString('vi-VN')}` : ''} · Phiên bản dữ liệu {view.revision}</p>
    {view.items.length ? view.items.map(item => <SupplementItemRow key={item.id} {...props} item={item} />) : <p className="portal-notice">Yêu cầu cũ chưa có danh mục tài liệu trực tuyến. Vui lòng liên hệ cán bộ tiếp nhận để bổ sung.</p>}
    {mode === 'portal' && view.status === 'PENDING' && view.items.length > 0 && <div className="supplement-response"><p>Tải đủ tài liệu cho các mục đang chờ, sau đó gửi ngân hàng kiểm tra. Tải lên chưa phải gửi bổ sung.</p><button className="btn btn-primary" disabled={busy || !canRespond(view)} onClick={() => void props.onRespond().catch(() => {})}>Gửi tài liệu bổ sung ({currentManifest(view).length})</button></div>}
    {mode === 'staff' && canEdit && canReturn(view) && <div className="supplement-response"><p>Đã kiểm tra xong các mục. Gửi danh sách sửa để doanh nghiệp thay tài liệu; từ lúc này hệ thống tính thời gian chờ doanh nghiệp.</p><button className="btn btn-warning" disabled={busy} onClick={() => void props.onReturn().catch(() => {})}>Gửi danh sách sửa cho doanh nghiệp</button></div>}
    {mode === 'staff' && canEdit && view.status === 'PENDING' && <button className="btn btn-success" disabled={busy || (view.items.length > 0 && !canResolve(view))} onClick={() => void props.onResolve().catch(() => {})}>Hoàn tất yêu cầu & Chạy lại SLA</button>}
    {view.events.length > 0 && <details className="supplement-events"><summary>Lịch sử bổ sung ({view.events.length})</summary><ul>{view.events.map((event, index) => <li key={index}><time>{new Date(event.at).toLocaleString('vi-VN')}</time> · {eventLabels[event.type] ?? event.type}{event.message ? ` · ${event.message}` : ''}</li>)}</ul></details>}
  </article>;
}

type PanelProps = { mode: 'portal'; requestId: string; config?: PortalFormConfig | null } | { mode: 'staff'; supplementIds: string[]; applicationId: string; canEdit: boolean; canCreate: boolean; config?: PortalFormConfig | null; onChanged: () => void };
export function SupplementPanel(props: PanelProps) {
  const [views, setViews] = useState<SupplementView[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const live = useRef(true);
  const epoch = useRef(0);
  const fileIds = useRef(new WeakMap<File, string>());
  const attempts = useRef(new Map<string, string>());
  const base = props.mode === 'portal' ? `/requests/${props.requestId}/supplements` : '/supplements';
  const client = props.mode === 'portal' ? portalApi : api;
  const identity = props.mode === 'portal' ? props.requestId : `${props.applicationId}:${props.supplementIds.join(',')}`;
  async function load(notifyReconciled = true) {
    const currentEpoch = epoch.current;
    const values = props.mode === 'portal' ? await portalApi.get<SupplementView[]>(base) : await loadStaffSupplements(props.applicationId, api.get);
    if (live.current && epoch.current === currentEpoch) {
      setViews(values);
      // A refresh must retain operation IDs for mutations whose outcome is
      // uncertain. Discovery of a new request also reconciles the parent Loan.
      if (notifyReconciled && props.mode === 'staff' && values.map(value => value.id).sort().join(',') !== [...props.supplementIds].sort().join(',')) props.onChanged();
    }
  }
  useEffect(() => {
    const currentEpoch = ++epoch.current;
    live.current = true; setLoading(true); setBusy(false); setError(''); setNotice(''); setViews([]); attempts.current.clear();
    void load().catch(err => { if (live.current && epoch.current === currentEpoch) setError(supplementError(err)); }).finally(() => { if (live.current && epoch.current === currentEpoch) setLoading(false); });
    return () => { live.current = false; epoch.current++; };
  }, [identity, props.mode]);
  function operationId(key: string) { const previous = attempts.current.get(key); if (previous) return previous; const id = crypto.randomUUID(); attempts.current.set(key, id); return id; }
  async function run(action: () => Promise<unknown>, message: string) {
    const currentEpoch = epoch.current;
    setBusy(true); setError(''); setNotice('');
    try { await action(); if (!live.current || epoch.current !== currentEpoch) return; await load(false); if (live.current && epoch.current === currentEpoch) { setNotice(message); if (props.mode === 'staff') props.onChanged(); } }
    catch (err) { if (live.current && epoch.current === currentEpoch) setError(supplementError(err)); throw err; }
    finally { if (live.current && epoch.current === currentEpoch) setBusy(false); }
  }
  function refresh() {
    const currentEpoch = epoch.current;
    setLoading(true); setError('');
    void load().catch(err => { if (live.current && epoch.current === currentEpoch) setError(supplementError(err)); }).finally(() => { if (live.current && epoch.current === currentEpoch) setLoading(false); });
  }
  return <section className="supplement-panel"><div className="supplement-heading"><h2>Bổ sung hồ sơ sau tiếp nhận</h2><button className="btn btn-secondary" disabled={busy || loading} onClick={refresh}>Tải lại yêu cầu</button></div>
    {error && <p className="portal-error" role="alert">{error} Có thể thử lại thao tác với cùng tài liệu; nếu dữ liệu thay đổi, hãy tải lại yêu cầu.</p>}{notice && <p className="portal-notice" role="status">{notice}</p>}{loading && <p role="status">Đang tải yêu cầu bổ sung…</p>}
    {props.mode === 'staff' && props.canEdit && props.canCreate && !views.some(view => view.status === 'PENDING') && <>{!props.config && <p className="portal-error" role="alert">Chưa tải được danh mục tài liệu. Tải lại chi tiết hồ sơ trước khi tạo yêu cầu.</p>}<SupplementCreate config={props.config ?? null} busy={busy || loading} create={(requestContent, items) => run(() => api.post(`/supplements/${props.applicationId}`, { requestContent, items, clientRequestId: operationId(`create:${requestContent}:${JSON.stringify(items)}`) }), 'Đã gửi yêu cầu bổ sung.')} /></>}
    {!loading && !error && views.length === 0 && <p>Chưa có yêu cầu bổ sung.</p>}
    {!loading && views.map(view => <SupplementCard key={view.id} view={view} mode={props.mode} config={props.config ?? null} canEdit={props.mode === 'staff' && props.canEdit} busy={busy} download={file => client.download(`${base}/${view.id}/files/${file.id}/download`)}
      onUpload={(item, file) => run(() => {
        const previous = latestFile(view, item.id); const body = new FormData(); if (!fileIds.current.has(file)) fileIds.current.set(file, crypto.randomUUID()); body.append('file', file); body.append('expectedRevision', String(view.revision)); body.append('clientUploadId', operationId(`upload:${view.id}:${view.revision}:${item.id}:${fileIds.current.get(file)}`)); if (previous) body.append('supersedesId', previous.id);
        return portalApi.post(`${base}/${view.id}/items/${item.id}/files`, body);
      }, 'Đã tải tài liệu. Hãy gửi bổ sung khi đã chuẩn bị đủ.')}
      onRespond={() => run(() => portalApi.post(`${base}/${view.id}/respond`, { expectedRevision: view.revision, clientRequestId: operationId(`respond:${view.id}:${view.revision}`), documentIds: currentManifest(view) }), 'Đã gửi tài liệu bổ sung để ngân hàng kiểm tra.')}
      onReview={(item, accepted, message) => run(() => api.put(`/supplements/${view.id}/items/${item.id}/review`, { expectedRevision: view.revision, clientRequestId: operationId(`review:${view.id}:${view.revision}:${item.id}:${accepted}:${message}`), accepted, message }), 'Đã lưu kết quả kiểm tra mục tài liệu.')}
      onReturn={() => run(() => api.post(`/supplements/${view.id}/return`, { expectedRevision: view.revision, clientRequestId: operationId(`return:${view.id}:${view.revision}`) }), 'Đã gửi danh sách sửa cho doanh nghiệp.')}
      onResolve={() => run(() => api.put(`/supplements/${view.id}/resolve`, view.items.length ? { expectedRevision: view.revision, clientRequestId: operationId(`resolve:${view.id}:${view.revision}`) } : {}), 'Đã hoàn tất yêu cầu bổ sung.')} />)}
  </section>;
}

function SupplementCreate({ config, busy, create }: { config: PortalFormConfig | null; busy: boolean; create: (content: string, items: SupplementDraftItem[]) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [content, setContent] = useState('');
  const [items, setItems] = useState<SupplementDraftItem[]>([]);
  const catalog = config?.groups.flatMap(group => group.documentTypes.map(type => ({ group: group.code, ...type }))) ?? [];
  function update(index: number, change: Partial<SupplementDraftItem>) { setItems(current => current.map((item, at) => at === index ? { ...item, ...change } : item)); }
  if (!open) return <button className="btn btn-warning" disabled={busy || !catalog.length} onClick={() => { setOpen(true); setItems([{ documentGroup: catalog[0].group, documentTypeCode: catalog[0].code, reason: '' }]); }}>Tạo yêu cầu bổ sung theo danh mục</button>;
  return <form className="supplement-create" onSubmit={event => { event.preventDefault(); void create(content.trim(), items.map(item => ({ ...item, reason: item.reason.trim(), period: item.period?.trim() || undefined }))).then(() => { setOpen(false); setContent(''); setItems([]); }).catch(() => {}); }}><h3>Tạo yêu cầu bổ sung (tạm dừng SLA)</h3><label>Nội dung gửi doanh nghiệp<textarea required maxLength={2000} disabled={busy} value={content} onChange={event => setContent(event.target.value)} /></label>
    {items.map((item, index) => <fieldset key={index} disabled={busy}><legend>Mục {index + 1}</legend><label>Loại tài liệu<select value={`${item.documentGroup}:${item.documentTypeCode}`} onChange={event => { const selected = catalog.find(type => `${type.group}:${type.code}` === event.target.value); if (selected) update(index, { documentGroup: selected.group, documentTypeCode: selected.code }); }}>{catalog.map(type => <option key={`${type.group}:${type.code}`} value={`${type.group}:${type.code}`}>{type.group} · {type.name}</option>)}</select></label><label>Kỳ tài liệu (nếu có)<input maxLength={100} value={item.period ?? ''} onChange={event => update(index, { period: event.target.value })} /></label><label>Lý do cần bổ sung<textarea required maxLength={2000} value={item.reason} onChange={event => update(index, { reason: event.target.value })} /></label><button type="button" className="btn btn-secondary" disabled={items.length <= 1} onClick={() => setItems(current => current.filter((_, at) => at !== index))}>Bỏ mục</button></fieldset>)}
    <div className="portal-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setItems(current => [...current, { documentGroup: catalog[0].group, documentTypeCode: catalog[0].code, reason: '' }])}>Thêm mục</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-warning" disabled={busy || !content.trim() || items.some(item => !item.reason.trim())}>Gửi yêu cầu & Tạm dừng SLA</button></div>
  </form>;
}
