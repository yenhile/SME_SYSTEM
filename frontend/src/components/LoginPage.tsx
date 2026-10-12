import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../api/client';
export function LoginPage() {
  const { login, sessionError, restoreSession, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="login-page"><section className="card login-card">
    <div className="brand-icon"><Landmark size={26} /></div>
    <h1>SME Loan Workflow</h1><p>Đăng nhập để truy cập hệ thống</p>
    {sessionError && <div role="alert" className="error-message">{sessionError}{getAuthToken() && <button className="btn btn-secondary" onClick={() => void restoreSession()}>Thử kết nối lại</button>}<button className="btn" onClick={logout}>Đăng nhập lại</button></div>}
    <form onSubmit={async e => { e.preventDefault(); setError(''); setBusy(true); try { await login(username.trim(), password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label>Tên đăng nhập<input autoFocus required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label>
      <label>Mật khẩu<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  </section></main>;
}
