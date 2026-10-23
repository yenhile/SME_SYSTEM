import type { ReactNode } from 'react';
import { api } from '../api/client';
import { RequestFields } from '../portal/PortalApp';
import { DocumentLink } from '../portal/DocumentLink';
import { capitalTotals } from '../portal/wizard';
import { groups, loanTypes, type PortalData, type PortalDocument, type PortalFormConfig, type PortalRequest } from '../portal/model';

type Requirement = { id: string; group: string; documentTypeCode: string; required: boolean; applies: boolean; stage: string; periods?: string[]; deferred?: boolean; basis?: string; alternatives?: string[]; nonApplicabilityBasis?: string; deferralBasis?: string; due?: boolean; satisfied?: boolean; condition?: { field: string; equals: string | boolean } };
type Snapshot = { snapshotVersion: 2; requestId: string; formVersion: 2; checklistVersion: string; revision: number; submittedAt: string; data: PortalData; documents: PortalDocument[]; policy: Record<string, unknown>; checklist: Requirement[] };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// This is a presentation shape check. The server verifies snapshot integrity on acceptance.
function snapshotFor(request: PortalRequest): Snapshot | null {
  const s = request.checklistSnapshot;
  if (!s || s.snapshotVersion !== 2 || s.formVersion !== 2 || s.requestId !== request.id || typeof s.checklistVersion !== 'string' || !Number.isSafeInteger(s.revision) || typeof s.submittedAt !== 'string' || !record(s.data) || !record(s.policy) || !Array.isArray(s.documents) || !Array.isArray(s.checklist)) return null;
  if (!s.documents.every(doc => record(doc) && typeof doc.id === 'string' && typeof doc.fileName === 'string' && typeof doc.documentGroup === 'string' && (doc.coverage == null || (Array.isArray(doc.coverage) && doc.coverage.every(item => record(item) && typeof item.documentTypeCode === 'string'))))) return null;
  if (!s.checklist.every(item => record(item) && typeof item.id === 'string' && typeof item.group === 'string' && typeof item.documentTypeCode === 'string' && typeof item.required === 'boolean' && typeof item.applies === 'boolean' && typeof item.stage === 'string' && (item.periods === undefined || (Array.isArray(item.periods) && item.periods.every(period => typeof period === 'string'))) && (item.alternatives === undefined || (Array.isArray(item.alternatives) && item.alternatives.every(code => typeof code === 'string'))))) return null;
  return s as unknown as Snapshot;
}

