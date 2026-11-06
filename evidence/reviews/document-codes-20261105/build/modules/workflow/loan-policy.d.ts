export declare const BRANCH_POLICY = "SME_BRANCH_20261031_V1";
export declare const BRANCH_LIMIT = 10000000000;
export declare const BRANCH_LIMIT_MESSAGE = "C\u1ED5ng n\u00E0y ti\u1EBFp nh\u1EADn \u0111\u1EC1 ngh\u1ECB vay t\u1ED1i \u0111a 10 t\u1EF7 \u0111\u1ED3ng. V\u1EDBi nhu c\u1EA7u cao h\u01A1n, vui l\u00F2ng li\u00EAn h\u1EC7 ng\u00E2n h\u00E0ng \u0111\u1EC3 \u0111\u01B0\u1EE3c h\u01B0\u1EDBng d\u1EABn.";
export declare function assertBranchAmount(value: unknown): void;
export type LoanActor = {
    id: string;
    activeRole: string;
};
export declare function assertLoanWrite(tx: any, loan: any, actor: LoanActor, receptionOnly?: boolean): Promise<void>;
export declare function lockOfficer(tx: any, id: string): Promise<void>;
