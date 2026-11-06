"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanAccessGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
let LoanAccessGuard = class LoanAccessGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const params = request.params;
        let applicationId = params.applicationId;
        if (params.supplementId) {
            const record = await this.prisma.supplementRequest.findUnique({ where: { id: params.supplementId } });
            if (!record)
                throw new common_1.NotFoundException('Không tìm thấy yêu cầu bổ sung.');
            applicationId = record.applicationId;
        }
        else if (params.id && request.originalUrl.startsWith('/api/documents/')) {
            const record = await this.prisma.document.findUnique({ where: { id: params.id } });
            if (!record)
                throw new common_1.NotFoundException('Không tìm thấy chứng từ.');
            applicationId = record.applicationId;
        }
        else if (params.id) {
            applicationId = params.id;
        }
        if (!applicationId)
            return true;
        const loan = await this.prisma.loanApplication.findUnique({ where: { id: applicationId } });
        if (!loan)
            throw new common_1.NotFoundException('Không tìm thấy hồ sơ vay.');
        if (request.user.activeRole === 'CBTD' && loan.assignedTo !== request.user.id) {
            throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
        }
        if (request.user.activeRole === 'THAM_QUYEN' && loan.currentStage === 'TIEP_NHAN') {
            throw new common_1.ForbiddenException('Thẩm quyền chỉ truy cập hồ sơ từ công đoạn Thẩm định trở đi.');
        }
        request.loan = loan;
        if (request.method !== 'GET') {
            if (loan.completedAt || loan.currentStage === 'HOAN_TAT')
                throw new common_1.ForbiddenException('Hồ sơ đã kết thúc, không thể chỉnh sửa.');
            if (request.originalUrl.startsWith('/api/documents/') || request.originalUrl.startsWith('/api/supplements/')) {
                const expectedRole = loan.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN';
                if (request.user.activeRole !== expectedRole)
                    throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
            }
        }
        return true;
    }
};
exports.LoanAccessGuard = LoanAccessGuard;
exports.LoanAccessGuard = LoanAccessGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LoanAccessGuard);
//# sourceMappingURL=loan-access.guard.js.map