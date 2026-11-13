import { useEffect, useRef, useState } from 'react';
import { approvalRateCheck, bandText, moneyText, rateInBand, rateText, REJECTION_REASONS, type AppraisalActions, type RateBandView } from '../appraisalWorkspace';

type DecisionAction = 'approve' | 'reject' | 'clarify';

export type DecisionSubmit =
  | { action: 'approve'; approvedAmount: number; interestRate: number; interestRateReason?: string }
  | { action: 'reject'; rejectionReasonCode: string; rejectionNote: string }
  | { action: 'clarify'; message: string };

interface AppraisalDecisionPanelProps {
  actions: AppraisalActions;
  limit: number;
  busy: boolean;
  error: string;
  clarifyBlockReason?: string | null;
  proposedRate: number | null;
  proposedRateNote: string | null;
  proposalMissing?: boolean;
  band?: RateBandView | null;
  onSubmit: (decision: DecisionSubmit) => void;
}

const OPTIONS: ReadonlyArray<readonly [DecisionAction, string]> = [['approve', 'Phê duyệt'], ['reject', 'Từ chối'], ['clarify', 'Yêu cầu làm rõ']];
const OVER_LIMIT_NOTE = 'Hồ sơ vượt hạn mức chi nhánh (tối đa 10 tỷ) nên chỉ có thể từ chối.';

export function AppraisalDecisionPanel({ actions, limit, busy, error, clarifyBlockReason, proposedRate, proposedRateNote, proposalMissing = false, band, onSubmit }: AppraisalDecisionPanelProps) {
  const [chosen, setChosen] = useState<DecisionAction | null>(null);
  const [amount, setAmount] = useState(String(limit));
  const [rate, setRate] = useState('');
  const [rateReason, setRateReason] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const available: Record<DecisionAction, boolean> = { approve: actions.canApprove, reject: actions.canDecide, clarify: actions.canClarify };
  const choices = OPTIONS.filter(([action]) => available[action]);
  const action = chosen && available[chosen] ? chosen : null;
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (action) panel.current?.scrollIntoView({ block: 'nearest' });
  }, [action]);

  const amountValue = Number(amount);
  const amountValid = amount.trim() !== '' && amountValue > 0 && amountValue <= limit;
  const rateCheck = approvalRateCheck({ rate, proposed: proposedRate, reason: rateReason, band });
  const proposalOutside = Boolean(band) && proposedRate !== null && !rateInBand(proposedRate, band!);

  return <section ref={panel} className="card aw-card" aria-label="Quyết định">
    <h2 className="aw-card-title">Quyết định</h2>
    {actions.blockReason && <p role="alert" className="aw-alert aw-alert-warning">{actions.blockReason}</p>}
    {!actions.canClarify && !actions.blockReason && clarifyBlockReason && <p className="aw-hint">{clarifyBlockReason}</p>}
    {actions.canDecide && !actions.canApprove && <p className="aw-alert aw-alert-warning">{OVER_LIMIT_NOTE}</p>}
    {!choices.length && !actions.blockReason && <p className="aw-hint">Không có thao tác nào ở trạng thái này.</p>}
    {choices.length > 0 && <div className="aw-choice" role="radiogroup" aria-label="Chọn thao tác">
      {choices.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={action === value} className={`aw-choice-option aw-choice-${value}${action === value ? ' is-active' : ''}`} onClick={() => setChosen(value)}>{label}</button>)}
    </div>}

    {action === 'approve' && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (!proposalMissing && amountValid && rateCheck.ready && rateCheck.rate !== null) onSubmit({ action: 'approve', approvedAmount: amountValue, interestRate: rateCheck.rate, ...(rateCheck.deviates ? { interestRateReason: rateReason.trim() } : {}) }); }}>
      <label>Số tiền phê duyệt (VNĐ)
        <input type="number" min={1} max={limit} required value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!amountValid} />
      </label>
      <p className={amountValid ? 'aw-hint' : 'aw-field-error'}>{amountValid ? moneyText(amountValue) : `Số tiền phải lớn hơn 0 và không vượt ${moneyText(limit)}.`}</p>
      <label>Lãi suất phê duyệt (%/năm)
        <input type="number" inputMode="decimal" min={0} max={100} step="0.01" required placeholder="Nhập lãi suất" value={rate} onChange={event => setRate(event.target.value)} aria-invalid={Boolean(rateCheck.error)} aria-describedby="aw-rate-basis" />
      </label>
      <p id="aw-rate-basis" className={proposalMissing ? "aw-alert aw-alert-warning" : "aw-hint"}>{proposedRate !== null ? `CBTD đề xuất: ${rateText(proposedRate)}` : proposedRateNote}{band && ` · Khung lãi suất: ${bandText(band)}`}</p>
      {proposalOutside && <p className="aw-alert aw-alert-warning">Mức CBTD đề xuất nằm ngoài khung hiện hành. Chọn mức trong khung và ghi lý do, hoặc yêu cầu CBTD làm rõ.</p>}
      {rateCheck.error && <p className="aw-field-error">{rateCheck.error}</p>}
      {rateCheck.deviates && <label>Lý do khác mức đề xuất
        <textarea required rows={3} maxLength={2000} value={rateReason} onChange={event => setRateReason(event.target.value)} aria-invalid={!rateReason.trim()} />
      </label>}
      <button type="submit" className="btn btn-success aw-submit" disabled={busy || proposalMissing || !amountValid || !rateCheck.ready}>{busy ? 'Đang ghi nhận…' : 'Xác nhận phê duyệt'}</button>
    </form>}

    {action === 'reject' && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (reasonCode && note.trim()) onSubmit({ action: 'reject', rejectionReasonCode: reasonCode, rejectionNote: note.trim() }); }}>
      <label>Lý do từ chối
        <select required value={reasonCode} onChange={event => setReasonCode(event.target.value)}>
          <option value="">Chọn lý do</option>
          {Object.entries(REJECTION_REASONS).map(([code, label]) => <option key={code} value={code}>{code} - {label}</option>)}
        </select>
      </label>
      <label>Giải trình
        <textarea required rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <button type="submit" className="btn btn-danger aw-submit" disabled={busy || !reasonCode || !note.trim()}>{busy ? 'Đang ghi nhận…' : 'Xác nhận từ chối'}</button>
    </form>}

    {action === 'clarify' && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (message.trim()) onSubmit({ action: 'clarify', message: message.trim() }); }}>
      <label>Nội dung cần CBTD làm rõ
        <textarea required rows={4} maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} />
      </label>
      <p className="aw-hint">Làm rõ nội bộ không tạm dừng SLA.</p>
      <button type="submit" className="btn btn-primary aw-submit" disabled={busy || !message.trim()}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu làm rõ'}</button>
    </form>}

    {error && <p role="alert" className="aw-alert aw-alert-danger">{error}</p>}
  </section>;
}