export function intakeMoney(value: unknown): string { return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('vi-VN')} VNĐ` : '—'; }
export function intakeData(request: PortalRequest): PortalData { return (request.formVersion === 2 ? snapshotFor(request)?.data : null) ?? request.data; }
export function canAcceptIntake(request: Pick<PortalRequest, 'formVersion'>, config: Pick<PortalFormConfig, 'canAccept'> | null): boolean { return request.formVersion !== 2 || config?.canAccept === true; }
export function mvpFinancialConfirmationRequired(request:PortalRequest):boolean{return request.formVersion===2&&snapshotFor(request)?.policy.readinessVersion==='MVP1';}
const text = (value: unknown): string => typeof value === 'string' && value.trim() ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
function Facts({ rows }: { rows: [string, ReactNode][] }) { return <dl className="intake-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }

export function PortalIntakeDetails({ request, config, busy = false }: { request: PortalRequest; config: PortalFormConfig | null; busy?: boolean }) {
  const snapshot = request.formVersion === 2 ? snapshotFor(request) : null;
  const data = snapshot?.data ?? request.data;
  const documents = snapshot?.documents ?? request.documents;
  const catalog = config?.groups ?? groups.map(group => ({ ...group, documentTypes: [] }));
  const typeName = (code: string) => catalog.flatMap(group => group.documentTypes).find(type => type.code === code)?.name ?? code;
  const documentGroups = [...catalog, ...Array.from(new Set(documents.map(doc => doc.documentGroup))).filter(code => !catalog.some(group => group.code === code)).map(code => ({ code, name: code, documentTypes: [] }))];
  const plan = data.capitalPlan;
  const totals = capitalTotals(data);
  return <div className="intake-details">
    {request.formVersion !== 2 ? <><RequestFields data={request.data} readOnly /><div className="portal-doc-grid" style={{ marginTop: 26 }}>{groups.map(group => <div key={group.code}><h3>{group.code}. {group.name}</h3><ul className="portal-file-list">{request.documents.filter(doc => doc.documentGroup === group.code).map(doc => <li key={doc.id}><DocumentLink fileName={doc.fileName} disabled={busy} load={() => api.download(`/portal-intakes/${request.id}/documents/${doc.id}/download`)} /></li>)}</ul></div>)}</div></> : <>
      <p className="portal-notice">Thông tin doanh nghiệp tự khai và metadata tài liệu, chưa thay thế việc kiểm tra pháp lý, tài chính hoặc thẩm định của CBTD.</p>
      {snapshot ? <Facts rows={[
        ['Nguồn dữ liệu', 'Snapshot đã gửi'], ['Phiên bản biểu mẫu', text(snapshot.formVersion)], ['Phiên bản checklist', text(snapshot.checklistVersion)], ['Bản sửa đã gửi', text(snapshot.revision)], ['Thời điểm gửi', text(snapshot.submittedAt)], ['Trạng thái chính sách snapshot', text(snapshot.policy.status)],
      ]} /> : <p role="alert" className="portal-error">Chưa có snapshot V2 hợp lệ để hiển thị. Dưới đây là dữ liệu hiện hành; máy chủ sẽ kiểm tra toàn vẹn khi tiếp nhận.</p>}
      <section><h3>Thông tin doanh nghiệp và liên hệ</h3><Facts rows={[
        ['Tên doanh nghiệp', text(data.companyName)], ['Mã số thuế', text(data.taxCode)], ['Loại hình doanh nghiệp', text(data.companyType)], ['Ngành nghề', text(data.industry)], ['Ngày thành lập', text(data.establishedDate)], ['Năm thành lập', text(data.establishedYear)], ['Địa chỉ', text(data.address)], ['Người đại diện', text(data.representativeName)], ['Điện thoại doanh nghiệp', text(data.phone)], ['Người liên hệ', text(data.contactName)], ['Chức vụ liên hệ', text(data.contactPosition)], ['Điện thoại liên hệ', text(data.contactPhone)], ['Email liên hệ', text(data.contactEmail)], ['Doanh thu (VNĐ)', intakeMoney(data.annualRevenue)], ['Kỳ doanh thu', text(data.revenuePeriod)], ['Nguồn doanh thu năm', documents.find(doc=>doc.id===data.annualRevenueBasis?.documentId)?.fileName??'Chưa khai báo'], ['Kỳ năm đã hoàn thành (doanh nghiệp khai)', data.annualRevenueBasis?.fullYearCompleted===undefined?'Chưa khai báo':data.annualRevenueBasis.fullYearCompleted?'Có':'Chưa hoàn thành'], ['Vốn điều lệ', intakeMoney(data.charterCapital)],
      ]} /></section>
      <section><h3>Nhu cầu vay vốn</h3><Facts rows={[
        ['Loại vay', data.loanType ? loanTypes[data.loanType] ?? data.loanType : '—'], ['Mục đích vay', text(data.loanPurpose)], ['Số tiền đề nghị', intakeMoney(data.proposedAmount)], ['Thời hạn vay (tháng)', text(data.loanTermMonths)], ['Thời điểm cần vốn', text(data.neededAt)], ['Đơn vị mong muốn tiếp nhận', text(data.preferredBranch)], ['Hình thức bảo đảm dự kiến', data.collateral?.mode ? ({ PROPOSED: 'Có tài sản bảo đảm', NONE_REQUESTED: 'Đề nghị không bảo đảm', UNDECIDED: 'Chưa xác định' }[data.collateral.mode] ?? text(data.collateral.mode)) : '—'], ['Mô tả tài sản dự kiến', text(data.collateral?.description)], ['Dư nợ tự khai', data.hasExistingDebt === undefined ? '—' : data.hasExistingDebt ? 'Có dư nợ' : 'Không có dư nợ'],
      ]} /></section>
      <section><h3>Phương án sử dụng vốn</h3><Facts rows={[
        ['Tổng nhu cầu vốn', plan?.costs?.length ? intakeMoney(totals.totalCosts) : '—'], ['Tổng nguồn vốn', typeof data.proposedAmount==='number' ? intakeMoney(totals.totalSources) : '—'], ['Ngân hàng được đề nghị tài trợ', intakeMoney(data.proposedAmount)], ['Hoạt động cần tài trợ', text(plan?.businessActivity)], ['Vốn tự có', intakeMoney(plan?.ownFunds)], ['Nguồn vốn khác', intakeMoney(plan?.otherFunds)], ['Mô tả nguồn vốn khác', text(plan?.otherFundsSource)], ['Bắt đầu sử dụng vốn', text(plan?.useFrom)], ['Kết thúc sử dụng vốn', text(plan?.useTo)], ['Nguồn trả nợ dự kiến', text(plan?.repaymentSource)], ['Ngày thu hồi vốn dự kiến', text(plan?.recoveryDate)],
      ]} /><div className="data-table-container"><table className="data-table"><caption>Hạng mục chi phí tự khai</caption><thead><tr><th>Hạng mục</th><th>Số tiền</th><th>Dự kiến chi</th></tr></thead><tbody>{plan?.costs?.map((cost, i) => <tr key={i}><td>{text(cost.name)}</td><td>{intakeMoney(cost.amount)}</td><td>{text(cost.plannedAt)}</td></tr>)}{!plan?.costs?.length && <tr><td colSpan={3}>Chưa khai hạng mục chi phí.</td></tr>}</tbody></table></div></section>
      <section><h3>Tài liệu và phạm vi chứng minh</h3><p>Loại tài liệu và kỳ do doanh nghiệp khai báo; phiên bản, hàm băm và dấu thời gian là metadata kỹ thuật.</p><div className="portal-doc-grid">{documentGroups.map(group => <section key={group.code}><h4>{group.code}. {group.name}</h4><ul className="portal-file-list">{documents.filter(doc => doc.documentGroup === group.code).map(doc => <li key={doc.id}><DocumentLink fileName={doc.fileName} disabled={busy} load={() => api.download(`/portal-intakes/${request.id}/documents/${doc.id}/download`)} /><Facts rows={[
        ['Phiên bản file', text(doc.version)], ['Phạm vi khai báo', doc.coverage?.length ? doc.coverage.map((coverage, i) => <span className="intake-coverage" key={i}>{typeName(coverage.documentTypeCode)} · Kỳ: {text(coverage.period)}</span>) : 'Chưa khai báo'], ['Dung lượng (byte)', text(doc.fileSize)], ['Ngày tải lên', text(doc.uploadedAt)], ['MIME', text(doc.mimeType)], ['SHA-256', text(doc.sha256 ?? doc.contentHash)], ['Thay thế file', text(doc.supersedesId)], ['Ngày thu hồi', text(doc.withdrawnAt)],
      ]} /></li>)}</ul>{!documents.some(doc => doc.documentGroup === group.code) && <p>Chưa cung cấp tài liệu.</p>}</section>)}</div></section>
      <section><h3>Checklist tại thời điểm gửi</h3><p>Các cờ áp dụng, bắt buộc và hoãn là kết quả quy tắc lưu trong snapshot; không phải xác nhận CBTD đã kiểm tra nội dung.</p>{snapshot?.checklist.length ? <ul className="intake-checklist">{snapshot.checklist.map((item, i) => <li key={`${item.id}:${i}`}><h4>{typeName(item.documentTypeCode)}</h4><Facts rows={[
        ['Mã yêu cầu', text(item.id)], ['Nhóm', text(catalog.find(group => group.code === item.group)?.name ?? item.group)], ['Áp dụng', item.applies ? 'Áp dụng' : 'Không áp dụng'], ['Điều kiện quy tắc', item.condition ? `${text(item.condition.field)} = ${typeof item.condition.equals === 'boolean' ? item.condition.equals ? 'Có' : 'Không' : text(item.condition.equals)}` : 'Không có điều kiện'], ['Mức yêu cầu', item.required ? 'Bắt buộc' : 'Không bắt buộc'], ['Giai đoạn', text(({ SUBMIT: 'Khi gửi', INTAKE: 'Khi tiếp nhận', LATER: 'Giai đoạn sau' } as Record<string, string>)[item.stage] ?? item.stage)], ['Kỳ yêu cầu', item.periods?.map(text).join(', ') || '—'], ['Hoãn cung cấp', item.deferred ? 'Hoãn cung cấp' : 'Không hoãn'], ['Đến hạn ở pha đánh giá', item.due === undefined ? '—' : item.due ? 'Có' : 'Không'], ['Phủ tài liệu theo quy tắc', item.satisfied === undefined ? '—' : item.satisfied ? 'Đủ theo khai báo' : 'Chưa đủ theo khai báo'], ['Căn cứ', text(item.basis)], ['Căn cứ không áp dụng', text(item.nonApplicabilityBasis)], ['Căn cứ hoãn', text(item.deferralBasis)], ['Tài liệu thay thế được quy định', item.alternatives?.map(typeName).join(', ') || '—'],
      ]} /></li>)}</ul> : <p>Chưa có checklist snapshot để hiển thị.</p>}</section>
    </>}
  </div>;
}
