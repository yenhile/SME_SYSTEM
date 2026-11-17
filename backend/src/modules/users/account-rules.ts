import { BadRequestException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

export const MIN_ACTIVE_APPRAISERS = 2;
export const ROLE_CONFLICT_MESSAGE = 'Một tài khoản không được kiêm Cán bộ tín dụng và Cán bộ thẩm quyền.';
export const APPRAISER_MINIMUM_MESSAGE = `Chi nhánh cần tối thiểu ${MIN_ACTIVE_APPRAISERS} Cán bộ thẩm quyền đang hoạt động, không kiêm Cán bộ tín dụng. Hãy thêm Cán bộ thẩm quyền khác trước khi khóa hoặc bỏ vai trò Thẩm quyền của người này.`;

/** Thẩm quyền được tính vào số người phê duyệt: tài khoản đang mở, có vai trò Thẩm quyền và không kiêm CBTD. */
export const COUNTED_APPRAISER_WHERE = {
  isActive: true,
  AND: [
    { roles: { some: { role: { code: RoleCode.THAM_QUYEN } } } },
    { roles: { none: { role: { code: RoleCode.CBTD } } } },
  ],
};

const conflicting = (roles: readonly string[]) => roles.includes(RoleCode.CBTD) && roles.includes(RoleCode.THAM_QUYEN);

export function isCountedAppraiser(isActive: boolean | undefined, roles: readonly string[]): boolean {
  return isActive === true && roles.includes(RoleCode.THAM_QUYEN) && !roles.includes(RoleCode.CBTD);
}

/** Tài khoản đã kiêm từ trước được giữ nguyên; chỉ chặn lần gán làm phát sinh việc kiêm. */
export function assertNoRoleConflict(next: readonly string[], current: readonly string[] = []) {
  if (conflicting(next) && !conflicting(current)) throw new BadRequestException(ROLE_CONFLICT_MESSAGE);
}

/** Gọi khi thay đổi làm một Thẩm quyền được tính rời khỏi danh sách; khóa chung để hai thao tác đồng thời không cùng lọt qua. */
export async function assertAppraiserMinimum(tx: any, leavingUserId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('sme-appraiser-roster'))::text`;
  const others = await tx.user.count({ where: { ...COUNTED_APPRAISER_WHERE, id: { not: leavingUserId } } });
  if (others < MIN_ACTIVE_APPRAISERS) throw new BadRequestException(APPRAISER_MINIMUM_MESSAGE);
}
