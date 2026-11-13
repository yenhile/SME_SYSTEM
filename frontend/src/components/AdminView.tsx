import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ROLE_NAMES, useAuth } from '../context/AuthContext';
import { ROLE_GUIDE } from '../roleGuide';
import { RoleCode, User, StageCode, SlaBottleneck } from '../types';
import { daysToHours, hoursToDays, stageActualFigures } from '../slaDisplay';

type Account = User & { isActive: boolean; workloadActiveLoans?: number; pendingPortalRequests?: number };
type Stage = { stageCode: StageCode; stageName: string; standardSlaHours: number; slaDays: string };
type RoleRow = { code: RoleCode; name: string; description: string | null; activeUsers: number; totalUsers: number };
type SlaOverview = {
  openLoans: Partial<Record<StageCode, number>>;
  prediction: { slaRangeHours: Partial<Record<StageCode, [number, number]>> } | null;
};
type SlaChangeContext = { openLoans: number; slaRangeHours: [number, number] | null };
type AccountForm = typeof emptyForm;

const roleCodes = Object.keys(ROLE_NAMES) as RoleCode[];
const emptyForm = { username: '', password: '', fullName: '', email: '', phone: '', branchName: '', roles: [] as RoleCode[], isActive: true };
const SELF_ROLE_NOTE = 'Bạn không tự đổi vai trò hay tự khóa tài khoản của chính mình. Hãy nhờ một Quản trị viên khác thực hiện.';

/** Khi Admin sửa chính mình, vai trò và trạng thái không được gửi đi để backend giữ nguyên. */
export function accountUpdatePayload(form: AccountForm, isSelf: boolean) {
  const profile = { fullName: form.fullName, phone: form.phone, branchName: form.branchName };
  return isSelf ? profile : { ...profile, roles: form.roles, isActive: form.isActive };
}

const rangeText = ([min, max]: [number, number]) => `${hoursToDays(min)}–${hoursToDays(max)} ngày làm việc`;

/** Câu xác nhận trước khi đổi định mức, nêu hồ sơ đang mở và ảnh hưởng tới dự báo trễ SLA; trả `null` khi định mức không đổi. */
export function slaChangePrompt(stage: Pick<Stage, 'stageName' | 'standardSlaHours'>, nextDays: number, context: SlaChangeContext) {
  const nextHours = daysToHours(nextDays);
  if (nextHours === stage.standardSlaHours) return null;
  const range = context.slaRangeHours;
  const prediction = !range
    ? 'Chưa đọc được dải định mức của mô hình dự báo nên chưa kiểm được ảnh hưởng tới dự báo trễ SLA.'
    : nextHours < range[0] || nextHours > range[1]
      ? `Định mức ${nextDays} ngày nằm ngoài dải mô hình dự báo đã học (${rangeText(range)}): hồ sơ vào công đoạn sau khi lưu sẽ không có dự báo trễ SLA.`
      : 'Dự báo trễ SLA của hồ sơ vào công đoạn sau khi lưu sẽ tính theo định mức mới.';
  return `Đổi định mức ${stage.stageName} từ ${hoursToDays(stage.standardSlaHours)} sang ${nextDays} ngày làm việc?\n- ${context.openLoans} hồ sơ đang mở giữ định mức cũ; định mức mới áp dụng cho lượt vào công đoạn sau khi lưu.\n- ${prediction}`;
}

