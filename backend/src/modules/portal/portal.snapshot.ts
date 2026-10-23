import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PortalPolicy, ResolvedPolicyRequirement } from './portal.policy';

export function sameJson(a: unknown,b: unknown): boolean {return canonical(a)===canonical(b);}
function canonical(value: unknown): string {
  const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])])):v;
  return JSON.stringify(sort(value));
}
export type SnapshotDocument={id:string;documentGroup:string;fileName:string;fileSize:number;mimeType:string;uploadedAt:string;coverage:any;version:number;contentHash:string|null;sha256:string};
export type SubmissionSnapshot={snapshotVersion:2;requestId:string;formVersion:2;checklistVersion:string;revision:number;submittedAt:string;data:any;policy:PortalPolicy;checklist:ResolvedPolicyRequirement[];documents:SnapshotDocument[];audit:{event:string;actorAccountId:string;requestId:string;at:string};integrity:string};
export function createV2Snapshot(request:any,policy:PortalPolicy,checklist:ResolvedPolicyRequirement[],documents:any[],now:Date):SubmissionSnapshot {
  const core={snapshotVersion:2 as const,requestId:request.id,formVersion:2 as const,checklistVersion:policy.version,revision:request.revision,submittedAt:now.toISOString(),data:request.data,policy,checklist,
    documents:documents.map(d=>({id:d.id,documentGroup:d.documentGroup,fileName:d.fileName,fileSize:d.fileSize,mimeType:d.mimeType,uploadedAt:new Date(d.uploadedAt).toISOString(),coverage:d.coverage,version:d.version,contentHash:d.contentHash??null,sha256:d.sha256})),
    audit:{event:'PORTAL_REQUEST_SUBMITTED',actorAccountId:request.accountId,requestId:request.id,at:now.toISOString()}};
  const copy=JSON.parse(JSON.stringify(core));
  return {...copy,integrity:createHash('sha256').update(canonical(copy)).digest('hex')};
}
export function readV2Snapshot(request:any):SubmissionSnapshot {
  const s=request.checklistSnapshot as SubmissionSnapshot;
  const fail=()=>{throw new ConflictException('Snapshot đề nghị không đồng nhất. Chưa thể tiếp nhận; cần kiểm tra dữ liệu.');};
  if(!s || s.snapshotVersion!==2 || s.formVersion!==2 || s.requestId!==request.id || s.revision!==request.revision || s.checklistVersion!==request.checklistVersion
    || !s.policy || s.policy.version!==s.checklistVersion || !Array.isArray(s.documents) || s.documents.some(d=>!d || typeof d.id!=='string' || !d.id) || new Set(s.documents.map(d=>d.id)).size!==s.documents.length
    || !s.audit || s.audit.actorAccountId!==request.accountId || !sameJson(s.data,request.data)) return fail();
  const {integrity,...core}=s;
  if(typeof integrity!=='string' || createHash('sha256').update(canonical(core)).digest('hex')!==integrity
    || !request.submittedAt || new Date(request.submittedAt).toISOString()!==s.submittedAt) return fail();
  return s;
}
