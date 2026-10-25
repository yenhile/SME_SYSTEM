import { useState } from 'react';

/** Đóng thủ công hồ sơ quá hạn bổ sung (CLOSED_TIMEOUT). Bắt buộc có lý do; hồ sơ bị khóa sau khi đóng. */
export function CloseOverdueForm({ applicationCode, busy, onSubmit, onCancel }: {
  applicationCode: string; busy: boolean; onSubmit: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return <form
    style={{ background: 'var(--badge-red-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--badge-red-border)', display: 'flex', flexDirection: 'column', gap: 12 }}
    onSubmit={event => { event.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }}
  >
    <h4 style={{ color: 'var(--badge-red-text)', fontSize: '14px', fontWeight: 700 }}>Đóng hồ sơ do quá hạn bổ sung</h4>
    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
      Hồ sơ {applicationCode} sẽ chuyển sang trạng thái đã đóng do quá hạn và bị khóa mọi thao tác tiếp theo; không thể hoàn tác. Lý do, người đóng và thời điểm đóng được lưu vào lịch sử công đoạn.
    </p>
    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
      Lý do đóng hồ sơ (bắt buộc):
      <textarea required rows={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="Ví dụ: Doanh nghiệp không phản hồi sau khi đã liên hệ." />
    </label>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary">Hủy</button>
      <button type="submit" disabled={busy || !reason.trim()} className="btn btn-danger">{busy ? 'Đang đóng…' : 'Xác nhận đóng hồ sơ'}</button>
    </div>
  </form>;
}