export function AdminView({ section }: { section: 'users' | 'settings' }) {
  const { user, restoreSession } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [overview, setOverview] = useState<SlaOverview | null>(null);
  const [actuals, setActuals] = useState<SlaBottleneck[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isSelf = !!editId && editId === user?.id;
  const editing = accounts.find(account => account.id === editId);
  const load = async () => {
    setBusy(true); setError('');
    try {
      if (section === 'users') {
        const [accountRows, roleRows] = await Promise.all([api.get<Account[]>('/users'), api.get<RoleRow[]>('/admin/roles')]);
        setAccounts(accountRows); setRoles(roleRows);
      } else {
        const [rows, overviewView, bottlenecks] = await Promise.all([
          api.get<Omit<Stage, 'slaDays'>[]>('/admin/workflow-stages'),
          api.get<SlaOverview>('/admin/sla-overview'),
          api.get<SlaBottleneck[]>('/dashboard/sla-bottlenecks'),
        ]);
        setStages(rows.filter(stage => stage.stageCode !== 'HOAN_TAT').map(stage => ({ ...stage, slaDays: String(hoursToDays(stage.standardSlaHours)) })));
        setOverview(overviewView);
        setActuals(bottlenecks);
      }
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [section]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, busy]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editId) await api.put(`/users/${editId}`, accountUpdatePayload(form, isSelf));
      else await api.post('/users', form);
      setOpen(false); setNotice('Đã lưu tài khoản và vai trò.'); await load();
      if (isSelf) await restoreSession();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const changeContext = (code: StageCode): SlaChangeContext => ({ openLoans: overview?.openLoans[code] ?? 0, slaRangeHours: overview?.prediction?.slaRangeHours[code] ?? null });
  const saveStage = async (index: number) => {
    const stage = stages[index];
    const nextDays = Number(stage.slaDays);
    const prompt = slaChangePrompt(stage, nextDays, changeContext(stage.stageCode));
    setError(''); setNotice('');
    if (!prompt) { setNotice(`Định mức ${stage.stageName} không thay đổi.`); return; }
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      const standardSlaHours = daysToHours(nextDays);
      await api.put(`/admin/workflow-stages/${stage.stageCode}`, { standardSlaHours });
      setStages(stages.map((item, i) => i === index ? { ...item, standardSlaHours } : item));
      setNotice(`Đã cập nhật định mức ${stage.stageName}.`);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="admin-view">
    <div className="page-heading"><div><h2>{section === 'users' ? 'Liên hệ cá nhân' : 'Cấu hình SLA'}</h2></div><div className="page-actions">
      {section === 'users' && <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); setError(''); setNotice(''); }}>Tạo tài khoản</button>}
      <button disabled={busy} className="btn btn-secondary" onClick={() => void load()}>Làm mới</button>
    </div></div>
    {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="info-message">{notice}</p>}
    {section === 'users' ? <>
      <div className="data-table-container"><table className="data-table admin-account-table"><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò được cấp</th><th>Hồ sơ đang phụ trách</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td>{account.username}</td><td>{account.fullName}</td><td>{account.roles.map(role => ROLE_NAMES[role]).join(', ')}</td><td>{account.workloadActiveLoans ?? 0}</td><td><span className={`badge ${account.isActive ? 'badge-soft-green' : 'badge-soft-gray'}`}>{account.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className="btn btn-secondary" aria-label={`Sửa / Cấp quyền ${account.username}`} onClick={() => { setEditId(account.id); setForm({ ...emptyForm, ...account, password: '' }); setOpen(true); setError(''); setNotice(''); }}>Sửa / Cấp quyền</button></td></tr>)}</tbody></table></div>
      {open && <div className="modal-overlay"><section className="modal-content" style={{ maxWidth: 600 }} role="dialog" aria-modal="true" aria-labelledby="admin-account-dialog-title"><div className="modal-header"><h3 id="admin-account-dialog-title">{editId ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}</h3><button className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Đóng</button></div><form onSubmit={submit}><div className="modal-body admin-form">
        {error && <p role="alert" className="error-message">{error}</p>}
        {editId
          ? <><label>Tên đăng nhập (chỉ xem)<input readOnly value={form.username} /></label><label>Email (chỉ xem)<input readOnly value={form.email} /></label></>
          : <><label>Tên đăng nhập<input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label><label>Mật khẩu ban đầu<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></>}
        <label>Họ tên<input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
        {editId && <AccountStatusField active={form.isActive} isSelf={isSelf} blockReason={editing ? lockBlockReason(editing) : null} onChange={isActive => setForm({ ...form, isActive })} />}
        <label>Chi nhánh<input value={form.branchName} onChange={e => setForm({ ...form, branchName: e.target.value })} /></label><label>Điện thoại<input type="tel" autoComplete="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <fieldset disabled={isSelf}><legend>Vai trò (chọn ít nhất một)</legend>{isSelf && <p className="admin-readonly-note">{SELF_ROLE_NOTE}</p>}{roleCodes.map(role => <RoleChoice key={role} role={role} row={roles.find(item => item.code === role)} checked={form.roles.includes(role)} onChange={checked => setForm({ ...form, roles: checked ? [...form.roles, role] : form.roles.filter(item => item !== role) })} />)}</fieldset>      </div><div className="modal-footer"><button type="submit" className="btn btn-primary" disabled={busy || !form.roles.length}>{busy ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div></form></section></div>}
    </> : <>
      <div className="card admin-form">{stages.map((stage, index) => <form className="sla-row" key={stage.stageCode} onSubmit={e => { e.preventDefault(); void saveStage(index); }}><label>Tên công đoạn (chỉ xem)<input readOnly value={stage.stageName} /></label><label>SLA (ngày làm việc)<input required type="number" min={0.5} step={0.5} value={stage.slaDays} onChange={e => setStages(stages.map((item, i) => i === index ? { ...item, slaDays: e.target.value } : item))} /></label><button className="btn btn-primary" type="submit" disabled={busy}>Lưu</button><StageFacts actual={actuals.find(item => item.stageCode === stage.stageCode)} context={changeContext(stage.stageCode)} /></form>)}</div>

    </>}
  </section>;
}

