import { ArrowRight, Briefcase, Building2, ClipboardCheck, FileText, LogIn, Phone, Search } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { groups } from '../portal/model';
import './bank-home.css';

export const PORTAL_PATH = '/portal';
export const STAFF_LOGIN_HREF = '/?dang-nhap=1';

/** Trang chủ công khai của ngân hàng: mục Doanh nghiệp dẫn sang cổng doanh nghiệp; cán bộ vào hệ thống nội bộ bằng nút Đăng nhập. */
export function BankHome() {
  return <div className="bank-home">
    <div className="bank-topbar" role="navigation" aria-label="Liên kết nhanh">
      <a href="#doanh-nghiep">Doanh nghiệp</a><a href="#ho-so-can-chuan-bi">Hồ sơ cần chuẩn bị</a><a href="#ho-tro">Hỗ trợ</a>
    </div>
    <header className="bank-header">
      <a href="/" aria-label="Trang chủ"><BrandLogo subtitle="Ngân hàng" /></a>
      <a className="bank-login" href={STAFF_LOGIN_HREF}><LogIn size={18} aria-hidden="true" /> Đăng nhập</a>
    </header>
    <section className="bank-hero" aria-label="Giới thiệu">
      <div className="bank-hero-copy">
        <h1>SME hân hạnh phục vụ!</h1>
        <p>Quý khách đang tìm kiếm?</p>
        <a className="bank-search" href={PORTAL_PATH}><Search size={20} aria-hidden="true" /> Vay vốn lưu động cho doanh nghiệp…</a>
      </div>
      <nav className="bank-tiles" aria-label="Nhóm khách hàng">
        <a className="bank-tile active" href="#doanh-nghiep"><Briefcase size={34} aria-hidden="true" /><span>Doanh nghiệp</span></a>
        <a className="bank-tile" href="#ho-so-can-chuan-bi"><ClipboardCheck size={34} aria-hidden="true" /><span>Hồ sơ cần chuẩn bị</span></a>
        <a className="bank-tile" href="#ho-tro"><Phone size={34} aria-hidden="true" /><span>Hỗ trợ</span></a>
      </nav>
    </section>
    <main>
      <section id="doanh-nghiep" className="bank-section" aria-labelledby="bank-dn-title">
        <h2 id="bank-dn-title">Doanh nghiệp</h2>
        <p className="bank-lead">Giải pháp vốn lưu động cho doanh nghiệp nhỏ và vừa, nộp hồ sơ trực tuyến và theo dõi kết quả ngay trên cổng.</p>
        <div className="bank-cards">
          <a className="bank-card primary" href={PORTAL_PATH}>
            <Building2 size={28} aria-hidden="true" /><strong>Vay vốn doanh nghiệp</strong>
            <span>Vay vốn lưu động sản xuất, thương mại, dịch vụ. Hạn mức tối đa 10 tỷ đồng mỗi đề nghị.</span>
            <em>Đến cổng doanh nghiệp <ArrowRight size={16} aria-hidden="true" /></em>
          </a>
          <a className="bank-card" href={PORTAL_PATH}>
            <FileText size={28} aria-hidden="true" /><strong>Theo dõi hồ sơ vay</strong>
            <span>Đăng nhập cổng để xem tiến độ, bổ sung chứng từ và nhận kết quả cuối cùng.</span>
            <em>Đăng nhập cổng <ArrowRight size={16} aria-hidden="true" /></em>
          </a>
        </div>
      </section>
      <section id="ho-so-can-chuan-bi" className="bank-section alt" aria-labelledby="bank-doc-title">
        <h2 id="bank-doc-title">Hồ sơ cần chuẩn bị</h2>
        <p className="bank-lead">Hồ sơ gồm 6 nhóm tài liệu. Chuẩn bị đủ trước khi gửi để ngân hàng tiếp nhận nhanh hơn.</p>
        <ul className="bank-docs">{groups.map(group => <li key={group.code}><strong>{group.code}. {group.name}</strong><span>{group.description}</span></li>)}</ul>
        <a className="bank-cta" href={PORTAL_PATH}>Bắt đầu đề nghị vay <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
      <section id="ho-tro" className="bank-section" aria-labelledby="bank-help-title">
        <h2 id="bank-help-title">Hỗ trợ</h2>
        <p className="bank-lead">Cần hỗ trợ khi nộp hồ sơ? Liên hệ chi nhánh gần nhất hoặc cán bộ tín dụng đã được phân công cho hồ sơ của bạn. Thông tin liên hệ cụ thể do chi nhánh cung cấp.</p>
      </section>
    </main>
    <footer className="bank-footer">SME Loan • Tiếp nhận đề nghị vay doanh nghiệp • Cán bộ ngân hàng vui lòng dùng nút Đăng nhập ở đầu trang.</footer>
  </div>;
}
