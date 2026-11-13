import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { ROLE_NAMES } from '../context/AuthContext';
import { stageStandardText } from '../slaDisplay';
import { RoleCode, User } from '../types';
import {
  ACTION_LABELS, AUDIT_PAGE_SIZE, EMPTY_AUDIT_FILTERS, auditLogPath, changeLines, filterError,
  type AuditFilters, type AuditPage, type ValueFormat,
} from '../adminActivity';

const FORMAT: ValueFormat = {
  roleName: code => ROLE_NAMES[code as RoleCode] ?? code,
  slaText: hours => stageStandardText(undefined, hours),
};
const timeText = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

export function AdminActivityLog() {
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get<AuditPage>(auditLogPath(applied, page, AUDIT_PAGE_SIZE)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được nhật ký.');
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api.get<User[]>('/users?role=ADMIN').then(setAdmins).catch(() => setAdmins([])); }, []);

  const invalid = filterError(draft);
  const apply = () => { if (invalid) return; setPage(1); setApplied(draft); };
  const clear = () => { setDraft(EMPTY_AUDIT_FILTERS); setPage(1); setApplied(EMPTY_AUDIT_FILTERS); };
  const hasFilter = Object.values(applied).some(Boolean);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return <section className="admin-view admin-activity">
    <div className="page-heading"><div><h2>Lịch sử hoạt động</h2></div><button disabled={loading} className="btn btn-secondary" onClick={() => void load()}>Làm mới</button></div>
    <form className="card admin-activity-filters" onSubmit={e => { e.preventDefault(); apply(); }}>
      <label>Người thực hiện<select value={draft.actorId} onChange={e => setDraft(d => ({ ...d, actorId: e.target.value }))}><option value="">Tất cả</option>{admins.map(a => <option key={a.id} value={a.id}>{a.fullName} ({a.username})</option>)}</select></label>
      <label>Loại thao tác<select value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}><option value="">Tất cả</option>{Object.entries(ACTION_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label>Từ ngày<input type="date" value={draft.from} max={draft.to || undefined} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
      <label>Đến ngày<input type="date" value={draft.to} min={draft.from || undefined} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
      <div className="admin-activity-actions"><button type="submit" className="btn btn-primary" disabled={!!invalid}>Áp dụng</button><button type="button" className="btn btn-secondary" onClick={clear}>Xóa lọc</button></div>
      {invalid && <p role="alert" className="error-message">{invalid}</p>}
    </form>
    {error ? <div role="alert" className="error-message"><p>{error}</p><button className="btn btn-secondary" onClick={() => void load()}>Thử lại</button></div>
      : loading && !data ? <p role="status">Đang tải nhật ký…</p>
      : !data?.items.length ? <p role="status" className="admin-activity-empty">{hasFilter ? 'Không có thao tác nào khớp bộ lọc.' : 'Chưa có thao tác nào được ghi.'}</p>
      : <>
        <p role="status" className="admin-activity-summary">{loading ? 'Đang tải…' : `${data.total} thao tác`}</p>
        <div className="data-table-container"><table className="data-table admin-activity-table"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Thay đổi</th></tr></thead>
          <tbody>{data.items.map(row => <tr key={row.id}>
            <td>{timeText(row.createdAt)}</td>
            <td>{row.actorName}<br /><small>{row.actorUsername}</small></td>
            <td>{ACTION_LABELS[row.action] ?? row.action}</td>
            <td>{row.targetLabel}</td>
            <td><ul className="admin-activity-changes">{changeLines(row, FORMAT).map(line => <li key={line}>{line}</li>)}</ul></td>
          </tr>)}</tbody></table></div>
        {pages > 1 && <nav className="lt-pagination" aria-label="Phân trang">
          <button type="button" className="btn btn-secondary" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Trang trước</button>
          <span>Trang {page} / {pages}</span>
          <button type="button" className="btn btn-secondary" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)}>Trang sau</button>
        </nav>}
      </>}
  </section>;
}
