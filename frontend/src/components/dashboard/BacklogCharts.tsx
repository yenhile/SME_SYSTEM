import React from 'react';
import { operationsStageLabel, type OperationsDashboard } from '../../operationsDashboard';
import { CATEGORICAL, slaStack } from '../../dashboardCharts';
import { ChartCard, ColumnChart } from './Charts';

interface Props {
  data: OperationsDashboard | null;
  loading: boolean;
  scope: string;
  /** Bấm cột công đoạn để lọc phần còn lại của màn; không truyền thì biểu đồ chỉ để xem. */
  selectedStage?: string;
  onSelectStage?: (stage: string) => void;
  /** Quản lý chi nhánh xem theo cán bộ nên bỏ biểu đồ công đoạn (số theo công đoạn đã có ở KPI). */
  showStageChart?: boolean;
}

/** Tồn đọng tại thời điểm xem: hồ sơ đang xử lý theo công đoạn và tình trạng SLA của từng công đoạn. */
export function BacklogCharts({ data, loading, scope, selectedStage, onSelectStage, showStageChart = true }: Props) {
  const stages = data?.stageDistribution ?? [];
  const sla = slaStack(data?.slaByStage ?? []);
  const empty = !!data && !data.kpis.active;
  return <>
    {showStageChart && <ChartCard title="Hồ sơ đang xử lý theo công đoạn" scope={`${scope}${onSelectStage ? '. Bấm cột để lọc.' : '.'}`} loading={loading && !data} empty={empty}
      table={{ head: ['Công đoạn', 'Hồ sơ', 'Trong đó chờ bổ sung'], rows: stages.map(s => [operationsStageLabel(s.stage), s.total, s.waitingEnterprise]) }}>
      <ColumnChart categories={stages.map(s => operationsStageLabel(s.stage))} series={[{ key: 'total', label: 'Hồ sơ', color: CATEGORICAL[0] }]} values={[stages.map(s => s.total)]}
        selected={selectedStage ? stages.findIndex(s => s.stage === selectedStage) : null}
        onSelect={onSelectStage ? i => onSelectStage(stages[i].stage) : undefined} />
      <p className="viz-note">Chờ bổ sung là trạng thái bên trong công đoạn: {stages.map(s => `${operationsStageLabel(s.stage)} ${s.waitingEnterprise}`).join(' · ')}.</p>
    </ChartCard>}
    <ChartCard title="Tình trạng SLA theo công đoạn" scope={`${scope}, theo giờ làm việc của công đoạn đang mở.`} loading={loading && !data} empty={empty} legend={sla.series}
      table={{ head: ['Công đoạn', ...sla.series.map(s => s.label)], rows: (data?.slaByStage ?? []).map((g, i) => [operationsStageLabel(g.stage), ...sla.series.map((_, s) => sla.values[s][i])]) }}>
      <ColumnChart categories={(data?.slaByStage ?? []).map(g => operationsStageLabel(g.stage))} series={sla.series} values={sla.values} />
      <p className="viz-note">Sắp hết hạn: công đoạn còn không quá 8 giờ làm việc và chưa quá hạn.</p>
    </ChartCard>
  </>;
}
