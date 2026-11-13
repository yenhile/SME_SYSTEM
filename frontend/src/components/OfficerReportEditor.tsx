import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { bandText, NO_BAND_ERROR, normalizeRateText, parseRateText, RATE_ERROR, rateInBand, REPORT_FORM_FIELDS, REPORT_CONDITIONS_LABEL, REPORT_RATE_KEY, type AppraisalReportView } from '../appraisalWorkspace';
import { draftChanged, submitBlockReason } from '../officerCase';
import type { LoanApplication } from '../types';

const REQUIRED_FIELDS = REPORT_FORM_FIELDS.filter(([key]) => key !== 'proposedConditions');
const STATUS_TEXT: Record<string, string> = { DRAFT: 'Đang lập', CLARIFICATION_REQUIRED: 'Cần làm rõ và trình lại' };

interface OfficerReportEditorProps {
  loan: LoanApplication;
  report: AppraisalReportView | null;
  busy: boolean;
  run: (work: () => Promise<unknown>, success: string) => Promise<boolean>;
  onReport: (report: AppraisalReportView) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function OfficerReportEditor({ loan, report, busy, run, onReport, onDirtyChange }: OfficerReportEditorProps) {
  const saved = useMemo(() => report?.draft ?? {}, [report?.draft]);
  const [content, setContent] = useState<Record<string, string>>(saved);
  const lastSaved = useRef(saved);
  const dirty = draftChanged(content, saved);

  useEffect(() => {
    setContent(current => draftChanged(current, lastSaved.current) ? current : saved);
    lastSaved.current = saved;
  }, [saved]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const rateBand = loan.rateBand;
  const rateValue = content[REPORT_RATE_KEY]?.trim() ? parseRateText(content[REPORT_RATE_KEY]) : null;
  const rateInvalid = Boolean(content[REPORT_RATE_KEY]?.trim()) && rateValue === null;
  const rateOutside = rateValue !== null && Boolean(rateBand) && !rateInBand(rateValue, rateBand!);
  const blockReason = rateInvalid ? RATE_ERROR
    : rateBand === null ? NO_BAND_ERROR
    : rateOutside ? `Lãi suất đề xuất phải trong khung ${bandText(rateBand!)}.`
    : submitBlockReason({ loan, report, content, dirty, required: REQUIRED_FIELDS });
  const requestBody = () => ({ expectedRevision: report?.revision ?? 0, clientRequestId: crypto.randomUUID() });

  const saveDraft = () => run(async () => {
    const rate = content[REPORT_RATE_KEY];
    const next = await api.put<AppraisalReportView>(`/appraisals/${loan.id}/draft`, { ...requestBody(), content: rate === undefined ? content : { ...content, [REPORT_RATE_KEY]: normalizeRateText(rate) } });
    const draft = next.draft ?? {};
    lastSaved.current = draft;
    setContent(draft);
    onReport(next);
  }, 'Đã lưu bản nháp tờ trình.');

  const submit = () => run(
    () => api.post(`/appraisals/${loan.id}/submit`, requestBody()),
    report?.status === 'CLARIFICATION_REQUIRED' ? 'Đã trình lại tờ trình.' : 'Đã trình tờ trình. Hồ sơ chuyển sang Thẩm định.',
  );

  return <section className="card aw-card" aria-label="Soạn tờ trình tín dụng">
    <div>
      <h2 className="aw-card-title">Tờ trình tín dụng</h2>
      <p className="aw-hint">{STATUS_TEXT[report?.status ?? 'DRAFT'] ?? 'Đang lập'}</p>
    </div>
    {report?.status === 'CLARIFICATION_REQUIRED' && report.clarification && <p className="aw-alert aw-alert-warning"><strong>Yêu cầu làm rõ: </strong>{report.clarification.message}</p>}
    <div className="aw-form oc-report-form">
      {REPORT_FORM_FIELDS.map(([key, label]) => <label key={key}>{label}
        {key === REPORT_RATE_KEY
          ? <><input type="number" inputMode="decimal" min={rateBand?.minRate ?? 0} max={rateBand?.maxRate ?? 100} step="0.01" disabled={busy} value={content[key] ?? ''} onChange={event => setContent({ ...content, [key]: event.target.value })} aria-invalid={rateInvalid || rateOutside} />
            {rateBand !== undefined && <span className="aw-hint">{rateBand ? `Khung lãi suất: ${bandText(rateBand)}` : NO_BAND_ERROR}</span>}</>
          : <textarea rows={5} maxLength={10000} disabled={busy} value={content[key] ?? ''} onChange={event => setContent({ ...content, [key]: event.target.value })} />}
      </label>)}
    </div>
    <div className="oc-report-actions">
      <p className={blockReason ? 'aw-hint' : 'aw-hint oc-ready'} role="status">{blockReason ?? 'Bản nháp đã lưu, có thể trình tờ trình.'}</p>
      <div className="aw-form-actions">
        <button type="button" className="btn btn-secondary" disabled={busy || rateInvalid || (!dirty && Boolean(report))} onClick={() => void saveDraft()}>Lưu nháp</button>
        <button type="button" className="btn btn-primary" disabled={busy || Boolean(blockReason)} onClick={() => void submit()}>{report?.status === 'CLARIFICATION_REQUIRED' ? 'Trình lại tờ trình' : 'Trình tờ trình'}</button>
      </div>
    </div>
    <p className="aw-hint">{`${REPORT_CONDITIONS_LABEL} không bắt buộc. Người lập và người quyết định phải độc lập. Làm rõ nội bộ không tạm dừng SLA.`}</p>
  </section>;
}
