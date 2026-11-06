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
exports.PredictionController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prediction_service_1 = require("./prediction.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const loan_access_guard_1 = require("../../common/guards/loan-access.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let PredictionController = class PredictionController {
    prediction;
    constructor(prediction) {
        this.prediction = prediction;
    }
    predict(id) { return this.prediction.predictForApplication(id); }
};
exports.PredictionController = PredictionController;
__decorate([
    (0, common_1.Post)('predict/:applicationId'),
    __param(0, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PredictionController.prototype, "predict", null);
exports.PredictionController = PredictionController = __decorate([
    (0, common_1.Controller)('prediction'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, loan_access_guard_1.LoanAccessGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.THAM_QUYEN, client_1.RoleCode.QUAN_LY),
    __metadata("design:paramtypes", [prediction_service_1.PredictionService])
], PredictionController);
//# sourceMappingURL=prediction.controller.js.map