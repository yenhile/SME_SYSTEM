import { PrismaService } from '../../prisma.service';
export declare class CompaniesService {
    private prisma;
    constructor(prisma: PrismaService);
    private isOfficer;
    checkTaxCode(taxCode: string, user?: {
        id: string;
        activeRole?: string;
    }): Promise<{
        found: boolean;
        company: null;
        restricted?: undefined;
    } | {
        found: boolean;
        restricted: boolean;
        company: null;
    } | {
        found: boolean;
        company: {
            loans: {
                id: string;
                createdAt: Date;
                applicationCode: string;
                proposedAmount: import("@prisma/client/runtime/library").Decimal;
                currentStatus: import(".prisma/client").$Enums.LoanStatus;
            }[];
        } & {
            id: string;
            createdAt: Date;
            taxCode: string;
            companyName: string;
            industry: string;
            establishedYear: number;
            annualRevenue: import("@prisma/client/runtime/library").Decimal;
            charterCapital: import("@prisma/client/runtime/library").Decimal;
            representativeName: string;
            phone: string;
            address: string;
            updatedAt: Date;
        };
        restricted?: undefined;
    }>;
    findAll(user?: {
        id: string;
        activeRole?: string;
    }, keyword?: string): Promise<{
        id: string;
        createdAt: Date;
        taxCode: string;
        companyName: string;
        industry: string;
        establishedYear: number;
        annualRevenue: import("@prisma/client/runtime/library").Decimal;
        charterCapital: import("@prisma/client/runtime/library").Decimal;
        representativeName: string;
        phone: string;
        address: string;
        updatedAt: Date;
    }[]>;
    upsert(data: {
        taxCode: string;
        companyName: string;
        industry: string;
        establishedYear: number;
        annualRevenue: number;
        charterCapital: number;
        representativeName: string;
        phone: string;
        address: string;
    }, user?: {
        id: string;
        activeRole?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        taxCode: string;
        companyName: string;
        industry: string;
        establishedYear: number;
        annualRevenue: import("@prisma/client/runtime/library").Decimal;
        charterCapital: import("@prisma/client/runtime/library").Decimal;
        representativeName: string;
        phone: string;
        address: string;
        updatedAt: Date;
    }>;
}
