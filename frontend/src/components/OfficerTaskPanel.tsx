import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { api } from '../api/client';
import { moneyText, type AppraisalReportView } from '../appraisalWorkspace';
import { officerSituation, officerSteps, type OfficerAccess, type OfficerStepKey } from '../officerCase';
import type { LoanApplication } from '../types';
import { officialAmountError } from './loanInputRules';

interface OfficerTaskPanelProps {
  loan: LoanApplication;
  report: AppraisalReportView | null;
  access: OfficerAccess;
  busy: boolean;
  run: (work: () => Promise<unknown>, success: string) => Promise<boolean>;
  onShowDocuments: () => void;
  onShowSupplements: () => void;
  onShowReport: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const STEP_TITLES: Record<OfficerStepKey, string> = {
  documents: 'Xác nhận đủ hồ sơ',
  amount: 'Xác định hạn mức chính thức',
  report: 'Lưu nháp và trình tờ trình',
  transition: 'Chuyển sang Thẩm định',
};

export function OfficerTaskPanel({ loan, report, access, busy, run, onShowDocuments, onShowSupplements, onShowReport, onDirtyChange }: OfficerTaskPanelProps) {
  const baseAmount = Number(loan.officialAmount || loan.proposedAmount);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amount, setAmount] = useState(baseAmount);
  const situation = officerSituation(loan, report, access);
  const savedAmountError = loan.officialAmount ? officialAmountError(Number(loan.officialAmount), loan.proposedAmount) : null;
  const inputError = officialAmountError(amount, loan.proposedAmount);
  const amountDirty = editingAmount && access.reception && amount !== baseAmount;

  useEffect(() => { onDirtyChange(amountDirty); }, [amountDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  if (situation.kind === 'finished') return null;

  const saveAmount = async () => {
    const saved = await run(() => api.put(`/loan-applications/${loan.id}/set-amount`, { officialAmount: amount }), 'Đã lưu hạn mức chính thức.');
    if (saved) setEditingAmount(false);
  };
  const toggleDocuments = () => run(
    () => api.put(`/loan-applications/${loan.id}/check-documents`, { isComplete: !loan.isDocumentComplete }),
    loan.isDocumentComplete ? 'Đã bỏ xác nhận đủ hồ sơ.' : 'Đã xác nhận đủ hồ sơ.',
  );
  const transition = () => {
    if (!window.confirm('Chuyển hồ sơ sang công đoạn Thẩm định?')) return;
    void run(() => api.post(`/workflow/${loan.id}/transition`, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL', notes: 'Chuyển sang công đoạn thẩm định hồ sơ' }), 'Đã chuyển hồ sơ sang Thẩm định.');
  };

  const steps = officerSteps(loan, !savedAmountError);
  const documentsDone = steps[0].done;

  return <section className="card aw-card oc-tasks" aria-label={situation.title}>
    <h2 className="aw-card-title">{situation.title}</h2>
    {situation.kind === 'blocked' && <p role="alert" className="aw-alert aw-alert-danger">{situation.detail}</p>}
    {situation.kind === 'clarification' && <p className="aw-alert aw-alert-warning">{situation.detail}</p>}
    {!['blocked', 'clarification', 'steps'].includes(situation.kind) && <p className="aw-hint">{situation.detail}</p>}
    {situation.kind === 'waitingSupplement' && <button type="button" className="btn btn-secondary aw-submit" onClick={onShowSupplements}>Xem yêu cầu bổ sung</button>}
    {situation.kind === 'clarification' && <button type="button" className="btn btn-primary aw-submit" onClick={onShowReport}>Đến tờ trình</button>}

    {situation.kind === 'steps' && <ol className="oc-steps">
      {steps.map(step => <li key={step.key} className={step.done ? 'is-done' : ''}>
        <div className="oc-step-title">
          {step.done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
          <strong>{STEP_TITLES[step.key]}</strong>
          <span className="aw-sr-only">{step.done ? 'Đã xong' : 'Chưa xong'}</span>
        </div>

        {step.key === 'documents' && <>
          <p className="aw-hint">{step.done ? 'Thêm hoặc xóa chứng từ sẽ cần xác nhận lại.' : 'Rà soát chứng từ rồi xác nhận khi đã đủ.'}</p>
          <div className="oc-step-actions">
            <button type="button" className="btn btn-secondary" onClick={onShowDocuments}>Xem chứng từ</button>
            <button type="button" className={`btn ${step.done ? 'btn-secondary' : 'btn-primary'}`} disabled={busy} onClick={() => void toggleDocuments()}>{step.done ? 'Bỏ xác nhận' : 'Xác nhận đủ hồ sơ'}</button>
          </div>
        </>}

        {step.key === 'amount' && <>
          <p className="aw-hint">{loan.officialAmount ? moneyText(loan.officialAmount) : 'Chưa xác định'}</p>
          {savedAmountError && <p role="alert" className="aw-field-error">{savedAmountError}</p>}
          {!editingAmount && <div className="oc-step-actions"><button type="button" className="btn btn-secondary" onClick={() => { setAmount(baseAmount); setEditingAmount(true); }}>{loan.officialAmount ? 'Sửa hạn mức' : 'Nhập hạn mức'}</button></div>}
          {editingAmount && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (!inputError) void saveAmount(); }}>
            <label>Hạn mức chính thức (VNĐ)
              <input type="number" step="100000000" value={amount} disabled={busy} aria-invalid={Boolean(inputError)} onChange={event => setAmount(Number(event.target.value))} />
            </label>
            <p className={inputError ? 'aw-field-error' : 'aw-hint'}>{inputError ?? `${moneyText(amount)} · Không vượt số đề xuất ${moneyText(loan.proposedAmount)}`}</p>
            <div className="aw-form-actions">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditingAmount(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={busy || Boolean(inputError)}>Lưu hạn mức</button>
            </div>
          </form>}
        </>}

        {step.key === 'report' && <div className="oc-step-actions"><button type="button" className="btn btn-secondary" onClick={onShowReport}>Đến tờ trình</button></div>}

        {step.key === 'transition' && <>
          <p className="aw-hint">{documentsDone ? 'Hồ sơ theo quy trình cũ, không có tờ trình.' : 'Cần xác nhận đủ hồ sơ trước khi chuyển.'}</p>
          <div className="oc-step-actions"><button type="button" className="btn btn-primary" disabled={busy || !documentsDone} onClick={transition}>Chuyển sang Thẩm định</button></div>
        </>}
      </li>)}
    </ol>}
  </section>;
}
