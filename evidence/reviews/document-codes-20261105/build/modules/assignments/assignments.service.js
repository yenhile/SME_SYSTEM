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
var AssignmentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentsService = void 0;
const assignment_transactions_1 = require("./assignment.transactions");
const officer_workloads_1 = require("./officer-workloads");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const prediction_service_1 = require("../prediction/prediction.service");
let AssignmentsService = AssignmentsService_1 = class AssignmentsService {
    prisma;
    predictionService;
    logger = new common_1.Logger(AssignmentsService_1.name);
    constructor(prisma, predictionService) {
        this.prisma = prisma;
        this.predictionService = predictionService;
    }
    getOfficerWorkloads() { return (0, officer_workloads_1.officerWorkloads)(this.prisma); }
    async getAssignmentHistory(applicationId) {
        return this.prisma.applicationAssignment.findMany({
            where: { applicationId },
            include: {
                fromUser: { select: { id: true, fullName: true, username: true } },
                toUser: { select: { id: true, fullName: true, username: true } },
                manager: { select: { id: true, fullName: true, username: true } },
            },
            orderBy: { reassignedAt: 'desc' },
        });
    }
    async reassign(applicationId, dto, managerId) {
        const result = await this.prisma.$transaction(tx => (0, assignment_transactions_1.transferLoan)(tx, applicationId, dto, managerId));
        const prediction = await (0, assignment_transactions_1.assignmentPrediction)(this.predictionService, applicationId, result.replayed);
        return { assignment: result.assignmentRecord, loan: result.updatedLoan, replayed: result.replayed, prediction };
    }
};
exports.AssignmentsService = AssignmentsService;
exports.AssignmentsService = AssignmentsService = AssignmentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        prediction_service_1.PredictionService])
], AssignmentsService);
//# sourceMappingURL=assignments.service.js.map