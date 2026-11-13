import { useEffect, useRef } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export const TOAST_MS = 10_000;

/** Thông báo thành công ở góc phải trên, tự ẩn sau 10 giây tính từ lúc hiện; vẫn đóng sớm được. */
export function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!message) return;
    const onClose = () => close.current();
    const timer = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message]);
  if (!message) return null;
  return <div className="app-toast" role="status" aria-live="polite">
    <CheckCircle2 size={18} aria-hidden="true" className="app-toast-icon" />
    <span className="app-toast-text">{message}</span>
    <button type="button" className="app-toast-close" aria-label="Đóng thông báo" onClick={onClose}><X size={16} aria-hidden="true" /></button>
  </div>;
}
