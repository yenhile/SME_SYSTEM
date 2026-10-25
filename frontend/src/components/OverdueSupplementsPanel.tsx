export interface OverdueSupplementItem {
  id: string; applicationId: string; applicationCode: string; companyName: string;
  assignedOfficer: string; assignedOfficerId?: string | null;
  requestedAt: string; deadlineAt?: string | null; overdueAt: string; daysOverdue: number;
}

/** DEC-02: hồ sơ quá hạn bổ sung chờ Quản lý xem xét. Chỉ hiển thị, không tự đóng hồ sơ. */
export function OverdueSupplementsPanel({ items, onSelectLoan }: { items: OverdueSupplementItem[]; onSelectLoan: (loanId: string) => void }) {
  if (!items.length) return null;
  return <section className="card" aria-label="Hồ sơ quá hạn bổ sung" style={{ marginBottom: 20, borderLeft: '4px solid #dc2626' }}>
    <h3 style={{ fontSize: '15px', color: '#dc2626' }}>🔴 Hồ sơ quá hạn bổ sung chứng từ ({items.length})</h3>
    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Doanh nghiệp chưa bổ sung sau thời hạn. Hồ sơ vẫn ở trạng thái chờ bổ sung; Quản lý xem xét và quyết định.</p>
    <div className="data-table-container"><table className="data-table">
      <thead><tr><th>Hồ sơ / Doanh nghiệp</th><th>Cán bộ phụ trách</th><th>Quá hạn</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => onSelectLoan(item.applicationId)}>
        <td><div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.applicationCode}</div><div style={{ fontSize: '12px' }}>{item.companyName}</div></td>
        <td>{item.assignedOfficer}</td>
        <td><span className="badge badge-soft-red">{item.daysOverdue > 0 ? `${item.daysOverdue} ngày` : "Hôm nay"}</span></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
