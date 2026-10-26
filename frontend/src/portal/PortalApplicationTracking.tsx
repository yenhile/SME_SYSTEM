import { useEffect, useState } from 'react';
import { portalApi } from './client';

export interface PortalTracking {
  requestId: string;
  reference: string;
  submittedAt: string | null;
  acceptedAt: string | null;
  status: { code: string; label: string; message: string };
  steps: { code: string; label: string; state: 'done' | 'current' | 'pending' | 'stopped' }[];
  rejection?: { code: string | null; label: string };
}

const MARK: Record<string, string> = { done: '✓', stopped: '✕', current: '●', pending: '' };

/** Hiển thị tiến độ công khai: chỉ các mốc, trạng thái và (nếu bị từ chối) lý do chung. */
export function TrackingView({ tracking }: { tracking: PortalTracking }) {
  return <section className="portal-card tracking-card" aria-label="Tiến độ xử lý hồ sơ">
    <div className="portal-section-heading"><div><span className="portal-eyebrow">TIẾN ĐỘ XỬ LÝ • {tracking.reference}</span><h2>{tracking.status.label}</h2></div></div>
    <ol className="tracking-steps">{tracking.steps.map((step, index) => <li key={step.code} className={`tracking-step ${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
      <span className="tracking-mark" aria-hidden="true">{MARK[step.state] || index + 1}</span><strong>{step.label}</strong>
    </li>)}</ol>
    <p className="tracking-message">{tracking.status.message}</p>
    {tracking.rejection && <p className="portal-error" role="status"><strong>Lý do:</strong> {tracking.rejection.label}</p>}
    <small>{tracking.submittedAt ? `Ngày gửi: ${new Date(tracking.submittedAt).toLocaleString('vi-VN')}` : 'Chưa gửi'}{tracking.acceptedAt ? ` • Ngày tiếp nhận: ${new Date(tracking.acceptedAt).toLocaleString('vi-VN')}` : ''}</small>
  </section>;
}

export function PortalApplicationTracking({ requestId }: { requestId: string }) {
  const [tracking, setTracking] = useState<PortalTracking | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setTracking(null); setError('');
    portalApi.get<PortalTracking>(`/requests/${requestId}/status`).then(value => { if (active) setTracking(value); }).catch(err => { if (active) setError((err as Error).message); });
    return () => { active = false; };
  }, [requestId]);
  if (error) return <p role="alert" className="portal-error">Không tải được tiến độ: {error}</p>;
  if (!tracking) return <p role="status">Đang tải tiến độ…</p>;
  return <TrackingView tracking={tracking} />;
}
