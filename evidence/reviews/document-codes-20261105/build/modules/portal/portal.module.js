"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../prisma.service");
const auth_module_1 = require("../auth/auth.module");
const portal_controller_1 = require("./portal.controller");
const portal_auth_1 = require("./portal.auth");
const portal_mailer_1 = require("./portal.mailer");
const portal_service_1 = require("./portal.service");
let PortalModule = class PortalModule {
};
exports.PortalModule = PortalModule;
exports.PortalModule = PortalModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, jwt_1.JwtModule.register({})], controllers: [portal_controller_1.PortalAuthController, portal_controller_1.PortalRequestsController, portal_controller_1.PortalIntakesController], providers: [prisma_service_1.PrismaService, portal_auth_1.PortalAuthService, portal_auth_1.PortalGuard, portal_mailer_1.PortalMailer, portal_service_1.PortalService] })
], PortalModule);
//# sourceMappingURL=portal.module.js.map