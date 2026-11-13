import React, { useCallback, useEffect, useState } from 'react';
import { Brain, ClipboardCheck, Clock, FolderOpen } from 'lucide-react';
import { api } from '../../api/client';
import { loanStatusView } from '../../loanListDisplay';
import type { OperationsRow } from '../../operationsDashboard';
import { CATEGORICAL, STATUS, monthLabel, slaStack } from '../../dashboardCharts';
import { OFFICER_TASK_LABELS, STATUS_COLORS, officerQuery, type OfficerDashboardData } from '../../roleDashboards';
import { ChartCard, ColumnChart, DonutChart, LineChart } from './Charts';
import { CaseTable, DashboardHeader, KpiCard, KpiRow, LoadError, caseAttention, caseColumns } from './DashboardKit';

type TaskRow = OperationsRow & { task: string };

export function OfficerDashboard({ onSelectLoan }: { onSelectLoan: (id: string) => void }) {
  const [data, setData] = useState<OfficerDashboardData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.get<OfficerDashboardData>(officerQuery(page))); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const sla = slaStack(data ? [data.sla] : []);
  const statuses = data?.statusDistribution ?? [];
  const trend = data?.completionTrend ?? [];

  return <>
    <DashboardHeader title="Việc của tôi" loading={loading} onRefresh={load} />
    {error && !data && <LoadError message={error} onRetry={load} />}

    <KpiRow loading={loading}>
      <KpiCard icon={<FolderOpen size={20} />} tone="blue" title="Hồ sơ tôi đang phụ trách" value={data?.kpis.assigned} note="Đang xử lý ở Tiếp nhận hoặc Thẩm định" />
      <KpiCard icon={<ClipboardCheck size={20} />} tone="blue" title="Đang chờ tôi xử lý" value={data?.kpis.myTurn} note="Không tính hồ sơ chờ doanh nghiệp hoặc chờ Thẩm quyền" />
      <KpiCard icon={<Clock size={20} />} tone="red" title="Hồ sơ của tôi quá SLA" value={data?.kpis.overdue} note="Sự kiện thực tế theo giờ làm việc" />
      <KpiCard icon={<Brain size={20} />} tone="amber" title="ML cảnh báo nguy cơ trễ" value={data?.kpis.mlFlagged} note="Khẩn hoặc Chú ý, trên hồ sơ chưa quá hạn" />
    </KpiRow>

    <CaseTable<TaskRow> title="Hồ sơ tôi cần xử lý" subtitle="Chỉ các hồ sơ đang đến lượt bạn. Quá hạn SLA trước, rồi theo mức cảnh báo và giờ còn lại."
      columns={[caseColumns.code, caseColumns.company, caseColumns.stage,
        { label: 'Việc cần làm', render: row => <strong className="ops-task">{OFFICER_TASK_LABELS[row.task] ?? row.task}</strong> },
        caseColumns.due, caseColumns.sla, caseColumns.ml]}
      rows={(data?.tasks.items ?? []) as TaskRow[]} total={data?.tasks.total ?? 0} page={data?.tasks.page ?? page} pageSize={data?.tasks.pageSize ?? 10}
      loading={loading} error={error} attention={caseAttention} actionLabel="Mở hồ sơ" onOpen={onSelectLoan} onPage={setPage} onRetry={load}
      emptyText="Hiện không có hồ sơ nào đang chờ bạn xử lý." />

    <section className="viz-grid viz-grid-3">
      <ChartCard title="Hồ sơ của tôi theo trạng thái" scope="Mọi hồ sơ bạn phụ trách, gồm cả hồ sơ đã kết thúc." loading={loading && !data} empty={!!data && !statuses.length}>
        <DonutChart centerLabel="hồ sơ" slices={statuses.map(s => ({ key: s.status, label: loanStatusView(s.status).label, value: s.count, color: STATUS_COLORS[s.status] ?? STATUS.muted }))} />
      </ChartCard>
      <ChartCard title="Tình trạng SLA hồ sơ đang xử lý" scope="Hồ sơ bạn đang phụ trách, tại thời điểm xem." loading={loading && !data} empty={!!data && !data.kpis.assigned}
        table={data ? { head: ['Tình trạng', 'Hồ sơ'], rows: sla.series.map((s, i) => [s.label, sla.values[i][0]]) } : undefined}>
        <ColumnChart categories={sla.series.map(s => s.label.replace(' (chờ doanh nghiệp)', ''))} series={[{ key: 'n', label: 'Hồ sơ', color: CATEGORICAL[0] }]}
          values={[sla.series.map((_, i) => sla.values[i][0])]} />
      </ChartCard>
      <ChartCard title="Hồ sơ tôi đã hoàn tất theo tháng" scope="Sáu tháng gần nhất, theo ngày hoàn tất (giờ Việt Nam)." loading={loading && !data} empty={!!data && !trend.some(m => m.completed)}
        emptyText="Chưa có hồ sơ hoàn tất trong sáu tháng gần nhất."
        table={{ head: ['Tháng', 'Hoàn tất'], rows: trend.map(m => [monthLabel(m.month), m.completed]) }}>
        <LineChart categories={trend.map(m => monthLabel(m.month))} series={[{ key: 'done', label: 'Hoàn tất', color: CATEGORICAL[0] }]} values={[trend.map(m => m.completed)]} />
        <p className="viz-note">Tháng hiện tại mới tính đến hôm nay.</p>
      </ChartCard>
    </section>
  </>;
}
