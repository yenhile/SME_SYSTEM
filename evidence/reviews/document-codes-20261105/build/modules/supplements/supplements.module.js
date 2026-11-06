"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplementsModule = void 0;
const common_1 = require("@nestjs/common");
const supplements_service_1 = require("./supplements.service");
const supplements_controller_1 = require("./supplements.controller");
const prisma_service_1 = require("../../prisma.service");
const prediction_module_1 = require("../prediction/prediction.module");
const jwt_1 = require("@nestjs/jwt");
const portal_auth_1 = require("../portal/portal.auth");
const portal_mailer_1 = require("../portal/portal.mailer");
const portal_supplements_controller_1 = require("./portal-supplements.controller");
const portal_supplements_service_1 = require("./portal-supplements.service");
const supplement_reminders_service_1 = require("./supplement-reminders.service");
let SupplementsModule = class SupplementsModule {
};
exports.SupplementsModule = SupplementsModule;
exports.SupplementsModule = SupplementsModule = __decorate([
    (0, common_1.Module)({
        imports: [prediction_module_1.PredictionModule, jwt_1.JwtModule.register({})],
        controllers: [supplements_controller_1.SupplementsController, portal_supplements_controller_1.PortalSupplementsController],
        providers: [supplements_service_1.SupplementsService, prisma_service_1.PrismaService, portal_supplements_service_1.PortalSupplementsService, portal_auth_1.PortalAuthService, portal_auth_1.PortalGuard, portal_mailer_1.PortalMailer, supplement_reminders_service_1.SupplementRemindersService],
        exports: [supplements_service_1.SupplementsService],
    })
], SupplementsModule);
//# sourceMappingURL=supplements.module.js.map