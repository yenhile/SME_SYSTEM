import { ArrowRight, Briefcase, Building2, Crown, FileText, Landmark, Leaf, LogIn, ShieldCheck, TrendingUp, User } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { groups } from './model';
import './portal-landing.css';

/** Neo mở form đăng nhập/đăng ký của cổng; mọi nút vay vốn trên trang giới thiệu dẫn tới đây. */
export const ENTER_HASH = '#dang-nhap';

/** Các ô tượng trưng như trang chủ ngân hàng thật; chỉ "Doanh nghiệp" hoạt động vì hệ thống này phục vụ vay vốn doanh nghiệp. */
const TILES = [
  { label: 'Cá nhân', icon: User },
  { label: 'Doanh nghiệp', icon: Briefcase, href: '#doanh-nghiep' },
  { label: 'Khách hàng Ưu tiên', icon: Crown },
  { label: 'Định chế tài chính', icon: Landmark },
  { label: 'Phát triển bền vững', icon: Leaf },
  { label: 'Về chúng tôi', icon: ShieldCheck },
];

/** Lớp giới thiệu đặt trước cổng doanh nghiệp: quảng bá vay vốn rồi mới vào đăng nhập/đăng ký. Không chứa lối vào của cán bộ ngân hàng. */
export function PortalLanding({ onEnter }: { onEnter: () => void }) {
  const enter = (event: { preventDefault: () => void }) => { event.preventDefault(); onEnter(); };
  return <div className="bank-home">
    <div className="bank-topbar" role="navigation" aria-label="Liên kết nhanh">
      <a href={ENTER_HASH} onClick={enter}>Vay vốn doanh nghiệp</a><a href="#ho-so-can-chuan-bi">Hồ sơ cần chuẩn bị</a><a href="#ho-tro">Hỗ trợ</a>
    </div>
    <div className="bank-stage">
      <header className="bank-header">
        <a href="/portal" aria-label="Trang chủ"><BrandLogo subtitle="Ngân hàng" /></a>
        <a className="bank-login" href={ENTER_HASH} onClick={enter}><LogIn size={18} aria-hidden="true" /> Đăng nhập doanh nghiệp</a>
      </header>
      <section className="bank-hero-copy" aria-label="Vay vốn doanh nghiệp">
        <span className="bank-promo-tag">Dành cho doanh nghiệp nhỏ và vừa</span>
        <h1>Vay vốn lưu động doanh nghiệp, nộp hồ sơ trực tuyến</h1>
        <p>Hạn mức đến 10 tỷ đồng. Gửi hồ sơ, bổ sung chứng từ và nhận kết quả ngay trên cổng doanh nghiệp.</p>
        <div className="bank-promo-actions">
          <a className="bank-promo-cta" href={ENTER_HASH} onClick={enter}>Đăng ký vay vốn ngay <ArrowRight size={18} aria-hidden="true" /></a>
          <a className="bank-promo-link" href={ENTER_HASH} onClick={enter}>Đã có hồ sơ? Đăng nhập cổng doanh nghiệp</a>
        </div>
        <ul className="bank-promo-points"><li>Nộp hồ sơ 24/7, không cần đến quầy</li><li>Theo dõi tiến độ từng bước</li><li>Nhận kết quả phê duyệt trực tiếp trên cổng</li></ul>
      </section>
      <nav className="bank-tiles" aria-label="Nhóm khách hàng">
        {TILES.map(({ label, icon: Icon, href }) => href
          ? <a key={label} className="bank-tile active" href={href}><Icon size={32} aria-hidden="true" /><span>{label}</span></a>
          : <div key={label} className="bank-tile idle" title="Chưa mở trong hệ thống này"><Icon size={32} aria-hidden="true" /><span>{label}</span></div>)}
      </nav>
    </div>
    <main>
      <section id="doanh-nghiep" className="bank-section" aria-labelledby="bank-dn-title">
        <h2 id="bank-dn-title">Doanh nghiệp</h2>
        <p className="bank-lead">Giải pháp vốn lưu động cho doanh nghiệp nhỏ và vừa, nộp hồ sơ trực tuyến và theo dõi kết quả ngay trên cổng.</p>
        <div className="bank-cards">
          <a className="bank-card primary" href={ENTER_HASH} onClick={enter}>
            <Building2 size={28} aria-hidden="true" /><strong>Vay vốn doanh nghiệp</strong>
            <span>Vay vốn lưu động sản xuất, thương mại, dịch vụ. Hạn mức tối đa 10 tỷ đồng mỗi đề nghị.</span>
            <em>Đến cổng doanh nghiệp <ArrowRight size={16} aria-hidden="true" /></em>
          </a>
          <a className="bank-card" href={ENTER_HASH} onClick={enter}>
            <FileText size={28} aria-hidden="true" /><strong>Theo dõi hồ sơ vay</strong>
            <span>Đăng nhập cổng để xem tiến độ, bổ sung chứng từ và nhận kết quả cuối cùng.</span>
            <em>Đăng nhập cổng <ArrowRight size={16} aria-hidden="true" /></em>
          </a>
          <div className="bank-card idle"><TrendingUp size={28} aria-hidden="true" /><strong>Giải pháp khác</strong><span>Các sản phẩm dành cho doanh nghiệp khác sẽ được cập nhật sau.</span></div>
        </div>
      </section>
      <section id="ho-so-can-chuan-bi" className="bank-section alt" aria-labelledby="bank-doc-title">
        <div className="bank-section-inner">
          <h2 id="bank-doc-title">Hồ sơ cần chuẩn bị</h2>
          <p className="bank-lead">Hồ sơ gồm 6 nhóm tài liệu. Chuẩn bị đủ trước khi gửi để ngân hàng tiếp nhận nhanh hơn.</p>
          <ul className="bank-docs">{groups.map(group => <li key={group.code}><strong>{group.code}. {group.name}</strong><span>{group.description}</span></li>)}</ul>
          <a className="bank-cta" href={ENTER_HASH} onClick={enter}>Bắt đầu đề nghị vay <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </section>
      <section id="ho-tro" className="bank-section" aria-labelledby="bank-help-title">
        <h2 id="bank-help-title">Hỗ trợ</h2>
        <p className="bank-lead">Cần hỗ trợ khi nộp hồ sơ? Liên hệ chi nhánh gần nhất hoặc cán bộ tín dụng được phân công cho hồ sơ của bạn. Thông tin liên hệ cụ thể do chi nhánh cung cấp.</p>
      </section>
    </main>
    <footer className="bank-footer">SME Loan • Tiếp nhận đề nghị vay doanh nghiệp</footer>
  </div>;
}
