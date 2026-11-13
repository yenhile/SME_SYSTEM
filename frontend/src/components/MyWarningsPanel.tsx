import { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { api } from '../api/client';
import { stageLabel } from '../loanListDisplay';
import { alertDisplay, compareAlerts, predictedAtText, slaLeftText } from '../slaDisplay';
import type { EarlyWarningItem } from '../types';
import './my-warnings.css';

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
      const alert = alertDisplay(item.riskLevel, item.delayProbability, item.slaOverdue);
      return alert && alert.code !== 'BINH_THUONG';
    })
    .sort(compareAlerts);

  return <section className="card mw-panel" aria-label="Hồ sơ cần xử lý ngay theo dự báo trễ SLA">
    <div className="mw-head">
      <span className="mw-icon" aria-hidden="true"><AlarmClock size={16} /></span>
      <h3>Cần xử lý ngay</h3>
      {urgent.length > 0 && <span className="mw-count">{urgent.length}</span>}
    </div>
    {error && <p role="alert" className="mw-note">{error}</p>}
    {!error && items === null && <p className="mw-note" role="status">Đang tải…</p>}
    {!error && items !== null && urgent.length === 0 && <p className="mw-note">Hiện không có hồ sơ nào cần ưu tiên.</p>}
    {urgent.length > 0 && <ul className="mw-list">
      {urgent.slice(0, MAX_ROWS).map(item => {
        const alert = alertDisplay(item.riskLevel, item.delayProbability, item.slaOverdue)!;
        const left = item.slaOverdue ? null : slaLeftText(item);
        const predictedAt = predictedAtText(item.predictedAt);
        return <li key={item.id} className={`mw-item mw-${alert.tone === 'red' ? 'danger' : 'warning'}`}>
          <button type="button" className="mw-row" onClick={() => onSelectLoan(item.id)}>
            <span className={`badge mw-badge ${alert.tone === 'red' ? 'badge-soft-red' : 'badge-soft-amber'}`}>{alert.label}</span>
            <span className="mw-main">
              <span className="mw-code">{item.applicationCode}</span>
              <span className="mw-company">{item.companyName}</span>
            </span>
            <span className="mw-stage">
              <span>{stageLabel(item.currentStage)}</span>
              {left && <span className="mw-left">{left}</span>}
            </span>
            {item.topReasons[0] && <span className="mw-reason" title={predictedAt ?? undefined}>{item.topReasons[0]}</span>}
          </button>
        </li>;
      })}
    </ul>}
    {urgent.length > MAX_ROWS && <p className="mw-note mw-more">Còn {urgent.length - MAX_ROWS} hồ sơ khác trong danh sách bên dưới.</p>}
  </section>;
}
