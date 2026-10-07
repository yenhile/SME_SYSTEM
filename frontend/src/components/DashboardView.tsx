import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { OverviewStats, SlaBottleneck, EarlyWarningItem } from '../types';
import {
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Brain,
} from 'lucide-react';

interface DashboardViewProps {
  onSelectLoan: (loanId: string) => void;
  onGoToAssignments: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectLoan, onGoToAssignments }) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [bottlenecks, setBottlenecks] = useState<SlaBottleneck[]>([]);
  const [warnings, setWarnings] = useState<EarlyWarningItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, bottlenecksData, warningsData] = await Promise.all([
        api.get<OverviewStats>('/dashboard/overview'),
        api.get<SlaBottleneck[]>('/dashboard/sla-bottlenecks'),
        api.get<EarlyWarningItem[]>('/dashboard/early-warnings'),
      ]);
      setStats(statsData);
      setBottlenecks(bottlenecksData);
      setWarnings(warningsData);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Dashboard Giám sát SLA & Cảnh báo Sớm (AI)
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Theo dõi các chỉ số vận hành chi nhánh và phát hiện sớm các hồ sơ có nguy cơ chậm trễ bằng Học máy
        </p>
      </div>

      {/* KPI Cards Grid Trắng Sáng */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ color: '#0284c7', background: 'var(--primary-light)' }}>
            <FileText size={22} />
          </div>
          <div className="kpi-info">
            <h4>Hồ sơ đang xử lý</h4>
            <div className="kpi-value" style={{ color: '#0284c7' }}>
              {stats ? stats.activeApplications : '—'}
            </div>
            <div className="kpi-sub">Tổng tích lũy: {stats ? stats.totalApplications : 0} hồ sơ</div>
          </div>
        </div>

        <div className="kpi-card success">
          <div className="kpi-icon-wrap" style={{ color: '#059669', background: 'var(--badge-green-bg)' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-info">
            <h4>Tỷ lệ đúng hạn SLA</h4>
            <div className="kpi-value" style={{ color: '#059669' }}>
              {stats ? `${stats.slaOnTimeRate}%` : '—'}
            </div>
            <div className="kpi-sub">
              {stats ? `${stats.totalCompletedStages - stats.delayedStages}/${stats.totalCompletedStages} lượt đúng hạn` : ''}
            </div>
          </div>
        </div>

        <div className="kpi-card danger">
          <div className="kpi-icon-wrap" style={{ color: '#dc2626', background: 'var(--badge-red-bg)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-info">
            <h4>Cảnh báo Đỏ (AI High Risk)</h4>
            <div className="kpi-value" style={{ color: '#dc2626' }}>
              {stats ? stats.highRiskLoans : '—'}
            </div>
            <div className="kpi-sub">Hồ sơ nguy cơ trễ hạn cao (&gt; 70%)</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ color: '#7c3aed', background: 'var(--badge-purple-bg)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-info">
            <h4>Hồ sơ đã phê duyệt</h4>
            <div className="kpi-value" style={{ color: '#7c3aed' }}>
              {stats ? stats.approvedApplications : '—'}
            </div>
            <div className="kpi-sub">Từ chối: {stats ? stats.rejectedApplications : 0}</div>
          </div>
        </div>
      </div>

      {/* Phân tích Điểm nghẽn Quy trình SLA (Bottleneck Analysis - UC17) */}
      <div className="card" style={{ marginBottom: 24, background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--badge-amber-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
              }}
            >
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                Phân tích Điểm nghẽn Quy trình SLA (Bottleneck Analysis)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                So sánh thời gian xử lý thực tế trung bình với SLA định mức chuẩn từng công đoạn
              </p>
            </div>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã công đoạn</th>
                <th>Tên công đoạn</th>
                <th>SLA Định mức</th>
                <th>Thực tế trung bình</th>
                <th>Số lượt đã xử lý</th>
                <th>Số lượt trễ hạn</th>
                <th>Tỷ lệ trễ hạn (%)</th>
                <th>Đánh giá Điểm nghẽn</th>
              </tr>
            </thead>
            <tbody>
              {bottlenecks.map((st) => (
                <tr key={st.stageCode}>
                  <td>
                    <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{st.stageCode}</code>
                  </td>
                  <td>
                    <strong>{st.stageName}</strong>
                  </td>
                  <td>{st.standardSlaHours} giờ</td>
                  <td>
                    <strong style={{ color: st.avgNetWorkHours > st.standardSlaHours ? '#dc2626' : 'inherit' }}>
                      {st.avgNetWorkHours} giờ
                    </strong>
                  </td>
                  <td>{st.totalHandled} lượt</td>
                  <td>{st.delayedCount} lượt</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          background: '#f1f5f9',
                          borderRadius: 3,
                          overflow: 'hidden',
                          minWidth: 80,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, st.delayRate)}%`,
                            height: '100%',
                            background: st.delayRate > 15 ? '#ef4444' : '#0284c7',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{st.delayRate}%</span>
                    </div>
                  </td>
                  <td>
                    {st.isBottleneck ? (
                      <span className="badge badge-soft-red">⚠️ ĐIỂM NGHẼN CAO</span>
                    ) : (
                      <span className="badge badge-soft-green">Ổn định</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng Cảnh báo Sớm AI (AI Early Warning - UC18) */}
      <div className="card" style={{ background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--badge-red-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
              }}
            >
              <Brain size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                Bảng Cảnh báo Sớm AI (AI Early Warning Rankings)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Danh sách các hồ sơ đang xử lý được xếp hạng theo xác suất trễ hạn kèm giải thích nguyên nhân (XAI)
              </p>
            </div>
          </div>

          <button onClick={onGoToAssignments} className="btn btn-secondary" style={{ fontSize: '12px' }}>
            Điều phối cán bộ <ArrowRight size={14} />
          </button>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hồ sơ / Doanh nghiệp</th>
                <th>Số tiền vay</th>
                <th>Công đoạn</th>
                <th>Mức độ rủi ro</th>
                <th>Xác suất trễ (AI)</th>
                <th>Top nguyên nhân chính (Explainable AI)</th>
                <th>Cán bộ phụ trách</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {warnings.length > 0 ? (
                warnings.map((item) => (
                  <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => onSelectLoan(item.id)}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                        {item.applicationCode}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.companyName}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: '#0369a1', fontFamily: 'var(--font-mono)' }}>
                        {Number(item.loanAmount).toLocaleString('vi-VN')} VNĐ
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Bổ sung: {item.supplementCount} lần
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-soft-gray">{item.currentStage}</span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          item.riskLevel === 'CAO'
                            ? 'badge-soft-red'
                            : item.riskLevel === 'TRUNG_BINH'
                            ? 'badge-soft-amber'
                            : 'badge-soft-green'
                        }`}
                      >
                        {item.riskLevel === 'CAO' ? '⚠️ ' : ''}
                        {item.riskLevel}
                      </span>
                    </td>

                    <td>
                      <strong
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '14px',
                          color:
                            item.riskLevel === 'CAO'
                              ? '#dc2626'
                              : item.riskLevel === 'TRUNG_BINH'
                              ? '#d97706'
                              : '#059669',
                        }}
                      >
                        {(item.delayProbability * 100).toFixed(1)}%
                      </strong>
                    </td>

                    <td style={{ maxWidth: '320px' }}>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {item.topReasons.slice(0, 2).map((r, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              marginBottom: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span style={{ color: '#ea580c' }}>•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </td>

                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.assignedOfficer}</div>
                    </td>

                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLoan(item.id);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Xử lý
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Không có hồ sơ nào trong diện cảnh báo nguy cơ trễ hạn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
