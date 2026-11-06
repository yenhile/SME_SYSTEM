import { useEffect, useRef, useState } from 'react';
import { moneyText, REJECTION_REASONS, type AppraisalActions } from '../appraisalWorkspace';

type DecisionAction = 'approve' | 'reject' | 'clarify';

export type DecisionSubmit =
  | { action: 'approve'; approvedAmount: number; interestRate: number }
  | { action: 'reject'; rejectionReasonCode: string; rejectionNote: string }
  | { action: 'clarify'; message: string };

interface AppraisalDecisionPanelProps {
  actions: AppraisalActions;
  limit: number;
  busy: boolean;
  error: string;
  clarifyBlockReason?: string | null;
  onSubmit: (decision: DecisionSubmit) => void;
}

const OPTIONS: ReadonlyArray<readonly [DecisionAction, string]> = [['approve', 'Phê duyệt'], ['reject', 'Từ chối'], ['clarify', 'Yêu cầu làm rõ']];
const OVER_LIMIT_NOTE = 'Hồ sơ vượt hạn mức chi nhánh (tối đa 10 tỷ) nên chỉ có thể từ chối.';

export function AppraisalDecisionPanel({ actions, limit, busy, error, clarifyBlockReason, onSubmit }: AppraisalDecisionPanelProps) {
  const [chosen, setChosen] = useState<DecisionAction | null>(null);
  const [amount, setAmount] = useState(String(limit));
  const [rate, setRate] = useState('');
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
  const rateEntered = rate.trim() !== '';
  const rateValid = rateEntered && Number(rate) >= 0 && Number(rate) <= 100;

  return <section ref={panel} className="card aw-card" aria-label="Quyết định">
    <h2 className="aw-card-title">Quyết định</h2>
    {actions.blockReason && <p role="alert" className="aw-alert aw-alert-warning">{actions.blockReason}</p>}
    {!actions.canClarify && !actions.blockReason && clarifyBlockReason && <p className="aw-hint">{clarifyBlockReason}</p>}
    {actions.canDecide && !actions.canApprove && <p className="aw-alert aw-alert-warning">{OVER_LIMIT_NOTE}</p>}
    {!choices.length && !actions.blockReason && <p className="aw-hint">Không có thao tác nào ở trạng thái này.</p>}
    {choices.length > 0 && <div className="aw-choice" role="radiogroup" aria-label="Chọn thao tác">
      {choices.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={action === value} className={`aw-choice-option aw-choice-${value}${action === value ? ' is-active' : ''}`} onClick={() => setChosen(value)}>{label}</button>)}
    </div>}

    {action === 'approve' && <form className="aw-form" onSubmit={event => { event.preventDefault(); if (amountValid && rateValid) onSubmit({ action: 'approve', approvedAmount: amountValue, interestRate: Number(rate) }); }}>
      <label>Số tiền phê duyệt (VNĐ)
        <input type="number" min={1} max={limit} required value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!amountValid} />
      </label>
      <p className={amountValid ? 'aw-hint' : 'aw-field-error'}>{amountValid ? moneyText(amountValue) : `Số tiền phải lớn hơn 0 và không vượt ${moneyText(limit)}.`}</p>
      <label>Lãi suất phê duyệt (%/năm)
        <input type="number" min={0} max={100} step="0.1" required placeholder="Nhập lãi suất" value={rate} onChange={event => setRate(event.target.value)} aria-invalid={rateEntered && !rateValid} />
      </label>
      {rateEntered && !rateValid && <p className="aw-field-error">Lãi suất phải từ 0% đến 100%.</p>}
      <button type="submit" className="btn btn-success aw-submit" disabled={busy || !amountValid || !rateValid}>{busy ? 'Đang ghi nhận…' : 'Xác nhận phê duyệt'}</button>
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
