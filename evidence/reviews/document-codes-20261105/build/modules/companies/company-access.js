"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOfficerMayWriteCompany = assertOfficerMayWriteCompany;
const common_1 = require("@nestjs/common");
async function assertOfficerMayWriteCompany(db, taxCode, officerId) {
    const existing = await db.company.findUnique({
        where: { taxCode },
        select: { id: true, loans: { where: { assignedTo: officerId }, select: { id: true }, take: 1 } },
    });
    if (existing && existing.loans.length === 0) {
        throw new common_1.ForbiddenException('Doanh nghiệp này thuộc hồ sơ do cán bộ khác phụ trách, bạn không thể tạo hồ sơ hoặc chỉnh sửa thông tin. Vui lòng liên hệ Quản lý chi nhánh.');
    }
}
//# sourceMappingURL=company-access.js.map