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
exports.SupplementsController = void 0;
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const common_1 = require("@nestjs/common");
const supplements_service_1 = require("./supplements.service");
const create_supplement_dto_1 = require("./dto/create-supplement.dto");
const resolve_supplement_dto_1 = require("./dto/resolve-supplement.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const portal_supplements_service_1 = require("./portal-supplements.service");
const portal_supplements_controller_1 = require("./portal-supplements.controller");
let SupplementsController = class SupplementsController {
    supplementsService;
    portalSupplements;
    constructor(supplementsService, portalSupplements) {
        this.supplementsService = supplementsService;
        this.portalSupplements = portalSupplements;
    }
    portalDetails(id) { return this.portalSupplements.details(id); }
    review(id, itemId, body, user) { return this.portalSupplements.review(id, itemId, body, user); }
    returnCorrections(id, body, user) { return this.portalSupplements.returnCorrections(id, body, user); }
    async download(id, fileId) { return (0, portal_supplements_controller_1.supplementDownload)(await this.portalSupplements.download(id, fileId)); }
    getSupplements(applicationId) {
        return this.supplementsService.getSupplements(applicationId);
    }
    createRequest(applicationId, dto, userId, activeRole) {
        return this.supplementsService.createSupplementRequest(applicationId, dto, userId, activeRole);
    }
    resolveRequest(supplementId, dto, userId, activeRole) {
        return this.supplementsService.resolveSupplementRequest(supplementId, dto, userId, activeRole);
    }
};
exports.SupplementsController = SupplementsController;
__decorate([
    (0, common_1.Get)(':supplementId/portal-details'),
    __param(0, (0, common_1.Param)('supplementId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "portalDetails", null);
__decorate([
    (0, common_1.Put)(':supplementId/items/:itemId/review'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('supplementId')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "review", null);
__decorate([
    (0, common_1.Post)(':supplementId/return'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('supplementId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "returnCorrections", null);
__decorate([
    (0, common_1.Get)(':supplementId/files/:fileId/download'),
    __param(0, (0, common_1.Param)('supplementId')),
    __param(1, (0, common_1.Param)('fileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SupplementsController.prototype, "download", null);
__decorate([
    (0, common_1.Get)('application/:applicationId'),
    __param(0, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "getSupplements", null);
__decorate([
    (0, common_1.Post)(':applicationId'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('activeRole')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_supplement_dto_1.CreateSupplementDto, String, String]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Put)(':supplementId/resolve'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('supplementId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('activeRole')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, resolve_supplement_dto_1.ResolveSupplementDto, String, String]),
    __metadata("design:returntype", void 0)
], SupplementsController.prototype, "resolveRequest", null);
exports.SupplementsController = SupplementsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    (0, common_1.Controller)('supplements'),
    __metadata("design:paramtypes", [supplements_service_1.SupplementsService, portal_supplements_service_1.PortalSupplementsService])
], SupplementsController);
//# sourceMappingURL=supplements.controller.js.map