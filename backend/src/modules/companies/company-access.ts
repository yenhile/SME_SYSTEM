import { ForbiddenException } from '@nestjs/common';

/**
 * Ai làm người nấy: CBTD chỉ được tạo doanh nghiệp mới hoặc cập nhật doanh nghiệp đã có hồ sơ gán cho mình.
 * Doanh nghiệp thuộc cán bộ khác thì không được ghi đè (kể cả qua tạo hồ sơ vay mới).
 */
export async function assertOfficerMayWriteCompany(db: any, taxCode: string, officerId: string) {
  const existing = await db.company.findUnique({
    where: { taxCode },
    select: { id: true, loans: { where: { assignedTo: officerId }, select: { id: true }, take: 1 } },
  });
  if (existing && existing.loans.length === 0) {
    throw new ForbiddenException('Doanh nghiệp này thuộc hồ sơ do cán bộ khác phụ trách, bạn không thể tạo hồ sơ hoặc chỉnh sửa thông tin. Vui lòng liên hệ Quản lý chi nhánh.');
  }
}
