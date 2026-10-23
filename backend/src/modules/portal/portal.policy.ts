import { BadRequestException, ConflictException } from '@nestjs/common';
import { getFormConfig, validateCoverage, validateDraftV2 } from './portal.foundation';
import { assessReadiness } from './portal.readiness';

export interface PolicyRequirement {
  id: string;
  group: string;
  documentTypeCode: string;
  required: boolean;
  stage: 'SUBMIT' | 'INTAKE' | 'LATER';
  periods?: string[];
  condition?: { field: string; equals: string | boolean };
  alternatives?: string[];
  deferred?: boolean;
  basis?: string;
}

export interface PortalPolicy {
  readinessVersion?: 'MVP1';
  version: string;
  status: 'APPROVED' | 'TEST_ONLY';
  formVersion: 2;
  requiredFields: string[];
  requirements: PolicyRequirement[];
}

export interface PortalPolicyContext { mode: 'isolated-test'; policy: PortalPolicy }
export type PolicyDocument = {id: string; documentGroup: string; coverage?: unknown; withdrawnAt?: unknown; supersedesId?: string | null};
export type ResolvedPolicyRequirement = PolicyRequirement & {applies: boolean; due: boolean; satisfied: boolean};

function invalidPolicy(): never { throw new BadRequestException('Định nghĩa policy không hợp lệ.'); }
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function safePath(value: unknown): value is string {
  return nonempty(value) && /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(value)
    && !value.split('.').some(part => ['__proto__','prototype','constructor'].includes(part));
}
function atPath(data: unknown, field: string): unknown {
  let value: any = data;
  for (const key of field.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value,key)) return undefined;
    value = value[key];
  }
  return value;
}

/** A policy is data supplied by a trusted caller, never an implicit set of bank rules. */
function validatePolicy(policy: PortalPolicy): void {
  if (!policy || typeof policy !== 'object' || !nonempty(policy.version) || !['APPROVED','TEST_ONLY'].includes(policy.status) || policy.formVersion !== 2
    || !Array.isArray(policy.requiredFields) || policy.requiredFields.some(field => !safePath(field))
    || new Set(policy.requiredFields).size !== policy.requiredFields.length || !Array.isArray(policy.requirements)) invalidPolicy();
  if(policy.readinessVersion!==undefined && policy.readinessVersion!=='MVP1') invalidPolicy();
  const catalog = getFormConfig().groups;
  const ids = new Set<string>();
  for (const item of policy.requirements) {
    if (!item || typeof item !== 'object' || !nonempty(item.id) || ids.has(item.id) || typeof item.required !== 'boolean'
      || !['SUBMIT','INTAKE','LATER'].includes(item.stage)) invalidPolicy();
    ids.add(item.id);
    const codes = catalog.find(group => group.code === item.group)?.documentTypes.map(type => type.code);
    if (!codes?.includes(item.documentTypeCode)) invalidPolicy();
    if (item.periods !== undefined && (!Array.isArray(item.periods) || !item.periods.length || item.periods.some(period => !nonempty(period)) || new Set(item.periods).size !== item.periods.length)) invalidPolicy();
    if (item.periods) for (const period of item.periods) validateCoverage(item.group,[{documentTypeCode:item.documentTypeCode,period}]);
    if (item.alternatives !== undefined && (!Array.isArray(item.alternatives) || item.alternatives.some(code => !codes.includes(code))
      || new Set(item.alternatives).size !== item.alternatives.length)) invalidPolicy();
    if (item.condition !== undefined && (!item.condition || !safePath(item.condition.field) || !['string','boolean'].includes(typeof item.condition.equals))) invalidPolicy();
    if (item.basis !== undefined && !nonempty(item.basis)) invalidPolicy();
    if (item.deferred !== undefined && typeof item.deferred !== 'boolean') invalidPolicy();
    if (item.deferred && (item.stage === 'SUBMIT' || !nonempty(item.basis))) invalidPolicy();
  }
}

export function evaluatePolicy(policy: PortalPolicy, data: unknown, documents: PolicyDocument[], phase: 'SUBMIT' | 'INTAKE'):
  {requirements: ResolvedPolicyRequirement[]; missing: string[]; formErrors: string[]} {
  validatePolicy(policy);
  if (!['SUBMIT','INTAKE'].includes(phase) || !Array.isArray(documents)) invalidPolicy();
  const formErrors: string[] = [];
  try { validateDraftV2(data); }
  catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    formErrors.push(error.message);
  }
  if(policy.readinessVersion==='MVP1') formErrors.push(...assessReadiness((data??{}) as Record<string,any>,documents).issues.map(issue=>issue.message));
  if (phase === 'SUBMIT') for (const field of policy.requiredFields) {
    const value = atPath(data,field);
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)
      || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)) formErrors.push(`Thiếu thông tin: ${field}`);
  }
  const ids = new Set<string>();
  for (const document of documents) {
    if (!document || !nonempty(document.id) || ids.has(document.id)) throw new BadRequestException('Danh sách tài liệu không hợp lệ.');
    ids.add(document.id);
  }
  const superseded = new Set(documents.map(document => document.supersedesId).filter(Boolean));
  const coverage = documents.filter(document => !document.withdrawnAt && !superseded.has(document.id))
    .flatMap(document => validateCoverage(document.documentGroup, document.coverage).map(item => ({...item,group:document.documentGroup})));
  const missing: string[] = [];
  const requirements = policy.requirements.map(item => {
    if (item.required && item.condition && atPath(data,item.condition.field) === undefined) {
      const message = `Thiếu thông tin điều kiện: ${item.condition.field}`;
      if (!formErrors.includes(message)) formErrors.push(message);
    }
    const applies = item.condition === undefined || atPath(data,item.condition.field) === item.condition.equals;
    const due = item.stage === 'SUBMIT' || (phase === 'INTAKE' && item.stage === 'INTAKE');
    const accepted = [item.documentTypeCode,...(item.alternatives || [])];
    const periods: (string | undefined)[] = item.periods || [undefined];
    const unmet = periods.filter(period => !coverage.some(entry => entry.group === item.group && accepted.includes(entry.documentTypeCode)
      && (period === undefined || entry.period === period)));
    if (item.required && applies && due) for (const period of unmet) missing.push(period === undefined ? item.id : `${item.id}:${period}`);
    return {...structuredClone(item), applies, due, satisfied:unmet.length === 0};
  });
  return {requirements,missing,formErrors};
}

/** Environment flags alone never activate V2. There is no approved production registry. */
export function resolveTestPolicy(context?: PortalPolicyContext): PortalPolicy {
  const unavailable = () => { throw new ConflictException('Chờ chốt chính sách V2. Submit/Accept chỉ khả dụng với policy test trong môi trường cách ly.'); };
  if (process.env.NODE_ENV !== 'test' || process.env.PORTAL_V2_SUBMIT_ENABLED !== 'true' || context?.mode !== 'isolated-test'
    || context.policy?.status !== 'TEST_ONLY' || !context.policy?.version?.startsWith('TEST-')) return unavailable();
  let target: URL;
  try { target = new URL(process.env.DATABASE_URL || ''); } catch { return unavailable(); }
  if (!['postgres:','postgresql:'].includes(target.protocol) || !['localhost','127.0.0.1'].includes(target.hostname)
    || target.pathname !== '/sme_loan' || target.searchParams.getAll('schema').length !== 1
    || !/^portal_v2_it_[a-z0-9_]+$/.test(target.searchParams.get('schema') || '')) return unavailable();
  validatePolicy(context.policy);
  return structuredClone(context.policy);
}
