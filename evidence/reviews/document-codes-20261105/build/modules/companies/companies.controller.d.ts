import { CompaniesService } from './companies.service';
export declare class CompaniesController {
    private companiesService;
    constructor(companiesService: CompaniesService);
    checkTaxCode(taxCode: string, user: any): Promise<{
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
    findAll(user: any, keyword?: string): Promise<{
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
    upsert(body: any, user: any): Promise<{
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
