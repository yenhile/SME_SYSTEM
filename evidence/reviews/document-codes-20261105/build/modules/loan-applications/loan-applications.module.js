"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanApplicationsModule = void 0;
const common_1 = require("@nestjs/common");
const loan_applications_service_1 = require("./loan-applications.service");
const loan_applications_controller_1 = require("./loan-applications.controller");
const prisma_service_1 = require("../../prisma.service");
let LoanApplicationsModule = class LoanApplicationsModule {
};
exports.LoanApplicationsModule = LoanApplicationsModule;
exports.LoanApplicationsModule = LoanApplicationsModule = __decorate([
    (0, common_1.Module)({
        controllers: [loan_applications_controller_1.LoanApplicationsController],
        providers: [loan_applications_service_1.LoanApplicationsService, prisma_service_1.PrismaService],
        exports: [loan_applications_service_1.LoanApplicationsService],
    })
], LoanApplicationsModule);
//# sourceMappingURL=loan-applications.module.js.map