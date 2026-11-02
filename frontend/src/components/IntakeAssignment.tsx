import { useEffect, useState, useRef } from 'react';
import { api, ApiError } from '../api/client';
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
  const [conflict,setConflict]=useState(false);
  const lock=useRef(false),operation=useRef<{key:string;id:string}|null>(null);
  const canAssign = activeRole === 'QUAN_LY' && ['SUBMITTED', 'ASSIGNED', 'RETURNED'].includes(request.status);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    Promise.all([api.get<Assignment[]>(`/portal-intakes/${request.id}/assignment-history`), canAssign ? api.get<Officer[]>('/portal-intakes/officers') : Promise.resolve([])]).then(([entries, users]) => { if (!disposed) { setHistory(entries); setOfficers(users); } }).catch(err => { if (!disposed) setError((err as Error).message); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [request.id, request.assignedTo, request.assignmentVersion, activeRole, canAssign]);
  const reassign = !!request.assignedTo && officerId !== request.assignedTo;
  return <section className="intake-assignment" aria-label="Phân công đề nghị">
    {request.status==='ACCEPTED'&&request.currentLoanOfficer&&<p>CBTD đang phụ trách hồ sơ vay: <strong>{request.currentLoanOfficer.fullName||request.currentLoanOfficer.username}</strong>. Phân công trước tiếp nhận được giữ trong lịch sử.</p>}
    <p>{request.status === 'ACCEPTED' ? 'CBTD được phân công trước tiếp nhận' : 'Cán bộ được giao'}: <strong>{request.assignedOfficer?.fullName || request.assignedOfficer?.username || 'Chưa phân công'}</strong>{request.assignedAt && ` • ${new Date(request.assignedAt).toLocaleString('vi-VN')}`}</p>
    {canAssign && <form className="intake-assignment-form" onSubmit={async event => {
      event.preventDefault(); setError(''); setNotice('');
      if(lock.current||conflict)return;
      if (!officerId) { setError('Vui lòng chọn cán bộ tín dụng.'); return; }
      if (reassign && !note.trim()) { setError('Vui lòng nhập lý do điều chuyển.'); return; }
      if(!Number.isSafeInteger(request.assignmentVersion)){setError('Dữ liệu phân công chưa có phiên bản. Vui lòng tải lại.');return;}
      if (!window.confirm(reassign ? 'Xác nhận điều chuyển đề nghị sang cán bộ đã chọn?' : 'Xác nhận phân công đề nghị cho cán bộ đã chọn?')) return;
      const key=JSON.stringify([request.id,request.assignmentVersion,request.revision,request.assignedTo,officerId,note.trim()]);
      if(operation.current?.key!==key)operation.current={key,id:crypto.randomUUID()};
      lock.current=true;setBusy(true);
      try { const updated = await api.post<PortalRequest>(`/portal-intakes/${request.id}/assign`, { officerId, expectedAssignedTo: request.assignedTo ?? null, expectedRevision:request.revision, expectedAssignmentVersion:request.assignmentVersion,clientRequestId:operation.current.id, ...(note.trim() ? { note: note.trim() } : {}) }); operation.current=null;setOfficerId(updated.assignedTo||'');setNote('');setNotice(updated.assignmentReceipt?.replayed?'Thao tác đã được ghi nhận trước đó; đã tải phân công hiện tại.':'Đã lưu phân công.');window.dispatchEvent(new Event('sme-notifications-refresh'));try{await onUpdated(updated);}catch{setError('Phân công đã được lưu nhưng chưa làm mới được danh sách. Vui lòng tải lại.');} }
      catch (err) { if(err instanceof ApiError&&err.status===409)setConflict(true);setError((err as Error).message); }
      finally { lock.current=false;setBusy(false); }
    }}><h3>{request.assignedTo ? 'Điều chuyển trước tiếp nhận' : 'Phân công cán bộ tín dụng'}</h3>
      <label>Cán bộ tín dụng<select required disabled={disabled || busy || loading||conflict} value={officerId} onChange={event => { setOfficerId(event.target.value); setNotice(''); }}><option value="">Chọn cán bộ</option>{officers.map(officer => <option key={officer.id} value={officer.id}>{officer.fullName || officer.username} ({officer.username}) — {officer.activeLoanCount} hồ sơ đang xử lý, {officer.pendingIntakeCount} đề nghị chờ tiếp nhận</option>)}</select></label>
      <label>{reassign ? 'Lý do điều chuyển *' : 'Ghi chú phân công'}<textarea maxLength={2000} required={reassign} disabled={disabled || busy||conflict} value={note} onChange={event => setNote(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={disabled || busy || loading||conflict||!Number.isSafeInteger(request.assignmentVersion)|| !officerId || officerId === request.assignedTo || (reassign && !note.trim())}>{busy ? 'Đang lưu…' : reassign ? 'Điều chuyển đề nghị' : 'Phân công đề nghị'}</button>
    </form>}
    {loading && <p role="status">Đang tải phân công…</p>}{error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status">{notice}</p>}
    {conflict&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const fresh=await api.get<PortalRequest>(`/portal-intakes/${request.id}`);await onUpdated(fresh);setOfficerId(fresh.assignedTo||'');setConflict(false);setError('');operation.current=null;}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}}}>Tải lại phân công</button>}
    <details><summary>Lịch sử phân công ({history.length})</summary>{!loading && !history.length && <p>Chưa có lịch sử phân công.</p>}<ol className="intake-assignment-history">{history.map(entry => <li key={entry.id}><strong>{entry.fromUser?.fullName || 'Chưa phân công'} → {entry.toUser.fullName || entry.toUser.username}</strong><p>Người phân công: {entry.manager.fullName || entry.manager.username} • {new Date(entry.assignedAt).toLocaleString('vi-VN')}</p>{entry.note && <p>Ghi chú: {entry.note}</p>}</li>)}</ol></details>
  </section>;
}
