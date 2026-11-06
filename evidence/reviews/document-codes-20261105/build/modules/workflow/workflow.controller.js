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
exports.WorkflowController = void 0;
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const common_1 = require("@nestjs/common");
const workflow_service_1 = require("./workflow.service");
const transition_stage_dto_1 = require("./dto/transition-stage.dto");
const close_overdue_dto_1 = require("./dto/close-overdue.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let WorkflowController = class WorkflowController {
    workflowService;
    constructor(workflowService) {
        this.workflowService = workflowService;
    }
    getWorkflowStages() {
        return this.workflowService.getWorkflowStages();
    }
    getWorkflowHistory(id) {
        return this.workflowService.getWorkflowHistory(id);
    }
    transitionStage(id, dto, user) {
        return this.workflowService.transitionStage(id, dto, user);
    }
    closeOverdueSupplement(id, dto, user) {
        return this.workflowService.closeOverdueSupplement(id, dto, user);
    }
};
exports.WorkflowController = WorkflowController;
__decorate([
    (0, common_1.Get)('stages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getWorkflowStages", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getWorkflowHistory", null);
__decorate([
    (0, common_1.Post)(':id/transition'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, transition_stage_dto_1.TransitionStageDto, Object]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "transitionStage", null);
__decorate([
    (0, common_1.Post)(':id/close-overdue'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.QUAN_LY),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, close_overdue_dto_1.CloseOverdueDto, Object]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "closeOverdueSupplement", null);
exports.WorkflowController = WorkflowController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    (0, common_1.Controller)('workflow'),
    __metadata("design:paramtypes", [workflow_service_1.WorkflowService])
], WorkflowController);
//# sourceMappingURL=workflow.controller.js.map