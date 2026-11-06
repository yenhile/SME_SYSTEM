import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronDown, FileText, Save, Send, ShieldCheck } from 'lucide-react';
import type { PortalChecklist, PortalData, PortalFormConfig, PortalRequest } from './model';
import type { WizardIssue } from './wizard';
import { capitalTotals } from './wizard';
import { reviewField, reviewNotices, reviewStatus } from './review';

const titles = ['Thông tin doanh nghiệp', 'Nhu cầu vay', 'Phương án vốn', 'Hồ sơ tài liệu'];
const money = (value?: number) => value === undefined ? 'Chưa khai' : `${value.toLocaleString('vi-VN')} VNĐ`;
const values: Record<string, string> = {
  MANUFACTURING: 'Sản xuất', TRADING: 'Thương mại', SERVICES: 'Dịch vụ', OTHER: 'Khác / cần tư vấn',
  LEGAL_REPRESENTATIVE: 'Người đại diện pháp luật', AUTHORIZED: 'Người được ủy quyền',
  CONTRACT_OR_ORDER: 'Hợp đồng hoặc đơn đặt dịch vụ', ACCEPTANCE_INVOICE: 'Nghiệm thu kèm hóa đơn',
  PROPOSED: 'Có tài sản bảo đảm', NONE_REQUESTED: 'Đề nghị không bảo đảm', UNDECIDED: 'Chưa xác định',
};
const fields = [
  ['companyName', 'taxCode', 'companyType', 'industry', 'businessScope', 'serviceProofMode', 'representative.mode', 'representative.name', 'establishedDate', 'establishedYear', 'address', 'representativeName', 'phone', 'contactName', 'contactPosition', 'contactPhone', 'contactEmail', 'annualRevenue', 'revenuePeriod', 'charterCapital'],
  ['loanType', 'loanPurpose', 'proposedAmount', 'loanTermMonths', 'neededAt', 'preferredBranch', 'collateral.mode', 'collateral.description', 'hasExistingDebt'],
  ['capitalPlan.businessActivity', 'capitalPlan.ownFunds', 'capitalPlan.otherFunds', 'capitalPlan.otherFundsSource', 'capitalPlan.useFrom', 'capitalPlan.useTo', 'capitalPlan.repaymentSource', 'capitalPlan.recoveryDate'],
];
function at(data: PortalData, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, data);
}

export function ChecklistOverview({ assessment }: { assessment: NonNullable<PortalChecklist['approvedIntakeAssessment']> }) {
  const missing = assessment.requirements.filter(item => item.state === 'MISSING');
  const provided = assessment.requirements.filter(item => item.state === 'PROVIDED_PENDING_REVIEW');
  const later = assessment.requirements.filter(item => item.state === 'LATER');
  const notApplicable = assessment.requirements.filter(item => item.state === 'NOT_APPLICABLE');
  return <div className="review-checklist">
    <p className="review-doc-note">Đã cung cấp chưa đồng nghĩa ngân hàng đã kiểm tra hợp lệ.</p>
    {missing.length > 0 && <div className="review-document-needs"><h4>Cần cung cấp khi gửi · {missing.length} mục</h4><ul>{missing.map(item => <li key={item.id}><strong>{item.label}</strong>{item.periods?.length ? <span> · {item.periods.join(', ')}</span> : null}<details><summary>Hướng dẫn tài liệu</summary><p>{item.guidance}</p></details></li>)}</ul></div>}
    {provided.length > 0 && <details className="review-doc-details"><summary><CheckCircle2 size={16} /> Đã cung cấp, chờ kiểm tra · {provided.length} mục</summary><ul>{provided.map(item => <li key={item.id}>{item.label}</li>)}</ul></details>}
    {later.length > 0 && <details className="review-doc-details"><summary>Cung cấp sau khi được yêu cầu · {later.length} mục</summary><p>Những mục này không phải tài liệu bắt buộc cung cấp ở lần gửi hiện tại.</p><ul>{later.map(item => <li key={item.id}>{item.label}</li>)}</ul></details>}
    {notApplicable.length > 0 && <details className="review-doc-details"><summary>Không áp dụng theo khai báo · {notApplicable.length} mục</summary><ul>{notApplicable.map(item => <li key={item.id}>{item.label}</li>)}</ul></details>}
  </div>;
}

