import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PortalReview } from '../../../frontend/src/portal/PortalReview';
import { BrandLogo } from '../../../frontend/src/components/BrandLogo';
import '../../../frontend/src/styles.css';
import '../../../frontend/src/theme.css';
import '../../../frontend/src/portal.css';
import '../../../frontend/src/portal/review.css';

// Isolated presentation fixture. No API client, authentication bypass or business writes.
const scenario = new URL(location.href).searchParams.get('scenario') || 'incomplete';
const requirement = (id: string, label: string, state: string) => ({ id, label, state, guidance: 'Tài liệu đúng doanh nghiệp và đọc được nội dung.', group: 'A', periods: [], documentTypeCode: id, step: 4, required: true, stage: 'SUBMIT', applies: true, due: true, satisfied: false });
const needs = scenario === 'incomplete';
const data = { companyName: 'CÔNG TY SME MINH HỌA', taxCode: '0000000000', proposedAmount: 2000000000, loanTermMonths: 12, loanType: 'VAY_VON_LUU_DONG', loanPurpose: 'Bổ sung vốn mua nguyên vật liệu phục vụ đơn hàng.', businessScope: needs ? undefined : 'MANUFACTURING', representative: { mode: needs ? undefined : 'LEGAL_REPRESENTATIVE' }, annualRevenue: 6500000000, revenuePeriod: '2025', collateral: { mode: 'PROPOSED', description: 'Tài sản minh họa' }, capitalPlan: { businessActivity: 'Sản xuất theo đơn hàng', costs: [{ name: 'Nguyên vật liệu', amount: 2500000000 }], ownFunds: 500000000, repaymentSource: 'Thu từ hoạt động kinh doanh' }, submissionDeclaration: { accepted: !needs, version: 'fixture-v1' } };
const config = { canSubmit: scenario !== 'closed', intakeCycleEnabled: scenario !== 'legacy', approvedIntakePolicy: { policy: { declaration: { version: 'fixture-v1', text: 'Tôi được doanh nghiệp cho phép cung cấp hồ sơ này và chịu trách nhiệm về thông tin đã khai.' } } } };
const checklist = { approvedIntakeAssessment: { dataReady: !needs, issues: needs ? [{ path: 'representative.mode', step: 1, message: 'Cần chọn tư cách người gửi.' }]: [], formErrors: needs ? ['Thiếu thông tin: businessScope', 'Thiếu thông tin: representative.mode', 'Thiếu thông tin điều kiện: representative.mode', 'Thiếu thông tin: annualRevenueBasis.documentId', 'Thiếu thông tin: submissionDeclaration.accepted', 'Thiếu thông tin: submissionDeclaration.version'] : [], requirements: [
  requirement('registration', 'Giấy đăng ký doanh nghiệp', needs ? 'MISSING' : 'PROVIDED_PENDING_REVIEW'),
  requirement('charter', 'Điều lệ doanh nghiệp', needs ? 'MISSING' : 'PROVIDED_PENDING_REVIEW'),
  requirement('financial', 'Báo cáo tài chính năm 2025', 'PROVIDED_PENDING_REVIEW'),
  requirement('cashflow', 'Bảng dòng tiền chi tiết', 'LATER'),
  requirement('authorization', 'Giấy ủy quyền người gửi', 'NOT_APPLICABLE'),
] } };
function Preview() {
  const [changed, setChanged] = useState(false);
  const [accepted, setAccepted] = useState(data.submissionDeclaration.accepted);
  const [action, setAction] = useState('');
  const dirty = changed || scenario === 'dirty';
  const disabled = needs || dirty || ['stale', 'error', 'readonly', 'closed', 'files', 'legacy'].includes(scenario);
  return <div className="portal-shell">
    <div style={{ padding: '8px 16px', background: '#fff7ed', color: '#92400e', fontSize: 12, textAlign: 'center' }}>KIỂM TRA GIAO DIỆN · DỮ LIỆU TỔNG HỢP · KHÔNG GỬI API</div>
    <header className="portal-header"><BrandLogo subtitle="Cổng doanh nghiệp" /><span style={{ fontSize: 13 }}>Xem trước: {scenario}</span></header>
    <main className="portal-main"><section className="portal-wizard">
      <div className="v2-heading"><div><span className="portal-eyebrow">HỒ SƠ DOANH NGHIỆP · PHIÊN BẢN 2</span><h1>DN-MINH-HOA-0001</h1></div><span className="portal-status">{scenario === 'readonly' ? 'Đã tiếp nhận' : 'Bản nháp'}</span></div>
      <nav className="v2-stepper" aria-label="Các bước khai báo"><ol>{['Thông tin doanh nghiệp', 'Nhu cầu vay', 'Phương án vốn', 'Hồ sơ tài liệu', 'Rà soát đề nghị'].map((title, i) => <li className={i === 4 ? 'active' : ''} key={title}><button type="button"><span>{i + 1}</span><strong>{title}</strong></button></li>)}</ol></nav>
      <fieldset className="portal-fieldset" disabled={scenario === 'readonly'}>
        <PortalReview {...({ data: { ...data, submissionDeclaration: { ...data.submissionDeclaration, accepted } }, request: { documents: [{ id: 'file1', fileName: 'Bao_cao_tai_chinh_minh_hoa_2025.pdf', documentGroup: 'B', version: 1 }], status: scenario === 'readonly' ? 'ACCEPTED' : 'DRAFT' }, config, checklist: scenario === 'error' ? null : checklist, issues: [], busy: false, editable: scenario !== 'readonly', conflict: false, dirty, pendingFiles: scenario === 'files' ? 2 : 0, fresh: scenario !== 'stale', checkError: scenario === 'error', submitDisabled: disabled, readiness: scenario === 'legacy' ? { dataReady: false, issues: [{ path: 'annualRevenueBasis', step: 4, message: 'Cần cung cấp annualRevenueBasis.' }] } : undefined,
          displayValue: (v: unknown) => v === undefined || v === '' ? 'Chưa khai' : typeof v === 'boolean' ? v ? 'Có' : 'Không' : v === 'VAY_VON_LUU_DONG' ? 'Vay vốn lưu động' : String(v),
          onJump: (path: string, step: number) => setAction(`jump:${step}:${path}`), onSave: () => setAction('save-local-only'), onSubmit: () => setAction('submit-local-only'), onDeclaration: (next: boolean) => { setAccepted(next); setChanged(true); }
        } as any)} />
      </fieldset>
      <output id="fixture-action" style={{ display: 'block', marginTop: 16 }}>Thao tác minh họa: {action}</output>
    </section></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
