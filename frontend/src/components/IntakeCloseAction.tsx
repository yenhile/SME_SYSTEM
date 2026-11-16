import { useState } from 'react';
import { api } from '../api/client';
import type { RoleCode } from '../types';
import type { PortalRequest } from '../portal/model';

const CLOSABLE = ['SUBMITTED', 'ASSIGNED', 'RETURNED'];

/** Closes a request the bank cannot accept as submitted (for example the tax code belongs to another enterprise). The reason is shown to the enterprise. */
export function IntakeCloseAction({ request, activeRole, disabled, onClosed }: { request: PortalRequest; activeRole: RoleCode | null; disabled: boolean; onClosed: (request: PortalRequest) => Promise<void> | void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!CLOSABLE.includes(request.status) || (activeRole !== 'QUAN_LY' && activeRole !== 'CBTD') || request.formVersion !== 2) return null;
  async function close() {
    if (!window.confirm(`Đóng đề nghị ${request.reference}? Doanh nghiệp sẽ thấy lý do và phải lập đề nghị mới; không mở lại được.`)) return;
    setBusy(true); setError('');
    try { await onClosed(await api.post<PortalRequest>(`/portal-intakes/${request.id}/close`, { expectedRevision: request.revision, clientRequestId: crypto.randomUUID(), reason: reason.trim() })); setReason(''); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="intake-close">
    <summary>Đóng đề nghị</summary>
    <label>Lý do gửi doanh nghiệp<textarea value={reason} maxLength={4000} rows={3} placeholder="Ví dụ: Mã số thuế thuộc doanh nghiệp khác đã có trên hệ thống; vui lòng lập đề nghị mới với mã số thuế đúng." onChange={event => setReason(event.target.value)} /></label>
    {error && <p role="alert" className="error-message">{error}</p>}
    <button type="button" className="btn btn-secondary" disabled={disabled || busy || !reason.trim()} onClick={() => void close()}>Đóng đề nghị</button>
  </details>;
}
