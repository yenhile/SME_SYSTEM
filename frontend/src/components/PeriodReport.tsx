import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api/client';
import { loanTypeLabel } from '../appraisalWorkspace';
import { stageLabel } from '../loanListDisplay';
import { dateText, hoursText, monthText, presetRange, rateText, REPORT_PRESETS, reportToCsv, todayKey, vndText, type PeriodReportData, type ReportPreset } from '../periodReport';

/** Báo cáo thống kê theo khoảng thời gian, chỉ dành cho Quản lý chi nhánh. */
export function PeriodReport() {
  const today = todayKey();
  const [preset, setPreset] = useState<ReportPreset | ''>('30');
  const [range, setRange] = useState(() => presetRange('30', today));
  const [report, setReport] = useState<PeriodReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true); setError('');
    try { setReport(await api.get<PeriodReportData>(`/dashboard/report?from=${from}&to=${to}`)); }
    catch (err) { setError((err as Error).message || 'Không tải được báo cáo.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(range.from, range.to); }, [load, range.from, range.to]);

  const choose = (value: ReportPreset) => { setPreset(value); setRange(presetRange(value, today)); };
  const download = () => {
    if (!report) return;
    const csv = '﻿' + reportToCsv(report, { stage: stageLabel, loanType: loanTypeLabel });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `bao-cao-thong-ke_${report.range.from}_${report.range.to}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };
  const t = report?.totals;
  const maxMonth = Math.max(1, ...(report?.monthly ?? []).flatMap(m => [m.created, m.completed]));

  return <section className="card" style={{ background: '#ffffff' }} aria-label="Báo cáo thống kê">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <h3 style={{ fontSize: 14, margin: 0 }}>Báo cáo thống kê</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{report ? `${dateText(report.range.from)} – ${dateText(report.range.to)} (${report.range.days} ngày)` : 'Chọn khoảng thời gian'}</p>
      </div>
      <button type="button" className="btn btn-secondary" disabled={!report || loading} onClick={download}><Download size={14} aria-hidden="true" /> Tải CSV</button>
    </div>

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      {REPORT_PRESETS.map(item => <button key={item.value} type="button" className={`btn ${preset === item.value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={preset === item.value} onClick={() => choose(item.value)}>{item.label}</button>)}
      <label style={{ fontSize: 12 }}>Từ <input type="date" value={range.from} max={range.to} onChange={e => { setPreset(''); setRange(r => ({ ...r, from: e.target.value })); }} /></label>
      <label style={{ fontSize: 12 }}>Đến <input type="date" value={range.to} min={range.from} max={today} onChange={e => { setPreset(''); setRange(r => ({ ...r, to: e.target.value })); }} /></label>
    </div>

    {error && <p role="alert" className="error-message">{error}</p>}
    {loading && !report && <p role="status" style={{ fontSize: 13 }}>Đang tải…</p>}
    {report && t && <div style={{ opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          ['Hồ sơ tạo mới', t.created], ['Hồ sơ hoàn tất', t.completed], ['Phê duyệt', t.approved], ['Từ chối', t.rejected],
          ['Đóng quá hạn', t.closedTimeout], ['Tỷ lệ phê duyệt', rateText(t.approvalRate)], ['Tiền phê duyệt', vndText(t.approvedAmount)],
        ].map(([label, value]) => <div key={label} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
          <strong style={{ fontSize: 20 }}>{value}</strong>
        </div>)}
      </div>

      <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>Theo công đoạn (giờ làm việc, công đoạn kết thúc trong kỳ)</h4>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Công đoạn</th><th>Số lượt</th><th>Số lượt trễ</th><th>Tỷ lệ trễ</th><th>Giờ ròng trung bình</th></tr></thead><tbody>
        {report.stages.map(s => <tr key={s.stageCode}><td>{stageLabel(s.stageCode)}</td><td>{s.handled}</td><td>{s.delayed}</td><td>{rateText(s.delayRate)}</td><td>{hoursText(s.avgNetWorkHours)}</td></tr>)}
      </tbody></table></div>

      <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Theo cán bộ tín dụng</h4>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Cán bộ</th><th>Hồ sơ mới</th><th>Hoàn tất</th><th>Phê duyệt</th><th>Từ chối</th><th>Tiếp nhận kết thúc</th><th>Tiếp nhận trễ</th></tr></thead><tbody>
        {report.byOfficer.length === 0 && <tr><td colSpan={7}>Không có dữ liệu trong kỳ.</td></tr>}
        {report.byOfficer.map(o => <tr key={o.id}><td>{o.fullName}</td><td>{o.created}</td><td>{o.completed}</td><td>{o.approved}</td><td>{o.rejected}</td><td>{o.receptionHandled}</td><td>{o.receptionDelayed}</td></tr>)}
      </tbody></table></div>

      <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Theo loại vay</h4>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Loại vay</th><th>Hồ sơ mới</th><th>Phê duyệt</th><th>Tiền phê duyệt</th></tr></thead><tbody>
        {report.byLoanType.length === 0 && <tr><td colSpan={4}>Không có dữ liệu trong kỳ.</td></tr>}
        {report.byLoanType.map(l => <tr key={l.loanType}><td>{loanTypeLabel(l.loanType)}</td><td>{l.created}</td><td>{l.approved}</td><td>{vndText(l.approvedAmount)}</td></tr>)}
      </tbody></table></div>

      <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Theo tháng</h4>
      <div style={{ display: 'grid', gap: 8 }}>
        {report.monthly.map(m => <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, alignItems: 'center', fontSize: 12 }}>
          <span>{monthText(m.month)}</span>
          <div style={{ display: 'grid', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ height: 8, borderRadius: 4, background: 'var(--primary, #4f46e5)', width: `${(m.created / maxMonth) * 100}%`, minWidth: m.created ? 4 : 0 }} />{m.created} mới</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ height: 8, borderRadius: 4, background: '#059669', width: `${(m.completed / maxMonth) * 100}%`, minWidth: m.completed ? 4 : 0 }} />{m.completed} hoàn tất</div>
          </div>
        </div>)}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '14px 0 0' }}>{report.basis}</p>
    </div>}
  </section>;
}
