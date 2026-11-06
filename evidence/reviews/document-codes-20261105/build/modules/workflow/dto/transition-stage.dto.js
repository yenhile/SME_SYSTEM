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
exports.TransitionStageDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class TransitionStageDto {
    targetStage;
    targetStatus;
    reportVersionId;
    notes;
    officialAmount;
    approvedAmount;
    interestRate;
    rejectionReasonCode;
    rejectionNote;
}
exports.TransitionStageDto = TransitionStageDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Công đoạn đích không được để trống' }),
    (0, class_validator_1.IsEnum)(client_1.StageCode, { message: 'Mã công đoạn không hợp lệ' }),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "targetStage", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Trạng thái đích không được để trống' }),
    (0, class_validator_1.IsEnum)(client_1.LoanStatus, { message: 'Trạng thái hồ sơ không hợp lệ' }),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "targetStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "reportVersionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TransitionStageDto.prototype, "officialAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TransitionStageDto.prototype, "approvedAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TransitionStageDto.prototype, "interestRate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "rejectionReasonCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionStageDto.prototype, "rejectionNote", void 0);
//# sourceMappingURL=transition-stage.dto.js.map