import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, Clock, FileText, History, Hourglass, Lock, Settings, UserCheck, Users } from 'lucide-react';
import { api } from '../../api/client';
import type { Tab } from '../../navigation';
import { CATEGORICAL, STATUS, dayLabel } from '../../dashboardCharts';
import type { AdminDashboardData } from '../../roleDashboards';
import { ChartCard, ColumnChart, DonutChart, LineChart } from './Charts';
import { DashboardHeader, DashboardTabs, KpiCard, KpiRow, LoadError } from './DashboardKit';
import { BacklogCharts } from './BacklogCharts';
import { PeriodReport } from '../PeriodReport';
import type { OperationsDashboard } from '../../operationsDashboard';

const LINKS: { tab: Tab; label: string; detail: string; icon: React.ReactNode }[] = [
  { tab: 'users', label: 'Tài khoản & vai trò', detail: 'Tạo, khóa/mở khóa, đổi vai trò cán bộ', icon: <Users size={18} /> },
  { tab: 'activity', label: 'Lịch sử hoạt động', detail: 'Nhật ký thao tác quản trị', icon: <History size={18} /> },
  { tab: 'settings', label: 'Cấu hình SLA', detail: 'Định mức giờ làm việc của công đoạn', icon: <Settings size={18} /> },
];

/** Hai tab: giám sát nghiệp vụ bằng số liệu tổng hợp (chỉ xem, không có hồ sơ chi tiết hay thao tác) và quản trị hệ thống. */
export function AdminDashboard({ onOpenTab }: { onOpenTab?: (tab: Tab) => void }) {
  const [tab, setTab] = useState<'business' | 'system'>('business');
  const [revision, setRevision] = useState(0);
  return <>
    <DashboardHeader title="Tổng quan hệ thống" loading={false} onRefresh={() => setRevision(r => r + 1)} />
    <DashboardTabs tabs={[['business', 'Tổng quan nghiệp vụ'], ['system', 'Quản trị hệ thống']]} value={tab} onChange={setTab} />
    {tab === 'business' ? <AdminBusiness revision={revision} /> : <AdminSystem onOpenTab={onOpenTab} revision={revision} />}
  </>;
}

/** Số liệu tổng hợp toàn hệ thống (một chi nhánh). Chỉ đọc phần tổng hợp của dashboard vận hành, không hiện danh sách hồ sơ. */
function AdminBusiness({ revision }: { revision: number }) {
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.get<OperationsDashboard>('/dashboard/operations?page=1&pageSize=1')); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, revision]);
  const waiting = (data?.stageDistribution ?? []).reduce((sum, s) => sum + s.waitingEnterprise, 0);
  return <>
    <h3 className="ops-section-title">Tồn đọng hiện tại</h3>
    {error && !data && <LoadError message={error} onRetry={load} />}
    <KpiRow loading={loading}>
      <KpiCard icon={<FileText size={20} />} tone="blue" title="Hồ sơ đang xử lý" value={data?.kpis.active} note="Tiếp nhận và Thẩm định, tại thời điểm xem" />
      <KpiCard icon={<Clock size={20} />} tone="red" title="Hồ sơ quá SLA" value={data?.kpis.overdue} note="Sự kiện thực tế theo giờ làm việc" />
      <KpiCard icon={<Hourglass size={20} />} tone="gray" title="Đang chờ doanh nghiệp" value={data ? waiting : undefined} note="Chờ bổ sung, SLA tạm dừng" />
      <KpiCard icon={<Brain size={20} />} tone="amber" title="ML cảnh báo nguy cơ trễ" value={data?.kpis.ml.flagged} note="Khẩn hoặc Chú ý, trên hồ sơ chưa quá hạn" />
    </KpiRow>
    <section className="viz-grid">
      <BacklogCharts data={data} loading={loading} scope="Toàn hệ thống · hồ sơ đang xử lý" />
    </section>
    <h3 className="ops-section-title">Thống kê theo kỳ</h3>
    <PeriodReport scope="Toàn hệ thống" revision={revision} />
  </>;
}

