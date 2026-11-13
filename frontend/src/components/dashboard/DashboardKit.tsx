import React from 'react';
import { RefreshCw } from 'lucide-react';
import { dateTimeText, stageActualFigures, stageStandardText, workingDurationText } from '../../slaDisplay';
import { pageCount, pageSummary } from '../../loanListDisplay';
import { mlCellView, onTimeSummary, operationsStageLabel, slaStateView, type OperationsRow } from '../../operationsDashboard';
import type { SlaBottleneck } from '../../types';

export type Tone = 'blue' | 'red' | 'amber' | 'green' | 'gray';

export function DashboardHeader({ title, loading, onRefresh, actions }: { title: string; loading: boolean; onRefresh: () => void; actions?: React.ReactNode }) {
  return <header className="ops-head">
    <h2>{title}</h2>
    <div className="ops-head-actions">
      {actions}
      <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Làm mới</button>
    </div>
  </header>;
}

export function KpiCard({ icon, tone, title, value, note, onClick, actionLabel }: {
  icon: React.ReactNode; tone: Tone; title: string; value?: number | string | null; note: string; onClick?: () => void; actionLabel?: string;
}) {
  const body = <>
    <span className="ops-kpi-icon" aria-hidden="true">{icon}</span>
    <div>
      <h4>{title}</h4>
      <div className="ops-kpi-value">{value ?? '—'}</div>
      <p>{note}</p>
    </div>
  </>;
  return onClick
    ? <button type="button" className={`card ops-kpi ops-kpi-${tone} is-clickable`} onClick={onClick} aria-label={`${title}: ${value ?? '—'}. ${actionLabel ?? ''}`}>{body}</button>
    : <div className={`card ops-kpi ops-kpi-${tone}`}>{body}</div>;
}

export function KpiRow({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return <section className="ops-kpis" aria-label="Chỉ số chính" aria-busy={loading}>{children}</section>;
}

export function DashboardTabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (tab: T) => void }) {
  return <div className="dsh-tabs" role="tablist">
    {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? 'is-active' : ''} onClick={() => onChange(key)}>{label}</button>)}
  </div>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="card ops-error" role="alert">
    <strong>Không tải được dữ liệu</strong><span>{message}</span>
    <button type="button" className="btn btn-secondary" onClick={onRetry}>Thử lại</button>
  </div>;
}

export function slaCell(row: Pick<OperationsRow, 'slaState' | 'slaDueAt' | 'slaRemainingHours'>): { text: string; detail: string } {
  if (row.slaState === 'PAUSED') return { text: 'Tạm dừng', detail: 'chờ doanh nghiệp' };
  const due = row.slaDueAt ? dateTimeText(row.slaDueAt) : '—';
  if ((row.slaState === 'ON_TIME' || row.slaState === 'DUE_SOON') && row.slaRemainingHours !== null) return { text: due, detail: `còn ${workingDurationText(row.slaRemainingHours)}` };
  return { text: due, detail: '' };
}

export interface CaseColumn<T> { label: string; render: (row: T) => React.ReactNode }

