import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, FilePlus2, FileCheck2, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { loanTypeLabel } from '../appraisalWorkspace';
import { stageLabel } from '../loanListDisplay';
import { dateText, hoursText, presetRange, rateText, REPORT_PRESETS, reportToCsv, todayKey, vndText, type PeriodReportData, type ReportPreset } from '../periodReport';
import { CATEGORICAL, STATUS, dayLabel, monthLabel, officerResults } from '../dashboardCharts';
import { BarChart, ChartCard, ColumnChart, DonutChart, LineChart } from './dashboard/Charts';
import { KpiCard, KpiRow, LoadError } from './dashboard/DashboardKit';

interface PeriodReportProps {
  /** Phạm vi dữ liệu do backend giới hạn, ghi ở từng biểu đồ. */
  scope: string;
  /** Bảng theo cán bộ tín dụng chỉ dành cho Quản lý chi nhánh. */
  showOfficers?: boolean;
  revision?: number;
}

/** Báo cáo thống kê theo kỳ dùng chung cho Admin và Quản lý chi nhánh; số liệu từ `GET /dashboard/report`. */
export function PeriodReport({ scope, showOfficers = false, revision = 0 }: PeriodReportProps) {
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
  useEffect(() => { void load(range.from, range.to); }, [load, range.from, range.to, revision]);

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
  const buckets = report?.trend.buckets ?? [];
  const daily = report?.trend.granularity === 'day';
  const labels = buckets.map(b => (daily ? dayLabel(b.key) : monthLabel(b.key)));
  const period = report ? `${dateText(report.range.from)} – ${dateText(report.range.to)} (${report.range.days} ngày)` : '';
  const trendSeries = [{ key: 'created', label: 'Hồ sơ tạo mới', color: CATEGORICAL[0] }, { key: 'completed', label: 'Hồ sơ hoàn tất', color: CATEGORICAL[1] }];
  const decisionSeries = [{ key: 'approved', label: 'Phê duyệt', color: CATEGORICAL[0] }, { key: 'rejected', label: 'Từ chối', color: CATEGORICAL[1] }];
  const stageSeries = [{ key: 'onTime', label: 'Đúng hạn', color: STATUS.good }, { key: 'late', label: 'Trễ hạn', color: STATUS.critical }];
  const stages = report?.stages ?? [];
  const showLoading = loading && !report;
  const results = officerResults(report?.byOfficer ?? []);
  const resultSeries = [...decisionSeries, { key: 'timeout', label: 'Đóng do quá hạn bổ sung', color: STATUS.neutral }];

  return <section className="rpt" aria-label="Báo cáo thống kê theo kỳ">
    <div className="card rpt-filter" role="group" aria-label="Kỳ báo cáo">
      <div className="rpt-presets">
        {REPORT_PRESETS.map(item => <button key={item.value} type="button" className={`btn ${preset === item.value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={preset === item.value} onClick={() => choose(item.value)}>{item.label}</button>)}
      </div>
      <label>Từ <input type="date" value={range.from} max={range.to} onChange={e => { setPreset(''); setRange(r => ({ ...r, from: e.target.value })); }} /></label>
      <label>Đến <input type="date" value={range.to} min={range.from} max={today} onChange={e => { setPreset(''); setRange(r => ({ ...r, to: e.target.value })); }} /></label>
      <button type="button" className="btn btn-secondary rpt-csv" disabled={!report || loading} onClick={download}><Download size={14} aria-hidden="true" /> Tải CSV</button>
    </div>

    {error && <LoadError message={error} onRetry={() => void load(range.from, range.to)} />}

    <KpiRow loading={loading}>
      <KpiCard icon={<FilePlus2 size={20} />} tone="blue" title="Hồ sơ tạo mới trong kỳ" value={t?.created} note="Theo ngày tạo hồ sơ" />
      <KpiCard icon={<FileCheck2 size={20} />} tone="blue" title="Hồ sơ hoàn tất trong kỳ" value={t?.completed} note={t ? `Phê duyệt ${t.approved} · Từ chối ${t.rejected} · Đóng quá hạn ${t.closedTimeout}` : ''} />
      <KpiCard icon={<Clock size={20} />} tone="green" title="Tỷ lệ xử lý đúng hạn" value={report ? rateText(report.onTime.rate) : undefined}
        note={report ? `${report.onTime.onTime}/${report.onTime.handled} lượt công đoạn kết thúc trong kỳ` : ''} />
      <KpiCard icon={<Wallet size={20} />} tone="blue" title="Tiền phê duyệt thực tế" value={t ? vndText(t.approvedAmount) : undefined}
        note={t ? `Tỷ lệ phê duyệt ${rateText(t.approvalRate)} trên hồ sơ có quyết định` : ''} />
    </KpiRow>

    <section className="viz-grid viz-grid-3">
      {showOfficers && <ChartCard wide title="Kết quả theo CBTD" scope={`${scope} · ${period} · hồ sơ CBTD phụ trách đã hoàn tất trong kỳ, theo kết quả; xếp theo tên.`} loading={showLoading}
        empty={!!report && !results.length} emptyText="Không có hồ sơ hoàn tất trong kỳ." legend={resultSeries}
        table={{ head: ['CBTD', 'Hoàn tất', 'Phê duyệt', 'Từ chối', 'Đóng quá hạn'], rows: results.map(r => [r.name, r.completed, r.approved, r.rejected, r.closedTimeout]) }}>
        <BarChart rows={results.map(r => r.name)} series={resultSeries} values={[results.map(r => r.approved), results.map(r => r.rejected), results.map(r => r.closedTimeout)]} />
      </ChartCard>}
      <ChartCard wide title="Hồ sơ tạo mới và hoàn tất" scope={`${scope} · ${period} · theo ${daily ? 'ngày' : 'tháng'}, giờ Việt Nam.`} loading={showLoading}
        empty={!!report && !t?.created && !t?.completed} legend={trendSeries}
        table={{ head: [daily ? 'Ngày' : 'Tháng', 'Tạo mới', 'Hoàn tất'], rows: buckets.map((b, i) => [labels[i], b.created, b.completed]) }}>
        <LineChart categories={labels} series={trendSeries} values={[buckets.map(b => b.created), buckets.map(b => b.completed)]} />
      </ChartCard>
      <ChartCard title="Kết quả hồ sơ hoàn tất" scope={`${scope} · hồ sơ hoàn tất trong kỳ, mỗi hồ sơ một kết quả.`} loading={showLoading} empty={!!report && !t?.completed}>
        {t && <DonutChart centerLabel="hồ sơ" slices={[
          { key: 'approved', label: 'Phê duyệt', value: t.approved, color: CATEGORICAL[0] },
          { key: 'rejected', label: 'Từ chối', value: t.rejected, color: CATEGORICAL[1] },
          { key: 'timeout', label: 'Đóng do quá hạn bổ sung', value: t.closedTimeout, color: STATUS.neutral },
        ]} />}
      </ChartCard>
      <ChartCard title="Kết quả xét duyệt theo thời gian" scope={`${scope} · số hồ sơ phê duyệt và từ chối theo ${daily ? 'ngày' : 'tháng'} hoàn tất.`} loading={showLoading}
        empty={!!report && !t?.approved && !t?.rejected} legend={decisionSeries}
        table={{ head: [daily ? 'Ngày' : 'Tháng', 'Phê duyệt', 'Từ chối'], rows: buckets.filter(b => b.approved || b.rejected).map(b => [daily ? dayLabel(b.key) : monthLabel(b.key), b.approved, b.rejected]) }}>
        <ColumnChart categories={labels} series={decisionSeries}
          values={[buckets.map(b => b.approved), buckets.map(b => b.rejected)]} showValues={!daily} />
      </ChartCard>
      <ChartCard title="Đúng hạn theo công đoạn" scope={`${scope} · lượt công đoạn kết thúc trong kỳ, giờ làm việc (PA1); đơn vị là lượt, không phải hồ sơ.`} loading={showLoading}
        empty={!!report && !stages.some(s => s.handled)} legend={stageSeries}
        table={{ head: ['Công đoạn', 'Lượt', 'Trễ', 'Tỷ lệ trễ', 'Giờ ròng TB'], rows: stages.map(s => [stageLabel(s.stageCode), s.handled, s.delayed, rateText(s.delayRate), hoursText(s.avgNetWorkHours)]) }}>
        <ColumnChart categories={stages.map(s => stageLabel(s.stageCode))} series={stageSeries} values={[stages.map(s => s.handled - s.delayed), stages.map(s => s.delayed)]} unit="lượt" />
      </ChartCard>
    </section>

    {report && <details className="card rpt-details" open={showOfficers}>
      <summary>Bảng chi tiết {showOfficers ? 'theo cán bộ và loại vay' : 'theo loại vay'}</summary>
      {showOfficers && <>
        <h4>Theo cán bộ tín dụng</h4>
        <div className="data-table-container"><table className="data-table"><thead><tr><th>Cán bộ</th><th>Hồ sơ mới</th><th>Hoàn tất</th><th>Phê duyệt</th><th>Từ chối</th><th>Tiếp nhận kết thúc</th><th>Tiếp nhận trễ</th></tr></thead><tbody>
          {report.byOfficer.length === 0 && <tr><td colSpan={7}>Không có dữ liệu trong kỳ.</td></tr>}
          {[...report.byOfficer].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')).map(o => <tr key={o.id}><td>{o.fullName}</td><td>{o.created}</td><td>{o.completed}</td><td>{o.approved}</td><td>{o.rejected}</td><td>{o.receptionHandled}</td><td>{o.receptionDelayed}</td></tr>)}
        </tbody></table></div>
      </>}
      <h4>Theo loại vay</h4>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Loại vay</th><th>Hồ sơ mới</th><th>Phê duyệt</th><th>Tiền phê duyệt</th></tr></thead><tbody>
        {report.byLoanType.length === 0 && <tr><td colSpan={4}>Không có dữ liệu trong kỳ.</td></tr>}
        {report.byLoanType.map(l => <tr key={l.loanType}><td>{loanTypeLabel(l.loanType)}</td><td>{l.created}</td><td>{l.approved}</td><td>{vndText(l.approvedAmount)}</td></tr>)}
      </tbody></table></div>
      <p className="viz-note"><CheckCircle2 size={12} aria-hidden="true" /> {report.basis}</p>
    </details>}
  </section>;
}
