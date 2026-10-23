import { useEffect, useRef, useState } from 'react';
import { portalApi, PortalApiError } from './client';
import { DocumentLink } from './DocumentLink';
import type { GroupCode, PortalData, PortalDocument, PortalFormConfig, PortalRequest } from './model';

type Coverage = { documentTypeCode: string; period?: string };
type QueueItem = {
  id: string;
  file: File;
  group: GroupCode;
  coverage: Coverage[];
  replaceId?: string;
  status: 'pending' | 'uploading' | 'error';
  error?: string;
};
type Props = {
  request: PortalRequest;
  config: PortalFormConfig;
  data: PortalData;
  disabled: boolean;
  onMutate: (action: (request: PortalRequest) => Promise<PortalRequest>) => Promise<boolean>;
  onPendingChange: (count: number) => void;
  onConflict: () => void;
};
const periodPattern = /^(?!0000)[0-9]{4}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/;
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Thao tác thất bại. Vui lòng thử lại.';
const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB`;

/** V2 file receipt and version management. Upload never implies business verification. */
export function DocumentManager({ request, config, data, disabled, onMutate, onPendingChange, onConflict }: Props) {
  const [groupCode, setGroupCode] = useState<GroupCode>(config.groups[0]?.code ?? 'A');
  const [coverage, setCoverage] = useState<Coverage[]>([{ documentTypeCode: '' }]);
  const [replacement, setReplacement] = useState<PortalDocument | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, PortalDocument[]>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [historyBusy, setHistoryBusy] = useState<Record<string, boolean>>({});
  const [withdrawn, setWithdrawn] = useState<PortalDocument[]>([]);
  const [historyError, setHistoryError] = useState('');
  const runningRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingCallback = useRef(onPendingChange);
  pendingCallback.current = onPendingChange;
  useEffect(() => { pendingCallback.current(queue.length); }, [queue.length]);
  useEffect(() => () => { pendingCallback.current(0); }, []);
  useEffect(() => {
    let active = true;
    portalApi.get<PortalDocument[]>(`/requests/${request.id}/documents`).then(heads => {
      if (active) { setWithdrawn(heads.filter(doc => !!doc.withdrawnAt)); setHistoryError(''); }
    }).catch(error => { if (active) setHistoryError(messageOf(error)); });
    return () => { active = false; };
  }, [request.id, request.revision]);

  const group = config.groups.find(item => item.code === groupCode);
  const maxBytes = config.technicalLimits.maxFileBytes;
  const maxFiles = config.technicalLimits.maxActiveFiles;
  const locked = disabled || running;
  const accept = [...new Set(group?.documentTypes.flatMap(type => type.formats) ?? [])].map(ext => `.${ext}`).join(',');
  const allKnown = [...request.documents, ...withdrawn.filter(doc => !request.documents.some(active => active.id === doc.id))];

  function chooseGroup(code: GroupCode, document: PortalDocument | null = null) {
    setGroupCode(code);
    setReplacement(document);
    setCoverage(document?.coverage?.length ? document.coverage.map(entry => ({ ...entry })) : [{ documentTypeCode: '' }]);
    setFormError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  function enqueue(files: File[]) {
    setFormError('');
    if (!files.length || !group) return;
    const metadata = coverage.map(entry => ({ documentTypeCode: entry.documentTypeCode, ...(entry.period?.trim() ? { period: entry.period.trim() } : {}) }));
    if (metadata.some(entry => !group.documentTypes.some(type => type.code === entry.documentTypeCode))) {
      setFormError('Chọn loại tài liệu cho từng dòng trước khi chọn tệp.');
      return;
    }
    if (metadata.some(entry => entry.period && !periodPattern.test(entry.period))) {
      setFormError('Kỳ tài liệu phải có dạng YYYY, YYYY-MM hoặc YYYY-Q1 đến YYYY-Q4.');
      return;
    }
    if (new Set(metadata.map(entry => `${entry.documentTypeCode}:${entry.period ?? ''}`)).size !== metadata.length) {
      setFormError('Các dòng loại tài liệu và kỳ không được trùng nhau.');
      return;
    }
    if (replacement && (files.length !== 1 || queue.some(item => item.replaceId === replacement.id))) {
      setFormError('Mỗi lần thay thế chỉ chọn một tệp; xử lý hoặc bỏ tệp thay thế đang chờ trước.');
      return;
    }
    if (!replacement && request.documents.length + queue.filter(item => !item.replaceId).length + files.length > maxFiles) {
      setFormError(`Tối đa ${maxFiles} tệp hiện hành cho mỗi yêu cầu, bao gồm tệp đang chờ.`);
      return;
    }
    const formats = new Set(group.documentTypes.flatMap(type => type.formats));
    const invalid = files.find(file => file.size > maxBytes || file.size === 0 || !formats.has(file.name.split('.').pop()?.toLowerCase() ?? ''));
    if (invalid) {
      setFormError(`${invalid.name}: chọn tệp không rỗng, đúng định dạng ${accept}, tối đa ${sizeLabel(maxBytes)}.`);
      return;
    }
    setQueue(current => [...current, ...files.map(file => ({
      id: crypto.randomUUID(), file, group: groupCode, coverage: metadata.map(entry => ({ ...entry })),
      ...(replacement ? { replaceId: replacement.id } : {}), status: 'pending' as const,
    }))]);
    setReplacement(null);
  }

  async function upload(items: QueueItem[]) {
    if (disabled || runningRef.current || !items.length) return;
    runningRef.current = true;
    setRunning(true);
    try {
      for (const item of items) {
        let failure = '';
        let conflict = false;
        setQueue(current => current.map(entry => entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry));
        let succeeded = false;
        try {
          succeeded = await onMutate(async current => {
            const payload = new FormData();
            payload.append('file', item.file);
            payload.append('documentGroup', item.group);
            payload.append('coverage', JSON.stringify(item.coverage));
            payload.append('clientUploadId', item.id);
            payload.append('expectedRevision', String(current.revision));
            try {
              return await portalApi.post<PortalRequest>(`/requests/${current.id}/documents${item.replaceId ? `/${item.replaceId}/replace` : ''}`, payload);
            } catch (error) {
              failure = messageOf(error);
              conflict = error instanceof PortalApiError && error.status === 409;
              setQueue(remaining => remaining.map(entry => entry.id === item.id ? { ...entry, status: 'error', error: failure } : entry));
              if (conflict) onConflict();
              throw error;
            }
          });
        } catch (error) { failure = messageOf(error); }
        if (succeeded) {
          setQueue(current => current.filter(entry => entry.id !== item.id));
          setHistory({});
          setOpenHistory({});
        } else {
          setQueue(current => current.map(entry => entry.id === item.id ? {
            ...entry, status: 'error', error: failure || 'Chưa tải lên được. Kiểm tra thông báo hồ sơ rồi thử lại; tệp và thông tin đã chọn vẫn được giữ.',
          } : entry));
          // A failed prerequisite save or revision conflict needs the user's attention first.
          if (conflict || !failure) break;
        }
      }
    } finally { runningRef.current = false; setRunning(false); }
  }

  async function showHistory(document: PortalDocument) {
    if (openHistory[document.id]) {
      setOpenHistory(current => ({ ...current, [document.id]: false }));
      return;
    }
    setHistoryBusy(current => ({ ...current, [document.id]: true }));
    setRowErrors(current => ({ ...current, [document.id]: '' }));
    try {
      const versions = await portalApi.get<PortalDocument[]>(`/requests/${request.id}/documents/${document.id}/versions`);
      setHistory(current => ({ ...current, [document.id]: versions }));
      setOpenHistory(current => ({ ...current, [document.id]: true }));
    } catch (error) { setRowErrors(current => ({ ...current, [document.id]: messageOf(error) })); }
    finally { setHistoryBusy(current => ({ ...current, [document.id]: false })); }
  }

  async function withdraw(document: PortalDocument) {
    if (disabled || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setRowErrors(current => ({ ...current, [document.id]: '' }));
    try {
      const succeeded = await onMutate(async current => {
        try {
          return await portalApi.delete<PortalRequest>(`/requests/${current.id}/documents/${document.id}`, { expectedRevision: current.revision });
        } catch (error) {
          setRowErrors(errors => ({ ...errors, [document.id]: messageOf(error) }));
          if (error instanceof PortalApiError && error.status === 409) onConflict();
          throw error;
        }
      });
      if (succeeded) {
        setWithdrawn(current => [...current.filter(entry => entry.id !== document.id), { ...document, withdrawnAt: new Date().toISOString() }]);
        setOpenHistory(current => ({ ...current, [document.id]: false }));
        if (replacement?.id === document.id) setReplacement(null);
      }
    } finally { runningRef.current = false; setRunning(false); }
  }

  function coverageLabel(entries: Coverage[] | null | undefined) {
    return entries?.map(entry => {
      const type = config.groups.flatMap(item => item.documentTypes).find(item => item.code === entry.documentTypeCode);
      return `${type?.name ?? entry.documentTypeCode}${entry.period ? ` (${entry.period})` : ''}`;
    }).join('; ') || 'Chưa có thông tin loại tài liệu';
  }

  return <section className="portal-document-manager" aria-label="Quản lý tài liệu">
    <div className="portal-section-heading"><div><h2>Tài liệu hồ sơ</h2><p>Danh mục đang chờ chính sách. Tệp đã tải lên chỉ ghi nhận đã cung cấp, chưa phải CBTD xác minh.</p></div></div>
    <p className="portal-policy-note">Chưa xác định loại tài liệu bắt buộc, kỳ bắt buộc hoặc điều kiện miễn. Tối đa {sizeLabel(maxBytes)}/tệp và {maxFiles} tệp hiện hành.</p>
    <div className="portal-doc-grid">{config.groups.map(item => {
      const documents = request.documents.filter(document => document.documentGroup === item.code);
      return <section className={`portal-card portal-doc-card${item.code === groupCode ? ' is-selected' : ''}`} key={item.code}>
        <div className="portal-group-heading"><span>{item.code}</span><h3>{item.name}</h3><small>{documents.length} tệp</small></div>
        <p className="portal-policy-note">Chờ chính sách</p>
        {item.code === 'E' && data.collateral?.mode === 'NONE_REQUESTED' && <p>Bạn đề nghị không có tài sản bảo đảm. Đây là thông tin chuẩn bị hồ sơ; điều kiện miễn tài liệu chưa được chốt.</p>}
        {item.code === 'F' && data.hasExistingDebt === false && <p>Bạn khai chưa có dư nợ. Điều kiện tài liệu nhóm này đang chờ chính sách; không cần tạo dư nợ giả để bổ sung tệp.</p>}
        <ul className="portal-document-types">{item.documentTypes.map(type => {
          const supplied = documents.some(document => document.coverage?.some(entry => entry.documentTypeCode === type.code));
          return <li key={type.code}><span>{type.name}</span> <small>{supplied ? 'Đã tải' : 'Chưa cung cấp'} · Chờ chính sách</small></li>;
        })}</ul>
        <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => chooseGroup(item.code)}>Chọn tài liệu nhóm {item.code}</button>
      </section>;
    })}</div>

    <section className="portal-card portal-upload-editor" aria-label="Chọn loại và tệp tài liệu">
      <h3>{replacement ? `Thay thế ${replacement.fileName}` : `Thêm tài liệu nhóm ${groupCode} — ${group?.name ?? ''}`}</h3>
      {replacement && <p>Tạo phiên bản mới và giữ nguyên nhóm {replacement.documentGroup}; lịch sử phiên bản cũ vẫn được giữ.</p>}
      <p>Một tệp có thể bao gồm nhiều loại tài liệu và nhiều kỳ trong cùng nhóm. Thông tin dưới đây áp dụng cho từng tệp được chọn.</p>
      <fieldset disabled={locked} className="portal-coverage-fields"><legend>Thông tin tài liệu</legend>
        {coverage.map((entry, index) => <div className="portal-coverage-row" key={index}>
          <label>Loại tài liệu {index + 1}<select aria-label={`Loại tài liệu ${index + 1}`} value={entry.documentTypeCode} onChange={event => setCoverage(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, documentTypeCode: event.target.value } : row))}>
            <option value="">Chọn loại tài liệu</option>{group?.documentTypes.map(type => <option value={type.code} key={type.code}>{type.name}</option>)}
          </select></label>
          <label>Kỳ tài liệu (nếu có)<input aria-label={`Kỳ tài liệu ${index + 1}`} placeholder="2026, 2026-09 hoặc 2026-Q3" value={entry.period ?? ''} onChange={event => setCoverage(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, period: event.target.value } : row))} /></label>
          <button type="button" className="portal-link" disabled={coverage.length === 1} onClick={() => setCoverage(current => current.filter((_, rowIndex) => rowIndex !== index))}>Bỏ dòng {index + 1}</button>
        </div>)}
        <button type="button" className="btn btn-secondary" disabled={coverage.length >= 30} onClick={() => setCoverage(current => [...current, { documentTypeCode: '' }])}>Thêm loại / kỳ</button>
        {(groupCode === 'B' || groupCode === 'F') && <p>Kỳ hỗ trợ năm (YYYY), tháng (YYYY-MM) hoặc quý (YYYY-Q1…Q4); chưa áp dụng kỳ bắt buộc.</p>}
        <label>Chọn {replacement ? 'một tệp thay thế' : 'một hoặc nhiều tệp'}<input ref={fileInput} type="file" accept={accept} multiple={!replacement} aria-label={replacement ? 'Chọn tệp thay thế' : `Chọn tệp nhóm ${groupCode}`} onChange={event => { enqueue(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
        <small>Định dạng: {accept}. Tệp mới được thêm vào hàng chờ trước khi tải lên máy chủ.</small>
      </fieldset>
      {replacement && <button type="button" className="portal-link" disabled={locked} onClick={() => chooseGroup(groupCode)}>Hủy chọn thay thế</button>}
      {formError && <p role="alert" className="portal-error">{formError}</p>}
    </section>

    {queue.length > 0 && <section className="portal-card portal-upload-queue" aria-label="Hàng chờ tải tài liệu">
      <h3>Hàng chờ ({queue.length})</h3><p>Tệp chưa tải chỉ được giữ trong tab hiện tại. Sau khi tải lại trang, bạn cần chọn lại tệp.</p>
      <button type="button" className="btn btn-primary" disabled={locked || !queue.some(item => item.status === 'pending')} onClick={() => void upload(queue.filter(item => item.status === 'pending'))}>Tải các tệp đang chờ</button>
      <ul>{queue.map(item => <li key={item.id} className="portal-queue-item">
        <strong>{item.file.name}</strong> <small>Nhóm {item.group} · {sizeLabel(item.file.size)}{item.replaceId ? ' · Phiên bản thay thế' : ''}</small>
        <p>{coverageLabel(item.coverage)}</p><span role="status">{item.status === 'uploading' ? 'Đang tải lên' : item.status === 'error' ? 'Tải lên thất bại' : 'Chờ tải lên'}</span>
        {item.error && <p role="alert" className="portal-error">{item.error}</p>}
        {item.status === 'error' && <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => void upload([item])}>Thử lại {item.file.name}</button>}
        <button type="button" className="portal-link" disabled={locked} onClick={() => setQueue(current => current.filter(entry => entry.id !== item.id))}>Bỏ khỏi hàng chờ</button>
      </li>)}</ul>
    </section>}

    <section className="portal-document-list" aria-label="Tài liệu đã tải">
      <h3>Tài liệu đã tải ({request.documents.length})</h3>
      {historyError && <p role="alert" className="portal-error">Không tải được lịch sử tài liệu đã rút: {historyError}</p>}
      {!request.documents.length && <p>Chưa có tệp được lưu trên máy chủ.</p>}
      {allKnown.map(document => <article className="portal-card portal-document-row" key={document.id}>
        <div><strong>Nhóm {document.documentGroup} · Phiên bản {document.version ?? 1}</strong> <small>{sizeLabel(document.fileSize)} · {new Date(document.uploadedAt).toLocaleString('vi-VN')}</small></div>
        <DocumentLink fileName={document.fileName} load={() => portalApi.download(`/requests/${request.id}/documents/${document.id}/download`)} />
        <p>{coverageLabel(document.coverage)}</p><small>{document.withdrawnAt ? 'Đã rút khỏi hồ sơ hiện hành' : 'Đã tải · Chưa xác minh bởi CBTD'}</small>
        <div className="portal-document-actions">
          {!document.withdrawnAt && <><button type="button" className="portal-link" disabled={locked || queue.some(item => item.replaceId === document.id)} onClick={() => chooseGroup(document.documentGroup, document)}>Thay thế</button>
            <button type="button" className="portal-link" disabled={locked || queue.some(item => item.replaceId === document.id)} onClick={() => void withdraw(document)}>Rút tài liệu</button></>}
          <button type="button" className="portal-link" disabled={historyBusy[document.id]} aria-expanded={!!openHistory[document.id]} onClick={() => void showHistory(document)}>{historyBusy[document.id] ? 'Đang tải lịch sử…' : openHistory[document.id] ? 'Ẩn lịch sử' : 'Lịch sử phiên bản'}</button>
        </div>
        {rowErrors[document.id] && <p role="alert" className="portal-error">{rowErrors[document.id]}</p>}
        {openHistory[document.id] && <ol className="portal-version-list" aria-label={`Lịch sử ${document.fileName}`}>{history[document.id]?.map(version => <li key={version.id}>
          <strong>Phiên bản {version.version ?? 1}</strong> <small>{version.withdrawnAt ? 'Đã rút' : request.documents.some(active => active.id === version.id) ? 'Hiện hành' : 'Đã được thay thế'}</small>
          <DocumentLink fileName={version.fileName} load={() => portalApi.download(`/requests/${request.id}/documents/${version.id}/download`)} />
          <p>{coverageLabel(version.coverage)}</p><small>{new Date(version.uploadedAt).toLocaleString('vi-VN')}</small>
        </li>)}</ol>}
      </article>)}
    </section>
  </section>;
}