/** Bảng hồ sơ dùng chung: trạng thái tải/rỗng/lỗi, vạch màu theo mức cần chú ý, phân trang máy chủ, nút mở hồ sơ ở cột cuối. */
export function CaseTable<T extends { id: string; applicationCode: string }>({ title, subtitle, columns, rows, total, page, pageSize, loading, error, emptyText, attention, actionLabel, onOpen, onPage, onRetry, headerExtra }: {
  title: string; subtitle: string; columns: CaseColumn<T>[]; rows: T[]; total: number; page: number; pageSize: number; loading: boolean; error: string; emptyText: React.ReactNode;
  attention?: (row: T) => 'danger' | 'warning' | null; actionLabel: string; onOpen: (id: string) => void; onPage: (page: number) => void; onRetry: () => void; headerExtra?: React.ReactNode;
}) {
  const span = columns.length + 1;
  const pages = pageCount({ total, pageSize });
  return <section className="card ops-priority" aria-label={title}>
    <div className="ops-priority-head">
      <div><h3>{title}</h3><p>{subtitle}</p></div>
      <div className="ops-priority-tools">{headerExtra}<span className="lt-summary" role="status">{loading ? 'Đang tải dữ liệu…' : pageSummary({ total, page, pageSize })}</span></div>
    </div>
    <div className="lt-container">
      <table className="lt-table ops-table" aria-busy={loading}>
        <thead><tr>{columns.map(c => <th key={c.label} scope="col">{c.label}</th>)}<th scope="col"><span className="lt-sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {loading && !rows.length && [0, 1, 2].map(i => <tr key={i} className="lt-skeleton" aria-hidden="true">{Array.from({ length: span }, (_, c) => <td key={c}><span /></td>)}</tr>)}
          {!loading && error && !rows.length && <tr><td colSpan={span} className="ops-empty">Không tải được danh sách. <button type="button" className="btn btn-secondary" onClick={onRetry}>Thử lại</button></td></tr>}
          {!loading && !error && !rows.length && <tr><td colSpan={span} className="ops-empty">{emptyText}</td></tr>}
          {rows.map(row => {
            const mark = attention?.(row);
            return <tr key={row.id} className={`lt-row${mark ? ` lt-row-${mark}` : ''}`}>
              {columns.map(c => <td key={c.label} data-label={c.label}>{c.render(row)}</td>)}
              <td className="ops-action"><button type="button" className="btn btn-secondary" onClick={() => onOpen(row.id)} aria-label={`${actionLabel} ${row.applicationCode}`}>{actionLabel}</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {pages > 1 && <nav className="lt-pagination" aria-label={`Phân trang ${title}`}>
      <button type="button" className="btn btn-secondary" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Trang trước</button>
      <span>Trang {page} / {pages}</span>
      <button type="button" className="btn btn-secondary" disabled={loading || page >= pages} onClick={() => onPage(page + 1)}>Trang sau</button>
    </nav>}
  </section>;
}

export const Chip = ({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) => <span className={`lt-status lt-status-${tone}`} title={title}>{children}</span>;

/** Cột dùng chung cho hồ sơ đang mở: công đoạn, hạn SLA, tình trạng SLA và cảnh báo ML tách biệt. */
export const caseColumns = {
  code: { label: 'Mã hồ sơ', render: (row: OperationsRow) => <strong className="ops-code">{row.applicationCode}</strong> },
  company: { label: 'Doanh nghiệp', render: (row: OperationsRow) => <span className="lt-clamp" title={row.companyName}>{row.companyName}</span> },
  stage: { label: 'Công đoạn', render: (row: OperationsRow) => <>{operationsStageLabel(row.currentStage)}{row.currentStatus === 'SUPPLEMENT_REQUIRED' && <span className="lt-sub">Chờ bổ sung</span>}</> },
  officer: { label: 'CBTD phụ trách', render: (row: OperationsRow) => row.assignedOfficer ?? <span className="lt-sub">Chưa phân công</span> },
  due: { label: 'Hạn SLA', render: (row: OperationsRow) => { const due = slaCell(row); return <>{due.text}{due.detail && <span className="lt-sub">{due.detail}</span>}</>; } },
  sla: { label: 'Tình trạng SLA', render: (row: OperationsRow) => { const v = slaStateView(row.slaState); return <Chip tone={v.tone}>{v.label}</Chip>; } },
  ml: { label: 'Cảnh báo ML', render: (row: OperationsRow) => { const v = mlCellView(row); return <><Chip tone={v.tone} title={row.topReason ?? undefined}>{v.label}</Chip>{row.slaState === 'OVERDUE' ? <span className="lt-sub">Đã quá hạn thực tế</span> : row.topReason && <span className="lt-sub ops-reason">{row.topReason}</span>}</>; } },
};

export const caseAttention = (row: OperationsRow): 'danger' | 'warning' | null => row.slaState === 'OVERDUE' || row.mlLevel === 'KHAN' ? 'danger' : row.mlLevel === 'CHU_Y' || row.slaState === 'DUE_SOON' ? 'warning' : null;

export function SlaBottleneckTable({ bottlenecks }: { bottlenecks: SlaBottleneck[] }) {
  const onTime = onTimeSummary(bottlenecks);
  return <div className="card ops-bottleneck">
    <div className="ops-priority-head">
      <div>
        <h3>Điểm nghẽn SLA theo công đoạn (lũy kế)</h3>
        <p>Đơn vị là lượt công đoạn đã kết thúc, không phải số hồ sơ; so thời gian thực tế trung bình với định mức.</p>
      </div>
      <div className="ops-ontime">
        <span>Tỷ lệ đúng hạn</span>
        <strong>{onTime.rate === null ? '—' : `${onTime.rate.toLocaleString('vi-VN')}%`}</strong>
        <small>{onTime.total ? `${onTime.onTime}/${onTime.total} lượt · ${onTime.basis === 'PA1' ? 'giờ làm việc' : 'cách cũ (giờ thực)'}` : 'Chưa có công đoạn kết thúc'}</small>
      </div>
    </div>
    <div className="data-table-container">
      <table className="data-table">
        <thead><tr><th>Công đoạn</th><th>SLA định mức</th><th>Thực tế trung bình</th><th>Số lượt đã xử lý</th><th>Số lượt trễ hạn</th><th>Tỷ lệ trễ hạn</th><th>Đánh giá</th></tr></thead>
        <tbody>
          {bottlenecks.map(st => {
            // Giờ làm việc (PA1) là cách tính đang áp dụng: có dữ liệu PA1 thì hiện PA1 ở số chính, cách cũ chỉ là dòng phụ.
            const pa1 = st.pa1 && st.pa1.totalHandled > 0 ? st.pa1 : null;
            const v = pa1 ?? st;
            const figures = stageActualFigures(st);
            return <tr key={st.stageCode}>
              <td><strong>{st.stageName}</strong></td>
              <td>{stageStandardText(st.stageCode, st.standardSlaHours)}</td>
              <td>
                <strong style={{ color: v.avgNetWorkHours > st.standardSlaHours ? 'var(--sla-danger)' : 'inherit' }}>{st.stageCode === 'HOAN_TAT' ? '—' : figures.avgText}</strong>
                {pa1 && st.totalHandled > 0 && st.stageCode !== 'HOAN_TAT' && <div className="ops-subline">Cách cũ (giờ thực): {st.avgNetWorkHours} giờ · {st.totalHandled} lượt</div>}
              </td>
              <td>{v.totalHandled} lượt</td>
              <td>{v.delayedCount} lượt</td>
              <td>{v.delayRate}%</td>
              <td>{v.isBottleneck ? <Chip tone="red">Điểm nghẽn cao</Chip> : <Chip tone="green">Ổn định</Chip>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
