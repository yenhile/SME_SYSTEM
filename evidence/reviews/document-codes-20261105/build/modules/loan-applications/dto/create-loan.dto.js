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
exports.CreateLoanDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreateLoanDto {
    taxCode;
    companyName;
    industry;
    establishedYear;
    annualRevenue;
    charterCapital;
    representativeName;
    phone;
    address;
    loanPurpose;
    loanType;
    proposedAmount;
    loanTermMonths;
    assignedTo;
}
exports.CreateLoanDto = CreateLoanDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Mã số thuế không được để trống' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "taxCode", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Tên doanh nghiệp không được để trống' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "companyName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Ngành nghề không được để trống' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "industry", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1950),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Max)(new Date().getFullYear()),
    __metadata("design:type", Number)
], CreateLoanDto.prototype, "establishedYear", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateLoanDto.prototype, "annualRevenue", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateLoanDto.prototype, "charterCapital", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "representativeName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Mục đích vay không được để trống' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "loanPurpose", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Loại vay không được để trống' }),
    (0, class_validator_1.IsEnum)(client_1.LoanType, { message: 'Loại vay không hợp lệ' }),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "loanType", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Số tiền đề xuất vay không được để trống' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(10000000, { message: 'Số tiền vay tối thiểu 10 triệu VNĐ' }),
    __metadata("design:type", Number)
], CreateLoanDto.prototype, "proposedAmount", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Thời hạn vay không được để trống' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1, { message: 'Thời hạn vay tối thiểu 1 tháng' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Max)(120),
    __metadata("design:type", Number)
], CreateLoanDto.prototype, "loanTermMonths", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLoanDto.prototype, "assignedTo", void 0);
//# sourceMappingURL=create-loan.dto.js.map