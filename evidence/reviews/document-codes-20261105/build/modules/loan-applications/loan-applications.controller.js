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
exports.LoanApplicationsController = void 0;
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const common_1 = require("@nestjs/common");
const loan_applications_service_1 = require("./loan-applications.service");
const create_loan_dto_1 = require("./dto/create-loan.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const client_2 = require("@prisma/client");
let LoanApplicationsController = class LoanApplicationsController {
    loanService;
    constructor(loanService) {
        this.loanService = loanService;
    }
    create(dto, userId) {
        return this.loanService.create(dto, userId);
    }
    findAll(user, stage, status, keyword, myOnly) {
        return this.loanService.findAll(user, {
            stage,
            status,
            keyword,
            myOnly: myOnly === 'true',
        });
    }
    findOne(id, user) {
        return this.loanService.findOne(id, new Date(), user);
    }
    checkDocuments(id, isComplete, user) {
        return this.loanService.checkDocuments(id, isComplete, user);
    }
    setAmount(id, officialAmount, user) {
        return this.loanService.setOfficialAmount(id, Number(officialAmount), user);
    }
};
exports.LoanApplicationsController = LoanApplicationsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_loan_dto_1.CreateLoanDto, String]),
    __metadata("design:returntype", void 0)
], LoanApplicationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('stage')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('keyword')),
    __param(4, (0, common_1.Query)('myOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LoanApplicationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LoanApplicationsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id/check-documents'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('isComplete')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean, Object]),
    __metadata("design:returntype", void 0)
], LoanApplicationsController.prototype, "checkDocuments", null);
__decorate([
    (0, common_1.Put)(':id/set-amount'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('officialAmount')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", void 0)
], LoanApplicationsController.prototype, "setAmount", null);
exports.LoanApplicationsController = LoanApplicationsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    (0, common_1.Controller)('loan-applications'),
    __metadata("design:paramtypes", [loan_applications_service_1.LoanApplicationsService])
], LoanApplicationsController);
//# sourceMappingURL=loan-applications.controller.js.map