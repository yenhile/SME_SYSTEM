export const COMPANY_FIELDS = ['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address'] as const;
export function companySnapshot(company: Record<string, any>): Record<string, any> {
  return {...Object.fromEntries(COMPANY_FIELDS.map(k=>[k,['annualRevenue','charterCapital'].includes(k)?String(company[k]):company[k]])),
    ...(company.id?{id:company.id}:{}),...(company.createdAt?{createdAt:new Date(company.createdAt).toISOString()}:{}),...(company.updatedAt?{updatedAt:new Date(company.updatedAt).toISOString()}:{} )};
}
export function companyForLoan(loan: any, fallback?: any) {
  return {...(fallback??loan.company),...(loan.companySnapshot??{})};
}
export function withLoanCompany<T>(loan:T):T {
  return {...loan,company:companyForLoan(loan)};
}
/** Shared by intake and Company writers; always acquire before reading/writing Company. */
export async function lockCompany(tx:any,taxCode:string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${taxCode}))::text`;
}
/** Preserve pre-change values for legacy loans before a scoped reconciliation. */
export async function freezeCompanyLoans(tx:any,company:any) {
  const snapshot=JSON.stringify(companySnapshot(company));
  await tx.$executeRaw`UPDATE loan_applications SET company_snapshot=${snapshot}::jsonb WHERE company_id=${company.id} AND company_snapshot IS NULL`;
}