interface Props {
  data: PortalData; request: PortalRequest | null; config: PortalFormConfig; checklist: PortalChecklist | null;
  issues: WizardIssue[]; busy: boolean; editable: boolean; conflict: boolean; dirty: boolean; pendingFiles: number;
  fresh: boolean; checkError: boolean; submitDisabled: boolean;
  readiness?: { dataReady: boolean; issues: Omit<WizardIssue, 'severity'>[] } | null;
  displayValue: (value: unknown) => string;
  onJump: (path: string, step: number) => void; onSave: () => void; onSubmit: () => void; onDeclaration: (accepted: boolean) => void;
}
export function PortalReview(props: Props) {
  const { data, request, config, checklist, issues, editable, busy, conflict, dirty, pendingFiles, fresh } = props;
  const notices = reviewNotices(checklist, [...issues, ...(props.readiness?.issues.map(item => ({ ...item, severity: 'error' as const })) ?? [])]);
  const errors = notices.filter(item => item.severity === 'error');
  const warnings = notices.filter(item => item.severity === 'warning');
  const assessment = checklist?.approvedIntakeAssessment;
  const status = reviewStatus({ editable, busy, conflict, dirty, pendingFiles, fresh, checkError: props.checkError,
    enabled: config.canSubmit, hasAssessment: !!checklist, submitDisabled: props.submitDisabled });
  const totals = capitalTotals(data);
  const costsComplete = !!data.capitalPlan?.costs?.length && data.capitalPlan.costs.every(cost => typeof cost.amount === 'number' && Number.isFinite(cost.amount));
  const jump = (path: string, step: number) => props.onJump(path.startsWith('document:') ? 'documents' : path, step);
  const show = (path: string) => {
    const value = at(data, path);
    if (['annualRevenue', 'charterCapital', 'proposedAmount', 'capitalPlan.ownFunds', 'capitalPlan.otherFunds'].includes(path)) return money(value as number | undefined);
    if (typeof value === 'string' && values[value]) return values[value];
    return props.displayValue(value);
  };
  return <section className="v2-review portal-review" aria-labelledby="review-heading">
    <header className="review-heading"><div><span className="portal-eyebrow">KIỂM TRA TRƯỚC KHI GỬI</span><h2 id="review-heading">Rà soát và gửi đề nghị</h2><p>Xem lại thông tin, hoàn thiện các mục còn thiếu và xác nhận cam kết của bạn.</p></div><span className="review-save-indicator">{dirty ? 'Có thay đổi chưa lưu' : 'Bản đã lưu'}</span></header>
    <div className={`review-status review-status-${status.tone}`} id="v2-review-summary" tabIndex={-1} role="status">
      {status.tone === 'ready' ? <CheckCircle2 size={23} /> : <AlertCircle size={23} />}
      <div><strong>{status.title}</strong><p>{status.message}</p>{errors.length > 0 && <div className="review-step-links" aria-label="Các bước có mục cần hoàn thiện">{[1, 2, 3, 4, 5].map(step => { const rows = errors.filter(item => item.step === step); return rows.length ? <button key={step} type="button" className="portal-link" disabled={busy || conflict} onClick={() => jump(rows[0].path, step)}>Bước {step} · {rows.length} mục <ArrowUpRight size={13} /></button> : null; })}</div>}</div>
    </div>
    {!config.intakeCycleEnabled && <p className="review-technical-note">{props.readiness?.dataReady ? 'Đã đủ dữ liệu cho kiểm tra kỹ thuật.' : 'Chưa có kết quả xác nhận đủ dữ liệu kỹ thuật.'} Đây chưa phải xác nhận tài liệu hợp lệ hoặc quyết định cho vay.</p>}
    <div className="review-layout">
      <div className="review-sections">
        {titles.map((title, index) => {
          const step = index + 1;
          const stepErrors = errors.filter(item => item.step === step);
          const badge = dirty || !fresh ? 'Cần kiểm tra bản mới' : stepErrors.length ? `${stepErrors.length} mục cần hoàn thiện` : !checklist ? 'Chưa có kết quả kiểm tra' : 'Xem lại thông tin';
          return <details className="review-section" key={step} open={stepErrors.length > 0 || step === 4}>
            <summary><span className="review-section-number">{step}</span><span className="review-section-title">{title}<small className={stepErrors.length ? 'review-needs-label' : ''}>{badge}</small></span><ChevronDown size={18} /></summary>
            <div className="review-section-body">
              {stepErrors.length > 0 && step !== 4 && <ul className="review-needs">{stepErrors.map(item => <li key={item.path}><button type="button" className="portal-link" disabled={busy || conflict || !editable} onClick={() => jump(item.path, step)}>{item.message}<ArrowUpRight size={14} /></button></li>)}</ul>}
              {step < 4 && <details className="review-full-answers"><summary>Xem toàn bộ thông tin đã khai</summary><dl className="review-answer-list">{fields[index].filter(path => path !== 'representative.name' || data.representative?.mode === 'AUTHORIZED').filter(path => path !== 'collateral.description' || data.collateral?.mode === 'PROPOSED').filter(path => path !== 'serviceProofMode' || data.businessScope === 'SERVICES').map(path => <div key={path}><dt>{reviewField(path).label}</dt><dd className={at(data, path) === undefined ? 'review-unanswered' : ''}>{show(path)}</dd></div>)}</dl></details>}
              {step === 3 && <div className="review-capital"><strong>Chi phí và nguồn vốn đã khai</strong>{data.capitalPlan?.costs?.length ? <ul>{data.capitalPlan.costs.map((cost, i) => <li key={i}><span>{cost.name || `Hạng mục ${i + 1}`}<small>Dự kiến chi: {cost.plannedAt || 'Chưa khai'}</small></span><strong>{money(cost.amount)}</strong></li>)}</ul> : <p>Chưa khai các hạng mục chi phí.</p>}<p>Tổng chi phí đã khai: <strong>{costsComplete ? money(totals.totalCosts) : 'Chưa khai đủ số tiền'}</strong></p><p>Vốn đề nghị ngân hàng: <strong>{money(data.proposedAmount)}</strong></p></div>}
              {step === 4 && <>
                {assessment ? <ChecklistOverview assessment={assessment} /> : <p>Chưa có kết quả kiểm tra danh mục. Xem lại tài liệu tại bước 4.</p>}
                <details className="review-doc-details"><summary>Nguồn doanh thu đã khai</summary><dl className="review-answer-list"><div><dt>Tài liệu nguồn doanh thu</dt><dd>{data.annualRevenueBasis?.documentId ? request?.documents.find(doc => doc.id === data.annualRevenueBasis?.documentId)?.fileName || 'Tài liệu đã chọn không có trong danh sách tệp hiện tại' : 'Chưa chọn'}</dd></div><div><dt>Xác nhận năm báo cáo hoàn thành</dt><dd>{props.displayValue(data.annualRevenueBasis?.fullYearCompleted)}</dd></div></dl></details>
                {stepErrors.filter(item => !assessment || !item.path.startsWith('document:')).length > 0 && <ul className="review-needs">{stepErrors.filter(item => !assessment || !item.path.startsWith('document:')).map(item => <li key={item.path}><button className="portal-link" type="button" disabled={!editable || busy || conflict} onClick={() => jump(item.path, 4)}>{item.message}<ArrowUpRight size={14} /></button></li>)}</ul>}
                <details className="review-doc-details"><summary><FileText size={16} /> Tệp đã lưu trên hệ thống · {request?.documents.length ?? 0} tệp</summary>{request?.documents.length ? <ul>{request.documents.map(doc => <li key={doc.id}>{doc.fileName}<small>Nhóm {doc.documentGroup} · Phiên bản {doc.version ?? 1}</small></li>)}</ul> : <p>Chưa có tài liệu được lưu trên hệ thống.</p>}</details>
              </>}
              <button type="button" className="btn btn-secondary review-edit" disabled={!editable || busy || conflict} onClick={() => jump(stepErrors[0]?.path ?? (step === 4 ? 'documents' : fields[index][0]), step)}>{step === 4 ? 'Xem và bổ sung tài liệu' : 'Xem và chỉnh sửa'}<ArrowUpRight size={15} /></button>
            </div>
          </details>;
        })}
        {warnings.length > 0 && <details className="review-advice"><summary><AlertCircle size={17} /> Gợi ý rà soát · {warnings.length} mục</summary><p>Đây là gợi ý để bạn xem lại nội dung, không tự bổ sung điều kiện bắt buộc mới.</p><ul>{warnings.map(item => <li key={item.path}><button type="button" className="portal-link" disabled={busy || conflict} onClick={() => jump(item.path, item.step)}>{item.message} · Bước {item.step}</button></li>)}</ul></details>}
      </div>
      <aside className="review-submit-card" aria-label="Tóm tắt và gửi đề nghị">
        <div className="review-submit-heading"><Send size={19} /><h3>Đề nghị của bạn</h3></div>
        <dl className="review-loan-facts"><div><dt>Số tiền đề nghị</dt><dd>{money(data.proposedAmount)}</dd></div><div><dt>Thời hạn dự kiến</dt><dd>{data.loanTermMonths === undefined ? 'Chưa khai' : `${data.loanTermMonths} tháng`}</dd></div><div><dt>Doanh nghiệp</dt><dd>{data.companyName || 'Chưa khai'}</dd></div></dl>
        {config.approvedIntakePolicy && <div className="review-declaration"><label htmlFor="v2-submissionDeclaration.accepted"><input id="v2-submissionDeclaration.accepted" type="checkbox" disabled={busy || !editable || conflict} checked={data.submissionDeclaration?.accepted === true} onChange={e => props.onDeclaration(e.target.checked)} /><span>{config.approvedIntakePolicy.policy.declaration.text}</span></label>{errors.filter(item => item.step === 5 && item.path.startsWith('submissionDeclaration.')).map(item => <p className="review-declaration-help" key={item.path}>Đọc và xác nhận nội dung cam kết đang áp dụng trước khi gửi.</p>)}</div>}
        {errors.filter(item => item.step === 5 && !item.path.startsWith('submissionDeclaration.')).map(item => <p className="review-declaration-help" key={item.path}>{item.message}</p>)}
        <div className="review-submit-actions"><button type="button" className="btn btn-secondary" disabled={busy || !editable || conflict} onClick={props.onSave}><Save size={17} /> Lưu nháp</button><button type="button" className="btn btn-primary" disabled={props.submitDisabled} onClick={props.onSubmit} aria-describedby="review-submit-help"><Send size={17} /> {config.intakeCycleEnabled ? request?.status === 'RETURNED' ? 'Gửi lại đề nghị' : 'Gửi đề nghị' : 'Gửi đề nghị thử nghiệm'}</button></div>
        <p id="review-submit-help" className="review-submit-help">{status.message}</p>
        <p className="review-privacy"><ShieldCheck size={17} /> Gửi đề nghị để ngân hàng kiểm tra, chưa phải quyết định phê duyệt khoản vay.</p>
        {!config.intakeCycleEnabled && config.canSubmit && <p className="review-test-notice">Môi trường thử nghiệm TEST_ONLY. Thao tác gửi không được mở trên hệ thống vận hành chính.</p>}
        {request?.submittedAt && request.status !== 'RETURNED' && <p className="portal-notice">Đề nghị đã gửi và khóa chỉnh sửa. Theo dõi kết quả tại danh sách đề nghị.</p>}
      </aside>
    </div>
  </section>;
}
