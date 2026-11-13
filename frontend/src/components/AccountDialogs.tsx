import { useEffect, useState, type ReactNode } from 'react';
import { CircleHelp, CircleUserRound, Languages, Settings, ShieldCheck, X } from 'lucide-react';
import { ROLE_NAMES, useAuth } from '../context/AuthContext';
import { applyPreferences, FONT_SCALES, loadPreferences, savePreferences } from '../userPreferences';
import type { RoleCode } from '../types';
import { ROLE_GUIDE } from '../roleGuide';

export type AccountPageKind = 'profile' | 'settings' | 'help' | 'privacy';
export type AccountDialogKind = 'language';

export const ACCOUNT_TITLES: Record<AccountPageKind | AccountDialogKind, { title: string; icon: typeof Settings }> = {
  profile: { title: 'Hồ sơ cá nhân', icon: CircleUserRound },
  settings: { title: 'Cài đặt', icon: Settings },
  language: { title: 'Ngôn ngữ', icon: Languages },
  help: { title: 'Trợ giúp', icon: CircleHelp },
  privacy: { title: 'Quyền riêng tư', icon: ShieldCheck },
};

const SLA_GUIDE = [
  'SLA tính theo giờ làm việc: thứ Hai đến thứ Sáu, 08:00–12:00 và 13:00–17:00, không tính ngày lễ trong lịch; tạm dừng khi chờ doanh nghiệp bổ sung.',
  'Mức cảnh báo trễ SLA: Bình thường (xác suất dưới 35%), Chú ý (từ 35%), Khẩn (từ 60%), Quá hạn (đã vượt SLA).',
  'Cảnh báo chỉ nói về nguy cơ trễ hạn xử lý, không phải đánh giá tín dụng và không thay quyết định của con người.',
];

const muted = { fontSize: 12, color: 'var(--text-secondary)' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ marginBottom: 14 }}>
    <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>{title}</h4>
    {children}
  </section>;
}

const List = ({ items }: { items: string[] }) => <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>{items.map(item => <li key={item}>{item}</li>)}</ul>;
const Row = ({ label, value }: { label: string; value?: string | null }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>{label}</span><strong style={{ textAlign: 'right' }}>{value || '—'}</strong></div>;

export function Profile() {
  const { user, activeRole } = useAuth();
  if (!user) return null;
  return <>
    <Row label="Họ tên" value={user.fullName} />
    <Row label="Tên đăng nhập" value={user.username} />
    <Row label="Email" value={user.email} />
    <Row label="Số điện thoại" value={user.phone} />
    <Row label="Chi nhánh" value={user.branchName} />
    <Row label="Vai trò" value={user.roles.map(role => ROLE_NAMES[role] ?? role).join(', ')} />
    <Row label="Đang làm việc với vai trò" value={activeRole ? ROLE_NAMES[activeRole] : null} />
    <p style={{ ...muted, margin: '10px 0 0' }}>Thông tin tài khoản do Quản trị viên quản lý. Cần thay đổi thì liên hệ Quản trị viên của chi nhánh; mật khẩu tự đổi ở mục "Đổi mật khẩu".</p>
  </>;
}

export function SettingsPanel() {
  const [scale, setScale] = useState(() => loadPreferences().fontScale);
  const choose = (value: number) => {
    setScale(value);
    const next = { fontScale: value };
    savePreferences(next);
    applyPreferences(next);
  };
  return <>
    <Section title="Cỡ chữ">
      <div role="radiogroup" aria-label="Cỡ chữ" style={{ display: 'grid', gap: 6 }}>
        {FONT_SCALES.map(item => <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="radio" name="font-scale" checked={scale === item.value} onChange={() => choose(item.value)} />
          {item.label}
        </label>)}
      </div>
    </Section>
    <p style={{ ...muted, margin: 0 }}>Lưu trên trình duyệt này, áp dụng ngay và không ảnh hưởng người dùng khác.</p>
  </>;
}

function LanguagePanel() {
  return <>
    <div role="radiogroup" aria-label="Ngôn ngữ" style={{ display: 'grid', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="radio" name="language" checked readOnly /> Tiếng Việt</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><input type="radio" name="language" disabled /> English (chưa có bản dịch)</label>
    </div>
    <p style={{ ...muted, margin: '10px 0 0' }}>Hệ thống hiện chỉ có giao diện Tiếng Việt. Ngày giờ hiển thị theo múi giờ Việt Nam (UTC+7).</p>
  </>;
}

export function Help() {
  const { activeRole } = useAuth();
  return <>
    {activeRole && <Section title={`Việc của ${ROLE_NAMES[activeRole]}`}><List items={ROLE_GUIDE[activeRole]} /></Section>}
    <Section title="SLA và cảnh báo trễ"><List items={SLA_GUIDE} /></Section>
    <Section title="Nút bị khóa?"><List items={['Hồ sơ đang chờ doanh nghiệp bổ sung, đã trình lên công đoạn sau, đã hoàn tất, hoặc không do bạn phụ trách thì thao tác sửa bị khóa.', 'Mục menu mờ nghĩa là vai trò của bạn không có quyền vào mục đó.']} /></Section>
    <p style={{ ...muted, margin: 0 }}>Cần hỗ trợ thêm: liên hệ Quản trị viên của chi nhánh.</p>
  </>;
}

export function Privacy() {
  return <>
    <Section title="Dữ liệu hệ thống lưu"><List items={['Thông tin tài khoản: họ tên, email, số điện thoại, chi nhánh, vai trò.', 'Dữ liệu nghiệp vụ: hồ sơ vay, chứng từ, lịch sử công đoạn, yêu cầu bổ sung, tờ trình, phân công và thông báo nội bộ.', 'Mật khẩu được lưu dưới dạng mã băm, không ai xem được nguyên văn.']} /></Section>
    <Section title="Ai xem được gì"><List items={['Mỗi vai trò chỉ thấy phần dữ liệu cần cho công việc của vai trò đó; CBTD chỉ thấy hồ sơ mình phụ trách.', 'Các thao tác trên hồ sơ được ghi lại cùng người thực hiện và thời điểm để đối soát.']} /></Section>
    <Section title="Mô hình dự báo"><List items={['Chỉ dùng dữ liệu hồ sơ và thời gian xử lý để dự báo nguy cơ trễ SLA.', 'Chạy trong chính hệ thống, không gửi dữ liệu ra dịch vụ bên ngoài, không quyết định tín dụng.']} /></Section>
    <p style={{ ...muted, margin: 0 }}>Bản này dùng dữ liệu mô phỏng để trình diễn.</p>
  </>;
}

export function AccountDialog({ kind, onClose }: { kind: AccountDialogKind; onClose: () => void }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  const { title, icon: Icon } = ACCOUNT_TITLES[kind];
  return <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: 520 }} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={18} aria-hidden="true" />
          <h3 id="account-dialog-title" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }} aria-label="Đóng"><X size={16} /></button>
      </div>
      <div className="modal-body">
        <LanguagePanel />
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-primary" onClick={onClose}>Đóng</button></div>
    </div>
  </div>;
}
