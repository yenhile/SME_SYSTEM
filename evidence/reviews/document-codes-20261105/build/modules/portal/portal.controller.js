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
exports.PortalIntakesController = exports.PortalRequestsController = exports.PortalAuthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const portal_auth_1 = require("./portal.auth");
const portal_service_1 = require("./portal.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const downloadResponse = (result) => new common_1.StreamableFile(result.buffer, { type: 'application/octet-stream', disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}` });
let PortalAuthController = class PortalAuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    register(body, req) { return this.auth.register(body, req.ip); }
    verify(body, req) { return this.auth.verify(body, req.ip); }
    resend(body, req) { return this.auth.resend(body, req.ip); }
    login(body, req) { return this.auth.login(body, req.ip); }
    forgot(body, req) { return this.auth.forgotPassword(body, req.ip); }
    reset(body, req) { return this.auth.resetPassword(body, req.ip); }
    me(req) { return req.portalAccount; }
};
exports.PortalAuthController = PortalAuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('resend-verification'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "resend", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "forgot", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "reset", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(portal_auth_1.PortalGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortalAuthController.prototype, "me", null);
exports.PortalAuthController = PortalAuthController = __decorate([
    (0, common_1.Controller)('portal/auth'),
    __metadata("design:paramtypes", [portal_auth_1.PortalAuthService])
], PortalAuthController);
let PortalRequestsController = class PortalRequestsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req) { return this.service.list(req.portalAccount.id); }
    config() { return this.service.formConfig(); }
    create(req, body) { return this.service.create(req.portalAccount.id, body); }
    one(req, id) { return this.service.one(id, req.portalAccount.id); }
    update(req, id, body) { return this.service.update(id, req.portalAccount.id, body); }
    status(req, id) { return this.service.tracking(id, req.portalAccount.id); }
    checklist(req, id) { return this.service.checklist(id, req.portalAccount.id); }
    readiness(req, id) { return this.service.readiness(id, req.portalAccount.id); }
    cycle(req, id) { return this.service.intakeCycle(id, req.portalAccount.id); }
    correction(req, id, body) { return this.service.requestIntakeCorrection(id, body, req.portalAccount.id); }
    documentHeads(req, id) { return this.service.documentHeads(id, req.portalAccount.id); }
    uploadOptions(body) {
        if (!body || Object.keys(body).some(k => !['documentGroup', 'coverage', 'clientUploadId', 'expectedRevision'].includes(k)))
            throw new common_1.BadRequestException('Metadata tải tệp không hợp lệ.');
        const options = {};
        if (body.coverage !== undefined) {
            try {
                options.coverage = JSON.parse(body.coverage);
            }
            catch {
                throw new common_1.BadRequestException('coverage phải là JSON hợp lệ.');
            }
        }
        if (body.clientUploadId !== undefined)
            options.clientUploadId = body.clientUploadId;
        if (body.expectedRevision !== undefined) {
            if (typeof body.expectedRevision !== 'string' || !/^(0|[1-9]\d*)$/.test(body.expectedRevision))
                throw new common_1.BadRequestException('expectedRevision không hợp lệ.');
            options.expectedRevision = Number(body.expectedRevision);
        }
        return options;
    }
    upload(req, id, body, file) { return this.service.upload(id, req.portalAccount.id, body.documentGroup, file, this.uploadOptions(body)); }
    replace(req, id, documentId, body, file) { return this.service.upload(id, req.portalAccount.id, body.documentGroup, file, this.uploadOptions(body), documentId); }
    versions(req, id, documentId) { return this.service.documentVersions(id, req.portalAccount.id, documentId); }
    delete(req, id, documentId, body) {
        if (body && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'expectedRevision')))
            throw new common_1.BadRequestException('Thông tin xóa tệp không hợp lệ.');
        return this.service.deleteDocument(id, req.portalAccount.id, documentId, body?.expectedRevision);
    }
    async download(req, id, documentId) { return downloadResponse(await this.service.download(id, documentId, req.portalAccount.id)); }
    submit(req, id, body) { return this.service.submit(id, req.portalAccount.id, body); }
};
exports.PortalRequestsController = PortalRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('form-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "config", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "one", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "status", null);
__decorate([
    (0, common_1.Get)(':id/checklist'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "checklist", null);
__decorate([
    (0, common_1.Get)(':id/readiness'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "readiness", null);
__decorate([
    (0, common_1.Get)(':id/intake-cycle'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "cycle", null);
__decorate([
    (0, common_1.Post)(':id/request-correction'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "correction", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "documentHeads", null);
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4, fieldSize: 16 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/documents/:documentId/replace'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4, fieldSize: 16 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('documentId')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "replace", null);
__decorate([
    (0, common_1.Get)(':id/documents/:documentId/versions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "versions", null);
__decorate([
    (0, common_1.Delete)(':id/documents/:documentId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('documentId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(':id/documents/:documentId/download'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PortalRequestsController.prototype, "download", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalRequestsController.prototype, "submit", null);
exports.PortalRequestsController = PortalRequestsController = __decorate([
    (0, common_1.Controller)('portal/requests'),
    (0, common_1.UseGuards)(portal_auth_1.PortalGuard),
    __metadata("design:paramtypes", [portal_service_1.PortalService])
], PortalRequestsController);
let PortalIntakesController = class PortalIntakesController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req) { return this.service.list(undefined, req.user); }
    officers() { return this.service.officers(); }
    config() { return this.service.formConfig(); }
    assign(req, id, body) { return this.service.assign(id, body, req.user.id); }
    history(req, id) { return this.service.assignmentHistory(id, req.user); }
    one(req, id) { return this.service.one(id, undefined, req.user); }
    match(req, id) { return this.service.companyMatch(id, req.user); }
    cycle(req, id) { return this.service.intakeCycle(id, undefined, req.user); }
    review(req, id, body) { return this.service.reviewIntake(id, body, req.user); }
    returnCorrection(req, id, body) { return this.service.returnIntake(id, body, req.user); }
    correctionDecision(req, id, body) { return this.service.decideIntakeCorrection(id, body, req.user); }
    reconciliation(req, id, body) { return this.service.requestCompanyReconciliation(id, body, req.user); }
    resolveReconciliation(req, id, body) { return this.service.resolveCompanyReconciliation(id, body, req.user); }
    issue(req, id, body) { return this.service.intakeIssue(id, body, req.user); }
    async download(req, id, documentId) { return downloadResponse(await this.service.download(id, documentId, undefined, req.user)); }
    accept(req, id, body) {
        if (body && (Object.keys(body).some(k => !['confirmExistingCompany', 'confirmExistingCompanyFinancials', 'expectedRevision', 'submissionId'].includes(k)) || ['confirmExistingCompany', 'confirmExistingCompanyFinancials'].some(k => body[k] !== undefined && typeof body[k] !== 'boolean')))
            throw new common_1.BadRequestException('Thông tin xác nhận không hợp lệ.');
        return this.service.accept(id, req.user.id, body?.confirmExistingCompany === true, body?.confirmExistingCompanyFinancials === true, body?.expectedRevision, body?.submissionId);
    }
};
exports.PortalIntakesController = PortalIntakesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('officers'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.QUAN_LY),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "officers", null);
__decorate([
    (0, common_1.Get)('form-config'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.QUAN_LY, client_1.RoleCode.THAM_QUYEN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "config", null);
__decorate([
    (0, common_1.Post)(':id/assign'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.QUAN_LY),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "assign", null);
__decorate([
    (0, common_1.Get)(':id/assignment-history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "history", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "one", null);
__decorate([
    (0, common_1.Get)(':id/company-match'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "match", null);
__decorate([
    (0, common_1.Get)(':id/intake-cycle'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "cycle", null);
__decorate([
    (0, common_1.Post)(':id/review'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "review", null);
__decorate([
    (0, common_1.Post)(':id/return-correction'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "returnCorrection", null);
__decorate([
    (0, common_1.Post)(':id/correction-decision'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "correctionDecision", null);
__decorate([
    (0, common_1.Post)(':id/company-reconciliation'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "reconciliation", null);
__decorate([
    (0, common_1.Post)(':id/company-reconciliation/resolve'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.QUAN_LY),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "resolveReconciliation", null);
__decorate([
    (0, common_1.Post)(':id/issues'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.QUAN_LY),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "issue", null);
__decorate([
    (0, common_1.Get)(':id/documents/:documentId/download'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PortalIntakesController.prototype, "download", null);
__decorate([
    (0, common_1.Post)(':id/accept'),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PortalIntakesController.prototype, "accept", null);
exports.PortalIntakesController = PortalIntakesController = __decorate([
    (0, common_1.Controller)('portal-intakes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleCode.CBTD, client_1.RoleCode.QUAN_LY),
    __metadata("design:paramtypes", [portal_service_1.PortalService])
], PortalIntakesController);
//# sourceMappingURL=portal.controller.js.map