function AdminSystem({ onOpenTab, revision }: { onOpenTab?: (tab: Tab) => void; revision: number }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.get<AdminDashboardData>('/admin/dashboard')); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, revision]);

  const roles = data?.byRole ?? [];
  const accountSeries = [{ key: 'active', label: 'Đang hoạt động', color: CATEGORICAL[0] }, { key: 'locked', label: 'Bị khóa', color: STATUS.neutral }];
  const activity = data?.activity ?? [];

  return <>
    {error && !data && <LoadError message={error} onRetry={load} />}

    <KpiRow loading={loading}>
      <KpiCard icon={<Users size={20} />} tone="blue" title="Tổng tài khoản cán bộ" value={data?.accounts.total} note="Không gồm tài khoản cổng doanh nghiệp" />
      <KpiCard icon={<UserCheck size={20} />} tone="green" title="Đang hoạt động" value={data?.accounts.active} note="Đăng nhập được" />
      <KpiCard icon={<Lock size={20} />} tone="gray" title="Bị khóa" value={data?.accounts.locked} note="Không đăng nhập được, vẫn giữ lịch sử" />
      <KpiCard icon={<Activity size={20} />} tone="blue" title="Thao tác quản trị 30 ngày" value={data?.activityTotal} note="Theo nhật ký quản trị" onClick={onOpenTab ? () => onOpenTab('activity') : undefined} actionLabel="Mở Lịch sử hoạt động" />
    </KpiRow>

    <section className="viz-grid viz-grid-3">
      <ChartCard title="Tài khoản theo vai trò" scope="Một tài khoản kiêm nhiều vai trò được tính ở mỗi vai trò." loading={loading && !data} empty={!!data && !roles.length} legend={accountSeries}
        table={{ head: ['Vai trò', 'Đang hoạt động', 'Bị khóa'], rows: roles.map(r => [r.name, r.active, r.locked]) }}>
        <ColumnChart categories={roles.map(r => r.name)} series={accountSeries} values={[roles.map(r => r.active), roles.map(r => r.locked)]} unit="tài khoản" />
      </ChartCard>
      <ChartCard title="Trạng thái tài khoản" scope="Tất cả tài khoản cán bộ." loading={loading && !data} empty={!!data && !data.accounts.total}>
        {data && <DonutChart centerLabel="tài khoản" unit="tài khoản" slices={[
          { key: 'active', label: 'Đang hoạt động', value: data.accounts.active, color: CATEGORICAL[0] },
          { key: 'locked', label: 'Bị khóa', value: data.accounts.locked, color: STATUS.neutral },
        ]} />}
      </ChartCard>
      <ChartCard title="Thao tác quản trị theo ngày" scope="30 ngày gần nhất, giờ Việt Nam; nhật ký bắt đầu từ ngày triển khai." loading={loading && !data} empty={!!data && !data.activityTotal}
        emptyText="Chưa có thao tác quản trị nào trong 30 ngày gần nhất."
        table={{ head: ['Ngày', 'Thao tác'], rows: activity.filter(a => a.count).map(a => [dayLabel(a.day), a.count]) }}>
        <LineChart categories={activity.map(a => dayLabel(a.day))} series={[{ key: 'n', label: 'Thao tác', color: CATEGORICAL[0] }]} values={[activity.map(a => a.count)]} unit="thao tác" labelEvery={7} />
      </ChartCard>
    </section>

    {onOpenTab && <section className="adm-links" aria-label="Khu vực quản trị">
      {LINKS.map(link => <button key={link.tab} type="button" className="card adm-link" onClick={() => onOpenTab(link.tab)}>
        <span className="ops-kpi-icon" aria-hidden="true">{link.icon}</span>
        <span><strong>{link.label}</strong><small>{link.detail}</small></span>
      </button>)}
    </section>}
  </>;
}
