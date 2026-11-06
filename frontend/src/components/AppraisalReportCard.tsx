import { useState } from 'react';
import { changedReportSections, clarificationAnswered, debtToEquityText, evidenceState, moneyText, REPORT_CONDITIONS_LABEL, REPORT_PROPOSAL_LABEL, REPORT_SECTIONS, type AppraisalReportView } from '../appraisalWorkspace';
import type { LoanApplication } from '../types';

const REPORT_STATUS: Record<string, string> = { SUBMITTED: 'Chờ quyết định', CLARIFICATION_REQUIRED: 'CBTD đang làm rõ', DECIDED: 'Đã có quyết định', DRAFT: 'Đang lập' };
const NOT_FILLED = 'Không ghi thêm';

const dateText = (value?: string) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

export function AppraisalReportCard({ loan, report, finished }: { loan: LoanApplication; report: AppraisalReportView | null; finished: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const versions = report?.versions ?? [];
  const shown = versions.find(version => version.id === selected) ?? versions[0];
  const decided = versions.find(version => version.id === report?.decidedVersionId);
  const emptyHint = loan.businessPolicyVersion ? 'Chưa có tờ trình' : 'Hồ sơ theo quy trình cũ, không có tờ trình';

  const changed = shown ? changedReportSections(versions, shown) : new Set<string>();
  const answered = shown ? clarificationAnswered(report?.events, versions, shown) : null;
  const evidence = report && shown ? evidenceState(report, shown, finished) : null;
  const isOlder = Boolean(shown) && shown !== versions[0];

  return <section className="card aw-card" aria-label="Tờ trình tín dụng">
    <div className="aw-card-heading">
      <div>
        <h2 className="aw-card-title">Tờ trình tín dụng</h2>
        <p className="aw-hint">{shown ? `Phiên bản ${shown.sequence} · ${shown.submittedByName || 'CBTD'} trình lúc ${dateText(shown.submittedAt)}` : emptyHint}</p>
      </div>
      {versions.length > 1 && <label className="aw-version-select">Phiên bản
        <select value={shown?.id ?? ''} onChange={event => setSelected(event.target.value)}>
          {versions.map((version, index) => <option key={version.id} value={version.id}>Phiên bản {version.sequence}{index === 0 ? ' (mới nhất)' : ''}</option>)}
        </select>
      </label>}
    </div>

    {report && shown && <div className="aw-report-tags">
      <span className="aw-tag aw-tag-amber">{REPORT_STATUS[report.status] ?? report.status}</span>
      {evidence === 'UNCHANGED' && <span className="aw-tag aw-tag-green">Căn cứ không đổi từ lúc trình</span>}
      {evidence === 'CHANGED' && <span className="aw-tag aw-tag-red">Căn cứ đã đổi từ lúc trình</span>}
    </div>}
    {isOlder && <p className="aw-alert aw-alert-warning">Đang xem phiên bản cũ. Quyết định luôn áp dụng cho phiên bản mới nhất.</p>}
    {report?.status === 'CLARIFICATION_REQUIRED' && report.clarification && <p className="aw-alert aw-alert-warning"><strong>Yêu cầu làm rõ: </strong>{report.clarification.message}</p>}
    {decided && <p className="aw-hint">Quyết định trên phiên bản {decided.sequence}.</p>}
    {answered && <p className="aw-report-answered"><strong>Phiên bản này trả lời yêu cầu làm rõ: </strong>{answered}</p>}

    {!shown && loan.businessPolicyVersion && <p className="aw-table-empty">CBTD chưa trình tờ trình cho hồ sơ này.</p>}

    {shown && <>
      <div className="aw-proposal">
        <div className="aw-proposal-heading">
          <h3>{REPORT_PROPOSAL_LABEL}</h3>
          {changed.has('recommendation') && <span className="aw-tag aw-tag-blue">Đã sửa so với phiên bản trước</span>}
        </div>
        <p className="aw-report-text">{shown.content.recommendation?.trim() || NOT_FILLED}</p>
        <dl className="aw-proposal-figures">
          <div><dt>Số tiền đề xuất</dt><dd>{moneyText(loan.proposedAmount)}</dd></div>
          <div><dt>Hạn mức chính thức</dt><dd>{moneyText(loan.officialAmount)}</dd></div>
          <div><dt>Thời hạn</dt><dd>{loan.loanTermMonths} tháng</dd></div>
          <div><dt>Đề xuất / vốn điều lệ</dt><dd>{debtToEquityText(loan)}</dd></div>
        </dl>
        <div className="aw-proposal-conditions">
          <div className="aw-proposal-heading">
            <h3>{REPORT_CONDITIONS_LABEL}</h3>
            {changed.has('proposedConditions') && <span className="aw-tag aw-tag-blue">Đã sửa so với phiên bản trước</span>}
          </div>
          <p className="aw-report-text">{shown.content.proposedConditions?.trim() || 'Không có điều kiện đề xuất'}</p>
        </div>
      </div>

      <div className="aw-report">
        {REPORT_SECTIONS.map(([key, label], index) => <section key={key} aria-label={label}>
          <div className="aw-proposal-heading">
            <h3>{index + 1}. {label}</h3>
            {changed.has(key) && <span className="aw-tag aw-tag-blue">Đã sửa so với phiên bản trước</span>}
          </div>
          <p className="aw-report-text">{shown.content[key]?.trim() || NOT_FILLED}</p>
        </section>)}
      </div>
    </>}
  </section>;
}
