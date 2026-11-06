"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const appraisal_module_1 = require("./modules/appraisal/appraisal.module");
const common_1 = require("@nestjs/common");
const admin_controller_1 = require("./admin.controller");
const health_controller_1 = require("./health.controller");
const health_service_1 = require("./health.service");
const prisma_service_1 = require("./prisma.service");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const companies_module_1 = require("./modules/companies/companies.module");
const loan_applications_module_1 = require("./modules/loan-applications/loan-applications.module");
const prediction_module_1 = require("./modules/prediction/prediction.module");
const workflow_module_1 = require("./modules/workflow/workflow.module");
const supplements_module_1 = require("./modules/supplements/supplements.module");
const assignments_module_1 = require("./modules/assignments/assignments.module");
const documents_module_1 = require("./modules/documents/documents.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const portal_module_1 = require("./modules/portal/portal.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            appraisal_module_1.AppraisalModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            companies_module_1.CompaniesModule,
            loan_applications_module_1.LoanApplicationsModule,
            prediction_module_1.PredictionModule,
            workflow_module_1.WorkflowModule,
            supplements_module_1.SupplementsModule,
            assignments_module_1.AssignmentsModule,
            documents_module_1.DocumentsModule,
            dashboard_module_1.DashboardModule,
            portal_module_1.PortalModule,
            notifications_module_1.NotificationsModule,
        ],
        controllers: [health_controller_1.HealthController, admin_controller_1.AdminController],
        providers: [health_service_1.HealthService, prisma_service_1.PrismaService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map