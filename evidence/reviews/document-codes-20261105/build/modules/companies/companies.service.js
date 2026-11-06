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
exports.CompaniesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const company_access_1 = require("./company-access");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const company_snapshot_1 = require("./company-snapshot");
let CompaniesService = class CompaniesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isOfficer(user) {
        return user?.activeRole === 'CBTD';
    }
    async checkTaxCode(taxCode, user) {
        const officer = this.isOfficer(user);
        const company = await this.prisma.company.findUnique({
            where: { taxCode },
            include: {
                loans: {
                    ...(officer ? { where: { assignedTo: user.id } } : {}),
                    select: {
                        id: true,
                        applicationCode: true,
                        proposedAmount: true,
                        currentStatus: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                },
            },
        });
        if (!company) {
            return { found: false, company: null };
        }
        if (officer && company.loans.length === 0) {
            return { found: true, restricted: true, company: null };
        }
        return { found: true, company };
    }
    async findAll(user, keyword) {
        const conditions = [];
        if (this.isOfficer(user))
            conditions.push({ loans: { some: { assignedTo: user.id } } });
        if (keyword) {
            conditions.push({
                OR: [
                    { companyName: { contains: keyword, mode: 'insensitive' } },
                    { taxCode: { contains: keyword } },
                ],
            });
        }
        return this.prisma.company.findMany({
            where: conditions.length ? { AND: conditions } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    async upsert(data, user) {
        return this.prisma.$transaction(async (tx) => {
            if (user?.id)
                await (0, assignment_coordination_1.assertNoCompanyConflict)(tx, user.id, data.taxCode);
            await (0, company_snapshot_1.lockCompany)(tx, data.taxCode);
            if (this.isOfficer(user))
                await (0, company_access_1.assertOfficerMayWriteCompany)(tx, data.taxCode, user.id);
            return tx.company.upsert({
                where: { taxCode: data.taxCode },
                update: {
                    companyName: data.companyName,
                    industry: data.industry,
                    establishedYear: data.establishedYear,
                    annualRevenue: data.annualRevenue,
                    charterCapital: data.charterCapital,
                    representativeName: data.representativeName,
                    phone: data.phone,
                    address: data.address,
                },
                create: data,
            });
        });
    }
};
exports.CompaniesService = CompaniesService;
exports.CompaniesService = CompaniesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompaniesService);
//# sourceMappingURL=companies.service.js.map