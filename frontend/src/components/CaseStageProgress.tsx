import { stageProgress } from '../loanListDisplay';
import { stageStandardText } from '../slaDisplay';
import type { LoanApplication, StageCode } from '../types';

const STAGES: ReadonlyArray<readonly [StageCode, string]> = [['TIEP_NHAN', 'Tiếp nhận'], ['THAM_DINH', 'Thẩm định'], ['HOAN_TAT', 'Hoàn tất']];

export function CaseStageProgress({ loan }: { loan: LoanApplication }) {
  const current = stageProgress(loan.currentStage);
  const standard = (code: StageCode) => {
    const history = [...(loan.stageHistories ?? [])].reverse().find(item => item.stage?.stageCode === code);
    return !history && code !== 'HOAN_TAT' ? 'Theo cấu hình' : stageStandardText(code, history?.slaStandardHours, history?.slaPolicy ?? null);
  };
  const finalReached = current === STAGES.length;
  return <ol className="oc-progress" aria-label="Tiến trình hồ sơ">
    {STAGES.map(([code, label], index) => {
      const step = index + 1;
      const done = step < current || (finalReached && step === current);
      const active = step === current && !finalReached;
      return <li key={code} className={done ? 'is-done' : active ? 'is-active' : ''} aria-current={active ? 'step' : undefined}>
        <span className="oc-progress-mark" aria-hidden="true">{done ? '✓' : step}</span>
        <span className="oc-progress-text"><strong>{label}</strong><span>SLA: {standard(code)}</span></span>
      </li>;
    })}
  </ol>;
}
