import { ArrowLeft } from 'lucide-react';
import { ACCOUNT_TITLES, Help, Privacy, Profile, SettingsPanel, type AccountPageKind } from './AccountDialogs';

const SUBTITLES: Record<AccountPageKind, string> = {
  profile: 'Thông tin tài khoản đang đăng nhập',
  settings: 'Tùy chọn hiển thị trên trình duyệt này',
  help: 'Hướng dẫn theo vai trò đang làm việc',
  privacy: 'Dữ liệu được lưu và phạm vi sử dụng',
};

/** Trang riêng cho các mục trong menu tài khoản: nút quay lại ở góc trái, tiêu đề và nội dung căn giữa. */
export function AccountPage({ kind, onBack }: { kind: AccountPageKind; onBack: () => void }) {
  const { title, icon: Icon } = ACCOUNT_TITLES[kind];
  return <div className="account-page" style={{ maxWidth: 760, margin: '0 auto' }}>
    <div style={{ marginBottom: 12 }}>
      <button type="button" className="btn btn-secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Quay lại</button>
    </div>
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <h2><Icon size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{title}</h2>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{SUBTITLES[kind]}</p>
    </div>
    <section className="card" aria-label={title}>
      {kind === 'profile' && <Profile />}
      {kind === 'settings' && <SettingsPanel />}
      {kind === 'help' && <Help />}
      {kind === 'privacy' && <Privacy />}
    </section>
  </div>;
}
