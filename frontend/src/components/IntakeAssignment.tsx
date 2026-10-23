import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RoleCode } from '../types';
import type { IntakeUser, PortalRequest } from '../portal/model';

interface Officer extends IntakeUser { activeLoanCount: number; pendingIntakeCount: number }
interface Assignment { id: string; fromUser: IntakeUser | null; toUser: IntakeUser; manager: IntakeUser; note: string | null; assignedAt: string }

export function IntakeAssignment({ request, activeRole, disabled, onUpdated }: { request: PortalRequest; activeRole: RoleCode | null; disabled: boolean; onUpdated: (request: PortalRequest) => Promise<void> }) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [officerId, setOfficerId] = useState(request.assignedTo || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canAssign = activeRole === 'QUAN_LY' && ['SUBMITTED', 'ASSIGNED'].includes(request.status);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    Promise.all([api.get<Assignment[]>(`/portal-intakes/${request.id}/assignment-history`), canAssign ? api.get<Officer[]>('/portal-intakes/officers') : Promise.resolve([])]).then(([entries, users]) => { if (!disposed) { setHistory(entries); setOfficers(users); } }).catch(err => { if (!disposed) setError((err as Error).message); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [request.id, request.assignedTo, activeRole, canAssign]);
  const reassign = !!request.assignedTo && officerId !== request.assignedTo;
  return <section className="intake-assignment" aria-label="Phân công đề nghị">
    <p>{request.status === 'ACCEPTED' ? 'CBTD được phân công trước tiếp nhận' : 'Cán bộ được giao'}: <strong>{request.assignedOfficer?.fullName || request.assignedOfficer?.username || 'Chưa phân công'}</strong>{request.assignedAt && ` • ${new Date(request.assignedAt).toLocaleString('vi-VN')}`}</p>
    {canAssign && <form className="intake-assignment-form" onSubmit={async event => {
      event.preventDefault(); setError(''); setNotice('');
      if (!officerId) { setError('Vui lòng chọn cán bộ tín dụng.'); return; }
      if (reassign && !note.trim()) { setError('Vui lòng nhập lý do điều chuyển.'); return; }
      if (!window.confirm(reassign ? 'Xác nhận điều chuyển đề nghị sang cán bộ đã chọn?' : 'Xác nhận phân công đề nghị cho cán bộ đã chọn?')) return;
      setBusy(true);
      try { const updated = await api.post<PortalRequest>(`/portal-intakes/${request.id}/assign`, { officerId, expectedAssignedTo: request.assignedTo ?? null, ...(note.trim() ? { note: note.trim() } : {}) }); await onUpdated(updated); setNotice('Đã lưu phân công.'); window.dispatchEvent(new Event('sme-notifications-refresh')); }
      catch (err) { setError((err as Error).message); }
      finally { setBusy(false); }
    }}><h3>{request.assignedTo ? 'Điều chuyển trước tiếp nhận' : 'Phân công cán bộ tín dụng'}</h3>
      <label>Cán bộ tín dụng<select required disabled={disabled || busy || loading} value={officerId} onChange={event => { setOfficerId(event.target.value); setNotice(''); }}><option value="">Chọn cán bộ</option>{officers.map(officer => <option key={officer.id} value={officer.id}>{officer.fullName || officer.username} ({officer.username}) — {officer.activeLoanCount} hồ sơ đang xử lý, {officer.pendingIntakeCount} đề nghị chờ tiếp nhận</option>)}</select></label>
      <label>{reassign ? 'Lý do điều chuyển *' : 'Ghi chú phân công'}<textarea maxLength={2000} required={reassign} disabled={disabled || busy} value={note} onChange={event => setNote(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={disabled || busy || loading || !officerId || officerId === request.assignedTo || (reassign && !note.trim())}>{busy ? 'Đang lưu…' : reassign ? 'Điều chuyển đề nghị' : 'Phân công đề nghị'}</button>
    </form>}
    {loading && <p role="status">Đang tải phân công…</p>}{error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status">{notice}</p>}
    <details><summary>Lịch sử phân công ({history.length})</summary>{!loading && !history.length && <p>Chưa có lịch sử phân công.</p>}<ol className="intake-assignment-history">{history.map(entry => <li key={entry.id}><strong>{entry.fromUser?.fullName || 'Chưa phân công'} → {entry.toUser.fullName || entry.toUser.username}</strong><p>Người phân công: {entry.manager.fullName || entry.manager.username} • {new Date(entry.assignedAt).toLocaleString('vi-VN')}</p>{entry.note && <p>Ghi chú: {entry.note}</p>}</li>)}</ol></details>
  </section>;
}
