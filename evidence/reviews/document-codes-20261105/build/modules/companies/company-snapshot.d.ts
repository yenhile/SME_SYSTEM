export declare const COMPANY_FIELDS: readonly ["taxCode", "companyName", "industry", "establishedYear", "annualRevenue", "charterCapital", "representativeName", "phone", "address"];
export declare function companySnapshot(company: Record<string, any>): Record<string, any>;
export declare function companyForLoan(loan: any, fallback?: any): any;
export declare function withLoanCompany<T>(loan: T): T;
export declare function lockCompany(tx: any, taxCode: string): Promise<void>;
export declare function freezeCompanyLoans(tx: any, company: any): Promise<void>;
