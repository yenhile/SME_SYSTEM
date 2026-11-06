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
exports.AdminController = exports.UpdateSlaDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("./prisma.service");
const roles_decorator_1 = require("./common/decorators/roles.decorator");
const roles_guard_1 = require("./common/guards/roles.guard");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
class UpdateSlaDto {
    standardSlaHours;
    stageName;
}
exports.UpdateSlaDto = UpdateSlaDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateSlaDto.prototype, "standardSlaHours", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateSlaDto.prototype, "stageName", void 0);
let AdminController = class AdminController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    stages() { return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } }); }
    updateStage(code, body) {
        return this.prisma.workflowStage.update({ where: { stageCode: code }, data: body });
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('workflow-stages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "stages", null);
__decorate([
    (0, common_1.Put)('workflow-stages/:code'),
    __param(0, (0, common_1.Param)('code', new common_1.ParseEnumPipe(client_1.StageCode))),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateSlaDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateStage", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.ADMIN),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map