import { useEffect, useRef, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { api } from '../api/client';
import { MIN_PASSWORD_LENGTH, validatePasswordChange } from '../passwordRules';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstField.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validatePasswordChange(oldPassword, newPassword, confirmPassword);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await api.post('/auth/change-password', { oldPassword, newPassword });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setDone(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: 440 }} role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KeyRound size={18} aria-hidden="true" />
          <h3 id="change-password-title" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Đổi mật khẩu</h3>
        </div>
        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }} aria-label="Đóng"><X size={16} /></button>
      </div>
      {done ? <>
        <div className="modal-body"><p role="status">Đổi mật khẩu thành công.</p></div>
        <div className="modal-footer"><button type="button" className="btn btn-primary" onClick={onClose}>Đóng</button></div>
      </> : <form onSubmit={submit} noValidate>
        <div className="modal-body admin-form">
          {error && <p role="alert" className="error-message">{error}</p>}
          <label>Mật khẩu hiện tại<input ref={firstField} type="password" autoComplete="current-password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} /></label>
          <label>Mật khẩu mới (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
          <label>Xác nhận mật khẩu mới<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
        </div>
      </form>}
    </div>
  </div>;
}
