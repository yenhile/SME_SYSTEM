import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Brain, Clock, FileText, UserPlus } from 'lucide-react';
import { api } from '../../api/client';
import { operationsQuery, operationsStageLabel, stageChoices, type OperationsDashboard, type OperationsFilters, type OperationsRow } from '../../operationsDashboard';
import { STATUS, slaStack } from '../../dashboardCharts';
import type { SlaBottleneck } from '../../types';
import { FilterSelect } from '../FilterSelect';
import { PeriodReport } from '../PeriodReport';
import { OverdueSupplementsPanel, type OverdueSupplementItem } from '../OverdueSupplementsPanel';
import { BarChart, ChartCard, DonutChart } from './Charts';
import { BacklogCharts } from './BacklogCharts';
import { CaseTable, DashboardHeader, DashboardTabs, KpiCard, KpiRow, LoadError, SlaBottleneckTable, caseAttention, caseColumns } from './DashboardKit';

const EMPTY: OperationsFilters = { stage: '', officerId: '' };

interface Props { onSelectLoan: (id: string) => void; onGoToAssignments?: () => void }

export function ManagerDashboard({ onSelectLoan, onGoToAssignments }: Props) {
  const [tab, setTab] = useState<'now' | 'period'>('now');
  const [revision, setRevision] = useState(0);
  return <>
    <DashboardHeader title="Điều hành chi nhánh" loading={false} onRefresh={() => setRevision(r => r + 1)}
      actions={onGoToAssignments && <button type="button" className="btn btn-secondary" onClick={onGoToAssignments}>Điều phối cán bộ <ArrowRight size={14} aria-hidden="true" /></button>} />
    <DashboardTabs tabs={[['now', 'Vận hành hiện tại'], ['period', 'Báo cáo theo kỳ']]} value={tab} onChange={setTab} />
    {tab === 'now' ? <ManagerNow revision={revision} onSelectLoan={onSelectLoan} onGoToAssignments={onGoToAssignments} /> : <ManagerPeriod revision={revision} />}
  </>;
}

