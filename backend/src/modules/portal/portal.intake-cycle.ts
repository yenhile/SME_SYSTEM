import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sameJson, type SubmissionSnapshot } from './portal.snapshot';

export type ReviewItem = { id: string; label: string; group: string; documentIds: string[]; fingerprint: string; guidance?: string; reviewCriteria?: string[] };
export type IntakeReview = ReviewItem & { decision: 'ACCEPTED' | 'NEEDS_CORRECTION'; message: string; reviewerId: string; reviewedAt: string; carriedFrom?: string };
export const intakeCycleEnabled = () => process.env.PORTAL_V2_INTAKE_ENABLED === 'true' && process.env.PORTAL_FOUNDATION_PREVIEW === 'true' && ['development','test'].includes(process.env.NODE_ENV??'');
export const isIntakeEditable = (r: { formVersion?: number; status: string }) => r.status === 'DRAFT' || (r.formVersion === 2 && r.status === 'RETURNED');

const dependencies: Record<string, string[]> = {
  A: ['representativeName','representative','establishedYear','address','companyType'],
  B: ['annualRevenue','annualRevenueBasis','revenuePeriod','charterCapital','establishedYear'],
  C: ['businessScope','industry','loanPurpose','capitalPlan'],
  D: ['loanType','loanPurpose','proposedAmount','loanTermMonths','capitalPlan','neededAt'],
  E: ['collateral'], F: ['hasExistingDebt'],
};
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
}
export const intakeDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

/** The server derives evidence and dependencies; the browser cannot supply a verification fingerprint. */
export function intakeChecklist(snapshot: Pick<SubmissionSnapshot, 'data' | 'documents' | 'checklist'>): ReviewItem[] {
  return snapshot.checklist.filter(i => i.required && i.applies && i.due).map(item => {
    const accepted = [item.documentTypeCode, ...(item.alternatives ?? [])];
    const documents = snapshot.documents.filter(d => d.documentGroup === item.group && d.coverage?.some((c: any) =>
      accepted.includes(c.documentTypeCode) && (!item.periods || item.periods.includes(c.period)) && (!(item as any).component || c.components?.includes((item as any).component))));
    const fields = ['taxCode','companyName',...(dependencies[item.group] ?? [])];
    const data = Object.fromEntries(fields.map(key => [key, snapshot.data[key] ?? null]));
    const evidence = documents.map(d => ({ id: d.id, sha256: d.sha256, coverage: d.coverage })).sort((a,b) => a.id.localeCompare(b.id));
    return { id: item.id, label: (item as any).label ?? item.id, group: item.group, documentIds: evidence.map(d => d.id),
      guidance: (item as any).guidance, reviewCriteria: (item as any).reviewCriteria,
      fingerprint: intakeDigest({item, data, evidence}) };
  });
}
export function carryReviews(previous: IntakeReview[], next: ReviewItem[], submissionId?: string): IntakeReview[] {
  return previous.filter(r => r.decision === 'ACCEPTED' && next.some(i => i.id === r.id && i.fingerprint === r.fingerprint))
    .map(r => ({...structuredClone(r), ...(submissionId ? {carriedFrom: submissionId} : {})}));
}
export function assertReviewsComplete(items: ReviewItem[], reviews: IntakeReview[]) {
  if (!items.length || items.some(i => !i.documentIds.length || !reviews.some(r => r.id === i.id && r.fingerprint === i.fingerprint && r.decision === 'ACCEPTED')))
    throw new ConflictException('Các mục bắt buộc chưa được CBTD kiểm tra đạt trên đúng lần gửi.');
}
export function submissionChanges(previous: Pick<SubmissionSnapshot,'data'|'documents'> | null, next: Pick<SubmissionSnapshot,'data'|'documents'>) {
  const a = previous?.data ?? {}, b = next.data;
  return { fields: [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k => !sameJson(a[k] ?? null, b[k] ?? null)).sort(),
    addedDocuments: next.documents.filter(d => !previous?.documents.some(p => p.id === d.id)).map(d => d.id),
    removedDocuments: (previous?.documents ?? []).filter(d => !next.documents.some(n => n.id === d.id)).map(d => d.id) };
}
export function approvedCompanyDifferences(data:Record<string,any>,company:Record<string,any>) {
  const numeric=['establishedYear','annualRevenue','charterCapital'];
  return ['taxCode','companyName','industry',...numeric,'representativeName','phone','address'].filter(k=>
    numeric.includes(k)?Number(company[k])!==data[k]:company[k]!==data[k]);
}
