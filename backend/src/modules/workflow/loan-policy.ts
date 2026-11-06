import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {assertNoCoordinationConflict} from '../assignments/assignment-coordination';

export const BRANCH_POLICY = 'SME_BRANCH_20261031_V1';
export const BRANCH_LIMIT = 10_000_000_000;
export const BRANCH_LIMIT_MESSAGE = 'Cổng này tiếp nhận đề nghị vay tối đa 10 tỷ đồng. Với nhu cầu cao hơn, vui lòng liên hệ ngân hàng để được hướng dẫn.';
export function assertBranchAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > BRANCH_LIMIT) throw new BadRequestException(BRANCH_LIMIT_MESSAGE);
}
export function assertOfficialAmount(value: unknown, proposedAmount: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Hạn mức vay phải là số dương hợp lệ.');
  if (amount > BRANCH_LIMIT) throw new BadRequestException('Hạn mức chính thức tối đa 10 tỷ đồng.');
  if (amount > Number(proposedAmount)) throw new BadRequestException('Hạn mức chính thức không được vượt số tiền đề xuất.');
}
export type LoanActor = { id: string; activeRole: string };
/** Run against the freshly locked row, never just the guard's earlier copy. */
export async function assertLoanWrite(tx:any,loan: any, actor: LoanActor, receptionOnly = false) {
  if (loan.completedAt || loan.currentStage === 'HOAN_TAT') throw new ForbiddenException('Hồ sơ đã kết thúc, không thể chỉnh sửa.');
  if (actor.activeRole === 'CBTD' && loan.assignedTo !== actor.id) throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
  const expected = loan.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
  if (actor.activeRole !== expected || (receptionOnly && loan.currentStage !== 'TIEP_NHAN')) throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
  await assertNoCoordinationConflict(tx,{applicationId:loan.id},actor.id);
}
/** Shared with disabling an officer: a concurrent assignment must wait and reread the account. */
export async function lockOfficer(tx: any, id: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`sme-officer:${id}`}))::text`;
}
