import React, { useCallback, useEffect, useState } from 'react';
import { CheckSquare, Clock, Gavel, Hourglass } from 'lucide-react';
import { api } from '../../api/client';
import { dateTimeText, slaDeadlineCell } from '../../slaDisplay';
import { compactMoney } from '../../loanListDisplay';
import { CATEGORICAL, STATUS, monthLabel, slaStack } from '../../dashboardCharts';
import { slaStateOfSummary, slaStateView } from '../../operationsDashboard';
import { approverQueueQuery, loanTypeName, submittedText, type ApproverDashboardData } from '../../roleDashboards';
import type { LoanApplication } from '../../types';
import { BarChart, ChartCard, ColumnChart } from './Charts';
import { CaseTable, Chip, DashboardHeader, KpiCard, KpiRow, LoadError } from './DashboardKit';

interface QueuePage { items: LoanApplication[]; total: number; page: number; pageSize: number }

const queueSlaChip = (loan: LoanApplication) => {
  const view = slaStateView(slaStateOfSummary(loan.slaSummary));
  return <Chip tone={view.tone}>{view.label}</Chip>;
};

export function ApproverDashboard({ onSelectLoan }: { onSelectLoan: (id: string) => void }) {
  const [data, setData] = useState<ApproverDashboardData | null>(null);
  const [queue, setQueue] = useState<QueuePage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [summary, rows] = await Promise.all([api.get<ApproverDashboardData>('/dashboard/approver'), api.get<QueuePage>(approverQueueQuery(page))]);
      setData(summary); setQueue(rows);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const sla = slaStack(data ? [data.queueSla] : []);
  const trend = data?.decisionTrend ?? [];
  const decisionSeries = [{ key: 'approved', label: 'Phê duyệt', color: CATEGORICAL[0] }, { key: 'rejected', label: 'Từ chối', color: CATEGORICAL[1] }];
  const waits = (data?.waitByLoanType ?? []).filter(w => w.avgWorkHours !== null);

  return <>
    <DashboardHeader title="Hàng chờ phê duyệt" loading={loading} onRefresh={load} />
    {error && !data && <LoadError message={error} onRetry={load} />}

    <KpiRow loading={loading}>
      <KpiCard icon={<Gavel size={20} />} tone="blue" title="Chờ tôi phê duyệt" value={data?.kpis.waiting} note="Tờ trình đã trình, bạn độc lập để quyết định" />
      <KpiCard icon={<Hourglass size={20} />} tone="amber" title="Chờ duyệt sắp quá SLA" value={data?.kpis.dueSoon} note="Còn không quá 8 giờ làm việc, chưa quá hạn" />
      <KpiCard icon={<Clock size={20} />} tone="red" title="Chờ duyệt đã quá SLA" value={data?.kpis.overdue} note="Sự kiện thực tế theo giờ làm việc" />
      <KpiCard icon={<CheckSquare size={20} />} tone="blue" title={`Đã quyết định ${data?.kpis.decided.days ?? 30} ngày qua`} value={data?.kpis.decided.total}
        note={data ? `Toàn hàng việc · trong đó bạn quyết định ${data.kpis.decided.mine}` : ''} />
    </KpiRow>

    <CaseTable<LoanApplication> title="Hồ sơ chờ tôi phê duyệt" subtitle="Cùng danh sách nhóm Chờ quyết định ở màn Thẩm định & phê duyệt; quyết định thực hiện trong hồ sơ."
      columns={[
        { label: 'Mã hồ sơ', render: l => <strong className="ops-code">{l.applicationCode}</strong> },
        { label: 'Doanh nghiệp', render: l => <span className="lt-clamp" title={l.company?.companyName}>{l.company?.companyName}</span> },
        { label: 'Số tiền đề nghị', render: l => <>{compactMoney(l.officialAmount ?? l.proposedAmount)}<span className="lt-sub">{loanTypeName(l.loanType)}</span></> },
        { label: 'Cấp phê duyệt', render: () => <>Thẩm định<span className="lt-sub">Thẩm quyền chi nhánh (tối đa 10 tỷ)</span></> },
        { label: 'Thời điểm trình', render: l => submittedText(l.reportVersion, dateTimeText) },
        { label: 'Hạn SLA', render: l => { const cell = slaDeadlineCell(l.slaSummary); return <>{cell.text}{cell.detail && cell.tone !== 'danger' && <span className="lt-sub">{cell.detail}</span>}</>; } },
        { label: 'Tình trạng SLA', render: queueSlaChip },
      ]}
      rows={queue?.items ?? []} total={queue?.total ?? 0} page={queue?.page ?? page} pageSize={queue?.pageSize ?? 10}
      loading={loading} error={error} attention={l => (l.slaSummary?.isOverdue ? 'danger' : null)} actionLabel="Xem chi tiết" onOpen={onSelectLoan} onPage={setPage} onRetry={load}
      emptyText="Không có tờ trình nào đang chờ bạn quyết định." />

    <section className="viz-grid viz-grid-3">
      <ChartCard title="Hàng chờ theo tình trạng SLA" scope="Hồ sơ đang chờ bạn quyết định, tại thời điểm xem." loading={loading && !data} empty={!!data && !data.kpis.waiting}
        table={data ? { head: ['Tình trạng', 'Hồ sơ'], rows: sla.series.map((s, i) => [s.label, sla.values[i][0]]) } : undefined}>
        <ColumnChart categories={sla.series.map(s => s.label.replace(' (chờ doanh nghiệp)', ''))} series={[{ key: 'n', label: 'Hồ sơ', color: CATEGORICAL[0] }]} values={[sla.series.map((_, i) => sla.values[i][0])]} />
      </ChartCard>
      <ChartCard title="Kết quả quyết định theo tháng" scope="Sáu tháng gần nhất; công đoạn Thẩm định kết thúc bằng phê duyệt hoặc từ chối, toàn hàng việc." loading={loading && !data}
        empty={!!data && !trend.some(m => m.approved || m.rejected)} legend={decisionSeries}
        table={{ head: ['Tháng', 'Phê duyệt', 'Từ chối'], rows: trend.map(m => [monthLabel(m.month), m.approved, m.rejected]) }}>
        <ColumnChart categories={trend.map(m => monthLabel(m.month))} series={decisionSeries} values={[trend.map(m => m.approved), trend.map(m => m.rejected)]} />
      </ChartCard>
      <ChartCard title="Thời gian đã chờ theo loại vay" scope="Giờ làm việc trung bình đã dùng ở Thẩm định của hồ sơ đang chờ bạn quyết định." loading={loading && !data} empty={!!data && !waits.length}
        table={{ head: ['Loại vay', 'Hồ sơ', 'Giờ làm việc TB'], rows: waits.map(w => [loanTypeName(w.loanType), w.count, w.avgWorkHours ?? '—']) }}>
        <BarChart rows={waits.map(w => loanTypeName(w.loanType))} series={[{ key: 'h', label: 'Giờ làm việc TB', color: STATUS.neutral }]} values={[waits.map(w => w.avgWorkHours ?? 0)]} unit="giờ"
          valueText={i => `${String(waits[i].avgWorkHours).replace('.', ',')} giờ · ${waits[i].count} hồ sơ`} />
      </ChartCard>
    </section>
  </>;
}
