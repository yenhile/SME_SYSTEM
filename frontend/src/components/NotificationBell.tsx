import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { notificationTarget } from './notificationTarget';

interface Notification { id: string; requestId: string | null; applicationId?: string | null; title: string; message: string; createdAt: string; readAt: string | null }
interface Inbox { items: Notification[]; unreadCount: number }

export function NotificationBell({ onOpenIntake, onOpenLoan }: { onOpenIntake: (id: string) => void; onOpenLoan: (id: string) => void }) {
  const { user, activeRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox>({ items: [], unreadCount: 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const load = async () => {
      if (pending || !user || !activeRole) return;
      pending = true;
      try { const data = await api.get<Inbox>('/notifications'); if (!disposed) { setInbox(data); setError(''); } }
      catch (err) { if (!disposed) setError((err as Error).message); }
      finally { pending = false; }
    };
    refresh.current = () => { void load(); };
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    window.addEventListener('focus', refresh.current);
    window.addEventListener('sme-notifications-refresh', refresh.current);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', refresh.current); window.removeEventListener('sme-notifications-refresh', refresh.current); };
  }, [user?.id, activeRole]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="notification-control" ref={container}>
    <button ref={trigger} className="notification-trigger" type="button" aria-label={`Thông báo, ${inbox.unreadCount} chưa đọc`} aria-expanded={open} aria-controls={open ? 'notification-inbox' : undefined} onClick={() => { setOpen(value => !value); refresh.current(); }}><Bell size={20} />{inbox.unreadCount > 0 && <span className="notification-count">{inbox.unreadCount}</span>}</button>
    {open && <section id="notification-inbox" className="notification-inbox" aria-label="Thông báo"><div className="portal-section-heading"><h2>Thông báo</h2><button className="portal-link" onClick={() => setOpen(false)}>Đóng</button></div>
      {error && <p role="alert" className="error-message">{error}</p>}
      {!error && !inbox.items.length && <p>Chưa có thông báo.</p>}
      <ul>{inbox.items.map(item => <li key={item.id}><button disabled={busy} type="button" className={`notification-item${item.readAt ? '' : ' unread'}`} onClick={async () => {
        setBusy(true); setError('');
        try { await api.post(`/notifications/${item.id}/read`); setOpen(false); const target = notificationTarget(item); if (target?.kind === 'intake') onOpenIntake(target.id); else if (target) onOpenLoan(target.id); refresh.current(); }
        catch (err) { setError((err as Error).message); }
        finally { setBusy(false); }
      }}><strong>{item.title}{!item.readAt && <span className="notification-unread"> • Chưa đọc</span>}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></button></li>)}</ul>
    </section>}
  </div>;
}
