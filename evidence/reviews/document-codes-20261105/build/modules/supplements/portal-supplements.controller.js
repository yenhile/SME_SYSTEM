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
exports.PortalSupplementsController = exports.supplementDownload = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const portal_auth_1 = require("../portal/portal.auth");
const portal_supplements_service_1 = require("./portal-supplements.service");
const supplementDownload = (result) => new common_1.StreamableFile(result.buffer, { type: 'application/octet-stream', disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}` });
exports.supplementDownload = supplementDownload;
let PortalSupplementsController = class PortalSupplementsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(requestId, req) { return this.service.list(requestId, req.portalAccount.id); }
    respond(requestId, id, req, body) { return this.service.respond(requestId, req.portalAccount.id, id, body); }
    upload(requestId, id, itemId, req, body, file) { return this.service.upload(requestId, req.portalAccount.id, id, itemId, file, body); }
    async download(requestId, id, fileId, req) { return (0, exports.supplementDownload)(await this.service.download(id, fileId, { requestId, accountId: req.portalAccount.id })); }
};
exports.PortalSupplementsController = PortalSupplementsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('requestId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PortalSupplementsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':supplementId/respond'),
    __param(0, (0, common_1.Param)('requestId')),
    __param(1, (0, common_1.Param)('supplementId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], PortalSupplementsController.prototype, "respond", null);
__decorate([
    (0, common_1.Post)(':supplementId/items/:itemId/files'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 16 * 1024 } })),
    __param(0, (0, common_1.Param)('requestId')),
    __param(1, (0, common_1.Param)('supplementId')),
    __param(2, (0, common_1.Param)('itemId')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Body)()),
    __param(5, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], PortalSupplementsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(':supplementId/files/:fileId/download'),
    __param(0, (0, common_1.Param)('requestId')),
    __param(1, (0, common_1.Param)('supplementId')),
    __param(2, (0, common_1.Param)('fileId')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], PortalSupplementsController.prototype, "download", null);
exports.PortalSupplementsController = PortalSupplementsController = __decorate([
    (0, common_1.Controller)('portal/requests/:requestId/supplements'),
    (0, common_1.UseGuards)(portal_auth_1.PortalGuard),
    __metadata("design:paramtypes", [portal_supplements_service_1.PortalSupplementsService])
], PortalSupplementsController);
//# sourceMappingURL=portal-supplements.controller.js.map