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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsController = void 0;
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const documents_service_1 = require("./documents.service");
const client_2 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let DocumentsController = class DocumentsController {
    documentsService;
    constructor(documentsService) {
        this.documentsService = documentsService;
    }
    findByApplication(applicationId) {
        return this.documentsService.findByApplication(applicationId);
    }
    create(applicationId, documentType, file, userId, activeRole) {
        if (!file || !Object.values(client_2.DocumentType).includes(documentType))
            throw new common_1.BadRequestException('Cần chọn tệp và loại chứng từ hợp lệ.');
        return this.documentsService.upload(applicationId, documentType, file, userId, activeRole);
    }
    delete(id, user) {
        return this.documentsService.delete(id, user);
    }
    async download(id) {
        const result = await this.documentsService.download(id);
        return new common_1.StreamableFile(result.buffer, { type: 'application/octet-stream', disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}` });
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Get)(':applicationId'),
    __param(0, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "findByApplication", null);
__decorate([
    (0, common_1.Post)(':applicationId'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Body)('documentType')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(4, (0, current_user_decorator_1.CurrentUser)('activeRole')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "download", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    (0, common_1.Controller)('documents'),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map