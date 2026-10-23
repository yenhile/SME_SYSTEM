import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ROLE_NAMES, useAuth } from '../context/AuthContext';
import { RoleCode, User, StageCode } from '../types';

type Account = User & { isActive: boolean };
type Stage = { stageCode: StageCode; stageName: string; standardSlaHours: number };
const roleCodes = Object.keys(ROLE_NAMES) as RoleCode[];
const emptyForm = { username: '', password: '', fullName: '', email: '', phone: '', branchName: '', roles: [] as RoleCode[], isActive: true };
export function AdminView({ section }: { section: 'users' | 'settings' }) {
  const { user, restoreSession } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try {
      if (section === 'users') setAccounts(await api.get<Account[]>('/users'));
      else setStages(await api.get<Stage[]>('/admin/workflow-stages'));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [section]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editId) await api.put(`/users/${editId}`, { fullName: form.fullName, phone: form.phone, branchName: form.branchName, roles: form.roles, isActive: form.isActive });
      else await api.post('/users', form);
      setOpen(false); setNotice('Đã lưu tài khoản và vai trò.'); await load();
      if (editId === user?.id) await restoreSession();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="admin-view">
    <div className="page-heading"><div><h2>{section === 'users' ? 'Liên hệ cá nhân' : 'Cấu hình SLA'}</h2><p>Quản trị hệ thống · {section === 'users' ? 'Một tài khoản có thể được cấp nhiều vai trò.' : 'Định mức mới áp dụng cho công đoạn được mở sau khi lưu.'}</p></div><button disabled={busy} className="btn btn-secondary" onClick={() => void load()}>Làm mới</button></div>
    {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status">{notice}</p>}
    {section === 'users' ? <>
      <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); setError(''); }}>Tạo mới liên hệ</button>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò được cấp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td>{account.username}</td><td>{account.fullName}</td><td>{account.roles.map(role => ROLE_NAMES[role]).join(', ')}</td><td>{account.isActive ? 'Hoạt động' : 'Đã khóa'}</td><td><button className="btn btn-secondary" onClick={() => { setEditId(account.id); setForm({ ...emptyForm, ...account, password: '' }); setOpen(true); setError(''); }}>Sửa / Cấp quyền</button></td></tr>)}</tbody></table></div>
      {open && <div className="modal-overlay"><section className="modal-content" style={{ maxWidth: 600 }}><div className="modal-header"><h3>{editId ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}</h3><button className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Đóng</button></div><form onSubmit={submit}><div className="modal-body admin-form">
        {error && <p role="alert" className="error-message">{error}</p>}
        {!editId && <><label>Tên đăng nhập<input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label><label>Mật khẩu ban đầu<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></>}
        <label>Họ tên<input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label><label>Chi nhánh<input value={form.branchName} onChange={e => setForm({ ...form, branchName: e.target.value })} /></label><label>Điện thoại<input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <fieldset><legend>Vai trò (chọn ít nhất một)</legend>{roleCodes.map(role => <label className="check-label" key={role}><input type="checkbox" checked={form.roles.includes(role)} onChange={e => setForm({ ...form, roles: e.target.checked ? [...form.roles, role] : form.roles.filter(item => item !== role) })} />{ROLE_NAMES[role]}</label>)}</fieldset>
        {editId && <label className="check-label"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />Tài khoản hoạt động</label>}
      </div><div className="modal-footer"><button type="submit" className="btn btn-primary" disabled={busy || !form.roles.length}>{busy ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div></form></section></div>}
    </> : <div className="card admin-form">{stages.map((stage, index) => <form className="sla-row" key={stage.stageCode} onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api.put(`/admin/workflow-stages/${stage.stageCode}`, { stageName: stage.stageName, standardSlaHours: Number(stage.standardSlaHours) }); setNotice(`Đã cập nhật ${stage.stageName}.`); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><label>Tên công đoạn<input required value={stage.stageName} onChange={e => setStages(stages.map((item, i) => i === index ? { ...item, stageName: e.target.value } : item))} /></label><label>SLA (giờ)<input required type="number" min={1} step={1} value={stage.standardSlaHours} onChange={e => setStages(stages.map((item, i) => i === index ? { ...item, standardSlaHours: Number(e.target.value) } : item))} /></label><button className="btn btn-primary" type="submit" disabled={busy}>Lưu</button></form>)}</div>}
  </section>;
}
