import { LoanType } from '@prisma/client';
export declare class CreateLoanDto {
    taxCode: string;
    companyName: string;
    industry: string;
    establishedYear: number;
    annualRevenue: number;
    charterCapital: number;
    representativeName: string;
    phone: string;
    address: string;
    loanPurpose: string;
    loanType: LoanType;
    proposedAmount: number;
    loanTermMonths: number;
    assignedTo?: string;
}
