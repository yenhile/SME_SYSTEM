import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { documentTypeLabel } from '../appraisalWorkspace';
import { slaPolicyLabel, stageDurationText, stageStandardText } from '../slaDisplay';
import { extractAcceptedSupplementFiles } from '../portal/supplements';
import type { PortalFormConfig } from '../portal/model';
import type { LoanApplication } from '../types';
import { SupplementPanel } from './SupplementPanel';

export type EvidenceTab = 'documents' | 'supplements' | 'timeline';

interface AppraisalEvidenceTabsProps {
  loan: LoanApplication;
  canEdit: boolean;
  config: PortalFormConfig | null;
  onChanged: () => void;
  requestedTab?: { tab: EvidenceTab; nonce: number };
  documentToolbar?: ReactNode;
  onDeleteDocument?: (documentId: string) => void;
  deleteDisabled?: boolean;
  supplementTypeName?: (code: string) => string;
  timelineNote?: ReactNode;
}

const dateText = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const sizeText = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function AppraisalEvidenceTabs({ loan, canEdit, config, onChanged, requestedTab, documentToolbar, onDeleteDocument, deleteDisabled, supplementTypeName, timelineNote }: AppraisalEvidenceTabsProps) {
  const [tab, setTab] = useState<EvidenceTab>('documents');
  useEffect(() => { if (requestedTab) setTab(requestedTab.tab); }, [requestedTab]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const acceptedFiles = useMemo(() => extractAcceptedSupplementFiles(loan.supplementRequests), [loan.supplementRequests]);
  const waitingSupplement = loan.currentStatus === 'SUPPLEMENT_REQUIRED';
  const documents = loan.documents ?? [];
  const supplements = loan.supplementRequests ?? [];
  const histories = loan.stageHistories ?? [];
  const live = loan.liveSla && !loan.liveSla.error ? loan.liveSla : null;

  const download = async (path: string, fileName: string) => {
    setError('');
    try {
      const blob = await api.download(path);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError((err as Error).message); }
  };
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); onChanged(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const tabs: ReadonlyArray<readonly [EvidenceTab, string]> = [
    ['documents', `Chứng từ (${documents.length + acceptedFiles.length})`],
    ['supplements', `Bổ sung (${supplements.length})`],
    ['timeline', `Tiến trình (${histories.length})`],
  ];

  return <section className="card aw-card" aria-label="Căn cứ hồ sơ">
    <div className="aw-tabs" role="tablist">
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={`aw-tab${tab === value ? ' is-active' : ''}`} onClick={() => setTab(value)}>{label}</button>)}
    </div>
    {error && <p role="alert" className="aw-alert aw-alert-danger">{error}</p>}

    {tab === 'documents' && documentToolbar}
    {tab === 'documents' && <div className="aw-table-wrap"><table className="aw-table">
      <thead><tr><th scope="col">Loại chứng từ</th><th scope="col">Tệp</th><th scope="col">Kích thước</th><th scope="col">Thời gian tải</th>{onDeleteDocument && <th scope="col"><span className="aw-sr-only">Thao tác</span></th>}</tr></thead>
      <tbody>
        {documents.map(doc => <tr key={doc.id}>
          <td>{documentTypeLabel(doc.documentType)}</td>
          <td><button type="button" className="aw-link" onClick={() => void download(`/documents/${doc.id}/download`, doc.fileName)}>{doc.fileName}</button></td>
          <td>{sizeText(doc.fileSize)}</td>
          <td>{dateText(doc.uploadedAt)}</td>
          {onDeleteDocument && <td><button type="button" className="btn btn-outline-danger oc-doc-delete" disabled={deleteDisabled} aria-label={`Xóa tài liệu ${doc.fileName}`} onClick={() => onDeleteDocument(doc.id)}><Trash2 size={14} aria-hidden="true" /></button></td>}
        </tr>)}
        {acceptedFiles.map(file => <tr key={file.id}>
          <td>{supplementTypeName ? supplementTypeName(file.documentType) : file.documentType} <span className="badge badge-soft-green">Bổ sung</span></td>
          <td><button type="button" className="aw-link" onClick={() => void download(`/supplements/${file.supplementId}/files/${file.id}/download`, file.fileName)}>{file.fileName}</button>{file.version > 1 && ` (bản ${file.version})`}</td>
          <td>{sizeText(file.fileSize)}</td>
          <td>{dateText(file.uploadedAt)}</td>
          {onDeleteDocument && <td />}
        </tr>)}
        {!documents.length && !acceptedFiles.length && <tr><td colSpan={onDeleteDocument ? 5 : 4} className="aw-table-empty">Hồ sơ chưa có chứng từ đính kèm.</td></tr>}
      </tbody>
    </table></div>}

    {tab === 'supplements' && (loan.portalRequest?.status === 'ACCEPTED'
      ? <SupplementPanel key={loan.id} mode="staff" applicationId={loan.id} supplementIds={supplements.map(item => item.id)} canEdit={canEdit} canCreate={!waitingSupplement && !loan.completedAt} config={config} onChanged={onChanged} />
      : <>
        <p className="aw-hint">Khi yêu cầu bổ sung, SLA tạm dừng đến khi ghi nhận đã nhận đủ từ doanh nghiệp.</p>
        {canEdit && !waitingSupplement && !showForm && <button type="button" className="btn btn-secondary" onClick={() => setShowForm(true)}>Yêu cầu bổ sung chứng từ</button>}
        {canEdit && !waitingSupplement && showForm && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (content.trim()) void run(async () => { await api.post(`/supplements/${loan.id}`, { requestContent: content.trim() }); setContent(''); setShowForm(false); }); }}>
          <label>Chứng từ cần doanh nghiệp bổ sung
            <textarea required rows={3} value={content} onChange={event => setContent(event.target.value)} />
          </label>
          <div className="aw-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !content.trim()}>Gửi yêu cầu</button>
          </div>
        </form>}
        <div className="aw-table-wrap"><table className="aw-table">
          <thead><tr><th scope="col">Nội dung</th><th scope="col">Ngày gửi</th><th scope="col">Người yêu cầu</th><th scope="col">Trạng thái</th><th scope="col"><span className="aw-sr-only">Thao tác</span></th></tr></thead>
          <tbody>
            {supplements.map(item => <tr key={item.id}>
              <td className="aw-wrap">{item.requestContent}</td>
              <td>{dateText(item.requestedAt)}</td>
              <td>{item.requester?.fullName || 'Cán bộ tín dụng'}</td>
              <td>{item.status === 'RESOLVED' ? 'Đã hoàn tất' : item.status === 'PENDING' ? 'Đang chờ bổ sung' : 'Đã hết hạn'}</td>
              <td>{item.status === 'PENDING' && canEdit && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => api.put(`/supplements/${item.id}/resolve`, { notes: 'Doanh nghiệp đã nộp đủ chứng từ bổ sung' }))}>Đã nhận đủ từ doanh nghiệp</button>}</td>
            </tr>)}
            {!supplements.length && <tr><td colSpan={5} className="aw-table-empty">Chưa có yêu cầu bổ sung nào.</td></tr>}
          </tbody>
        </table></div>
      </>)}

    {tab === 'timeline' && <div className="aw-table-wrap"><table className="aw-table">
      <thead><tr><th scope="col">Công đoạn</th><th scope="col">Bắt đầu</th><th scope="col">Kết thúc</th><th scope="col">Tạm dừng</th><th scope="col">Tính SLA</th><th scope="col">Định mức</th><th scope="col">Trạng thái</th></tr></thead>
      <tbody>
        {histories.map(history => {
          const liveRow = live && live.historyId === history.id ? live : null;
          const completed = history.stage?.stageCode === 'HOAN_TAT';
          const delayed = liveRow ? liveRow.isDelayed : history.isDelayed;
          const status = completed ? 'Không tính SLA' : !history.exitedAt && loan.slaSummary?.waitingEnterprise ? 'Tạm dừng' : delayed ? 'Trễ hạn' : history.exitedAt ? 'Đúng hạn' : 'Đang chạy';
          return <tr key={history.id}>
            <td title={slaPolicyLabel(history.slaPolicy)}>{history.stage?.stageName || history.stageId}</td>
            <td>{dateText(history.enteredAt)}</td>
            <td>{history.exitedAt ? dateText(history.exitedAt) : 'Đang xử lý'}</td>
            <td>{completed ? '—' : stageDurationText(liveRow ? liveRow.pausedDurationHours : history.pausedDurationHours, history.slaPolicy)}</td>
            <td>{completed ? '—' : stageDurationText(liveRow ? liveRow.netWorkDurationHours : history.netWorkDurationHours, history.slaPolicy)}</td>
            <td>{stageStandardText(history.stage?.stageCode, history.slaStandardHours, history.slaPolicy ?? null)}</td>
            <td className={status === 'Trễ hạn' ? 'aw-tone-danger' : undefined}>{status}</td>
          </tr>;
        })}
        {!histories.length && <tr><td colSpan={7} className="aw-table-empty">Chưa có lịch sử công đoạn.</td></tr>}
      </tbody>
    </table></div>}
    {tab === 'timeline' && timelineNote}
  </section>;
}
