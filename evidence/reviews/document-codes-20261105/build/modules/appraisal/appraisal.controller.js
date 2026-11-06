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
exports.AppraisalController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const appraisal_service_1 = require("./appraisal.service");
let AppraisalController = class AppraisalController {
    service;
    constructor(service) {
        this.service = service;
    }
    async view(id, res, user) {
        const report = await this.service.view(id, user);
        if (!report) {
            if (res?.status)
                res.status(common_1.HttpStatus.NO_CONTENT);
            return;
        }
        return report;
    }
    save(id, body, user) { return this.service.mutate(id, 'DRAFT_SAVED', body, user); }
    submit(id, body, user) { return this.service.mutate(id, 'SUBMITTED', body, user); }
    clarify(id, body, user) { return this.service.mutate(id, 'CLARIFICATION_REQUESTED', body, user); }
};
exports.AppraisalController = AppraisalController;
__decorate([
    (0, common_1.Get)(':applicationId'),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AppraisalController.prototype, "view", null);
__decorate([
    (0, common_1.Put)(':applicationId/draft'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AppraisalController.prototype, "save", null);
__decorate([
    (0, common_1.Post)(':applicationId/submit'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AppraisalController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':applicationId/clarify'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AppraisalController.prototype, "clarify", null);
exports.AppraisalController = AppraisalController = __decorate([
    (0, common_1.Controller)('appraisals'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    __metadata("design:paramtypes", [appraisal_service_1.AppraisalService])
], AppraisalController);
//# sourceMappingURL=appraisal.controller.js.map