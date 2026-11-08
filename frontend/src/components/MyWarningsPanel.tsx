import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '../api/client';
import { stageLabel } from '../loanListDisplay';
import { alertDisplay, compareAlerts, slaLeftText } from '../slaDisplay';
import type { EarlyWarningItem } from '../types';

const MAX_ROWS = 5;

/**
 * Hồ sơ do chính CBTD phụ trách mà mô hình dự báo trễ SLA đánh dấu Chú ý, Khẩn hoặc Quá hạn, xếp theo xác suất giảm dần.
 * Để CBTD biết xử lý hồ sơ nào trước mà không cần mở từng hồ sơ. Chỉ đọc; dữ liệu do máy chủ lọc theo người đăng nhập.
 */
export function MyWarningsPanel({ refreshKey, onSelectLoan }: { refreshKey: number; onSelectLoan: (loanId: string) => void }) {
  const [items, setItems] = useState<EarlyWarningItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get<EarlyWarningItem[]>('/dashboard/my-warnings')
      .then(rows => { if (!cancelled) { setItems(rows); setError(''); } })
      .catch(() => { if (!cancelled) setError('Chưa tải được cảnh báo từ mô hình dự báo.'); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const urgent = (items ?? [])
    .filter(item => {
      const alert = alertDisplay(item.riskLevel, item.delayProbability);
      return alert && alert.code !== 'BINH_THUONG';
    })
    .sort(compareAlerts);

  return <section className="card" style={{ marginBottom: 16 }} aria-label="Hồ sơ cần ưu tiên theo mô hình dự báo">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Brain size={18} aria-hidden="true" />
      <h3 style={{ fontSize: 14, margin: 0 }}>Hồ sơ của tôi cần ưu tiên</h3>
    </div>
    {error && <p role="alert" style={{ fontSize: 12, margin: 0 }}>{error}</p>}
    {!error && items === null && <p style={{ fontSize: 12, margin: 0 }} role="status">Đang tải…</p>}
    {!error && items !== null && urgent.length === 0 && <p style={{ fontSize: 13, margin: 0 }}>Hiện không có hồ sơ nào cần ưu tiên.</p>}
    {urgent.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
      {urgent.slice(0, MAX_ROWS).map(item => {
        const alert = alertDisplay(item.riskLevel, item.delayProbability)!;
        const left = slaLeftText(item);
        return <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${alert.tone === 'red' ? 'badge-soft-red' : 'badge-soft-amber'}`}>{alert.label}</span>
          <button type="button" className="lt-code" onClick={() => onSelectLoan(item.id)}>{item.applicationCode}</button>
          <span style={{ fontSize: 13 }}>{item.companyName}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stageLabel(item.currentStage)}{left ? ` · ${left}` : ''}</span>
          {item.topReasons[0] && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.topReasons[0]}</span>}
        </li>;
      })}
    </ul>}
    {urgent.length > MAX_ROWS && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>Còn {urgent.length - MAX_ROWS} hồ sơ khác trong danh sách bên dưới.</p>}
  </section>;
}