function ManagerNow({ onSelectLoan, onGoToAssignments, revision }: Props & { revision: number }) {
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [draft, setDraft] = useState<OperationsFilters>(EMPTY);
  const [filters, setFilters] = useState<OperationsFilters>(EMPTY);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overdueSupplements, setOverdueSupplements] = useState<OverdueSupplementItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.get<OperationsDashboard>(operationsQuery(filters, page))); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [filters, page]);
  useEffect(() => { load(); }, [load, revision]);
  useEffect(() => {
    // Yêu cầu bổ sung quá hạn chờ Quản lý xem xét đóng (DEC-02).
    api.get<OverdueSupplementItem[]>('/dashboard/overdue-supplements').then(setOverdueSupplements).catch(() => setOverdueSupplements([]));
  }, []);

  const apply = (next: OperationsFilters) => { setDraft(next); setFilters(next); setPage(1); };
  const filtered = Boolean(filters.stage || filters.officerId);
  const stages = data?.stageDistribution ?? [];
  const load_ = (data?.officerLoad ?? []).filter(o => o.officerId);
  const loadStack = slaStack(load_);
  const ml = data?.ml;
  const scopeText = `${filtered ? 'Theo bộ lọc' : 'Toàn chi nhánh'} · hồ sơ đang xử lý`;

  return <>
    <form className="card ops-filters" aria-label="Bộ lọc dashboard" onSubmit={event => { event.preventDefault(); apply(draft); }}>
      <FilterSelect label="Công đoạn" placeholder="Tất cả công đoạn" value={draft.stage} options={stageChoices(data?.scope.stages ?? [])} onChange={stage => setDraft({ ...draft, stage })} />
      <FilterSelect label="CBTD phụ trách" placeholder="Tất cả cán bộ" value={draft.officerId} options={(data?.officers ?? []).map(o => [o.id, o.name] as [string, string])} onChange={officerId => setDraft({ ...draft, officerId })} />
      <div className="ops-filter-actions">
        {filtered && <button type="button" className="btn btn-secondary" onClick={() => apply(EMPTY)}>Xóa bộ lọc</button>}
        <button type="submit" className="btn" disabled={loading}>Áp dụng</button>
      </div>
    </form>

    {error && !data && <LoadError message={error} onRetry={load} />}
    {error && data && <p role="alert" className="error-message">Không cập nhật được số liệu mới: {error}</p>}

    <KpiRow loading={loading}>
      <KpiCard icon={<FileText size={20} />} tone="blue" title="Hồ sơ đang xử lý" value={data?.kpis.active} note={stages.map(s => `${operationsStageLabel(s.stage)} ${s.total}`).join(' · ')} />
      <KpiCard icon={<UserPlus size={20} />} tone="amber" title="Chờ phân công" value={data?.unassigned ? data.unassigned.portalRequests : undefined}
        note={data?.unassigned ? `Đề nghị Portal đã gửi, chưa có CBTD · hồ sơ chưa có CBTD: ${data.unassigned.loans} · không theo bộ lọc` : ''}
        onClick={onGoToAssignments} actionLabel="Mở Điều chuyển & phân công" />
      <KpiCard icon={<Clock size={20} />} tone="red" title="Quá hạn SLA" value={data?.kpis.overdue} note={data ? `Sự kiện thực tế · sắp hết hạn thêm ${data.kpis.dueSoon} hồ sơ` : ''} />
      <KpiCard icon={<Brain size={20} />} tone="amber" title="ML cảnh báo nguy cơ trễ" value={data?.kpis.ml.flagged} note={data ? `Khẩn ${data.kpis.ml.urgent} · Chú ý ${data.kpis.ml.watch} · trên hồ sơ chưa quá hạn` : ''} />
    </KpiRow>

    <section className="viz-grid">
      <ChartCard wide title="Hồ sơ đang phụ trách theo CBTD" scope={`${scopeText}, chia theo tình trạng SLA; là khối lượng tồn đọng, không phải chỉ số năng suất. Bấm tên cán bộ để lọc bảng bên dưới.`} loading={loading && !data} empty={!!data && !load_.length}
        legend={loadStack.series} table={{ head: ['CBTD', 'Tổng', ...loadStack.series.map(s => s.label)], rows: load_.map((o, i) => [o.name ?? '', o.total, ...loadStack.series.map((_, s) => loadStack.values[s][i])]) }}>
        <BarChart rows={load_.map(o => o.name ?? '')} series={loadStack.series} values={loadStack.values}
          onSelect={i => apply({ ...filters, officerId: filters.officerId === load_[i].officerId ? '' : load_[i].officerId ?? '' })} />
      </ChartCard>
      <BacklogCharts data={data} loading={loading} scope={scopeText} showStageChart={false} />
      <ChartCard title="Dự báo nguy cơ trễ SLA" scope={ml ? `Tính trên ${ml.predictedScope} hồ sơ chưa quá hạn; ${ml.overdueExcluded} hồ sơ đã quá hạn không xếp mức dự báo.` : ''} loading={loading && !data} empty={!!ml && !ml.predictedScope}
        emptyText="Không có hồ sơ chưa quá hạn để dự báo.">
        {ml && <DonutChart centerLabel="hồ sơ" slices={[
          { key: 'urgent', label: 'Khẩn', value: ml.urgent, color: STATUS.critical },
          { key: 'watch', label: 'Chú ý', value: ml.watch, color: STATUS.warning },
          { key: 'normal', label: 'Bình thường', value: ml.normal, color: STATUS.good },
          { key: 'none', label: 'Chưa có dự báo', value: ml.none, color: STATUS.muted },
        ]} />}
        <p className="viz-note">Mô hình chỉ dự báo nguy cơ trễ SLA, không đánh giá tín dụng. Thẩm định không dùng mức Chú ý.</p>
      </ChartCard>
    </section>

    <CaseTable<OperationsRow> title="Hồ sơ cần giám sát và điều phối" subtitle="Quá hạn SLA trước, rồi Khẩn → Chú ý → Bình thường → chưa có dự báo; cùng mức thì hồ sơ còn ít giờ hơn trước."
      columns={[caseColumns.code, caseColumns.company, caseColumns.stage, caseColumns.officer, caseColumns.due, caseColumns.sla, caseColumns.ml]}
      rows={data?.priority.items ?? []} total={data?.priority.total ?? 0} page={data?.priority.page ?? page} pageSize={data?.priority.pageSize ?? 10}
      loading={loading} error={error} attention={caseAttention} actionLabel="Xem" onOpen={onSelectLoan} onPage={setPage} onRetry={load}
      emptyText={filtered ? <>Không có hồ sơ phù hợp bộ lọc. <button type="button" className="btn btn-secondary" onClick={() => apply(EMPTY)}>Xóa bộ lọc</button></> : 'Không có hồ sơ đang xử lý.'} />

    <OverdueSupplementsPanel items={overdueSupplements} onSelectLoan={onSelectLoan} />
  </>;
}

function ManagerPeriod({ revision }: { revision: number }) {
  const [bottlenecks, setBottlenecks] = useState<SlaBottleneck[]>([]);
  useEffect(() => {
    api.get<SlaBottleneck[]>('/dashboard/sla-bottlenecks').then(setBottlenecks).catch(() => setBottlenecks([]));
  }, [revision]);
  return <>
    <PeriodReport scope="Toàn chi nhánh" showOfficers revision={revision} />
    <SlaBottleneckTable bottlenecks={bottlenecks} />
  </>;
}