/** Lý do không được khóa tài khoản đang hoạt động khi người đó còn hồ sơ chưa hoàn tất hoặc đề nghị Portal chưa xử lý; máy chủ chặn theo cùng điều kiện. */
export function lockBlockReason(account: Pick<Account, 'isActive' | 'workloadActiveLoans' | 'pendingPortalRequests'>) {
  const loans = account.workloadActiveLoans ?? 0;
  const portal = account.pendingPortalRequests ?? 0;
  if (!account.isActive || (!loans && !portal)) return null;
  const work = [loans && `${loans} hồ sơ chưa hoàn tất`, portal && `${portal} đề nghị Portal`].filter(Boolean).join(' và ');
  return `Đang phụ trách ${work}. Hãy điều chuyển trước khi khóa.`;
}

export function AccountStatusField({ active, isSelf, blockReason, onChange }: { active: boolean; isSelf: boolean; blockReason: string | null; onChange: (active: boolean) => void }) {
  const reasonId = blockReason ? 'account-status-reason' : undefined;
  return <fieldset className="account-status-field" disabled={isSelf}>
    <legend>Trạng thái</legend>
    <div className="account-status-options">
      <label className="check-label"><input type="radio" name="account-status" checked={active} onChange={() => onChange(true)} />Hoạt động</label>
      <label className="check-label"><input type="radio" name="account-status" aria-describedby={reasonId} disabled={!!blockReason} checked={!active} onChange={() => onChange(false)} />Đã khóa</label>
    </div>
    {blockReason && <p className="admin-readonly-note" id={reasonId}>{blockReason}</p>}
  </fieldset>;
}

/** Ô chọn vai trò trong form tài khoản, kèm dòng phạm vi việc đầu tiên và số tài khoản đang hoạt động của vai trò. */
export function RoleChoice({ role, row, checked, onChange }: { role: RoleCode; row?: RoleRow; checked: boolean; onChange: (checked: boolean) => void }) {
  const scopeId = `role-choice-${role}`;
  return <div className="role-choice">
    <label className="check-label"><input type="checkbox" aria-describedby={scopeId} checked={checked} onChange={e => onChange(e.target.checked)} />{ROLE_NAMES[role]}{row && <span className="role-choice-count">{row.activeUsers}/{row.totalUsers} tài khoản hoạt động</span>}</label>
    <p className="role-choice-scope" id={scopeId}>{ROLE_GUIDE[role]?.[0]}</p>
  </div>;
}

function StageFacts({ actual, context }: { actual?: SlaBottleneck; context: SlaChangeContext }) {
  const figures = actual ? stageActualFigures(actual) : null;
  return <p className="sla-row-facts">
    {figures ? `Thực tế trung bình ${figures.avgText} · Tỷ lệ trễ ${figures.delayRate}% (${figures.handled} hồ sơ đã xử lý)` : 'Chưa có số liệu thực tế'}
    {` · ${context.openLoans} hồ sơ đang mở giữ định mức cũ khi sửa`}
    {context.slaRangeHours ? ` · Mô hình dự báo hỗ trợ ${rangeText(context.slaRangeHours)}` : ' · Chưa đọc được dải định mức của mô hình dự báo'}
  </p>;
}
