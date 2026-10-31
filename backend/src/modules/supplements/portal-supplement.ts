import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validateCoverage } from '../portal/portal.foundation';

export type SupplementMetadata = { version:1; revision:number; createId:string; createHash:string; items:any[]; files:any[]; responses:any[]; events:any[]; operations:any[] };
export function uuid(value:unknown): asserts value is string {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('Cần mã thao tác UUID hợp lệ.');
}
export function createMetadata(items:any[],clientRequestId:string):SupplementMetadata {
  uuid(clientRequestId);
  if(!Array.isArray(items) || !items.length || items.length>60) throw new BadRequestException('Cần 1 đến 60 mục bổ sung.');
  const seen=new Set<string>();
  const result=items.map(input=> {
    if(!input || Object.keys(input).some(k=>!['documentGroup','documentTypeCode','period','reason'].includes(k))) throw new BadRequestException('Mục bổ sung không hợp lệ.');
    validateCoverage(input.documentGroup,[{documentTypeCode:input.documentTypeCode,...(input.period===undefined?{}:{period:input.period})}]);
    if(typeof input.reason!=='string' || !input.reason.trim() || input.reason.length>2000) throw new BadRequestException('Cần lý do bổ sung.');
    const key=JSON.stringify([input.documentGroup,input.documentTypeCode,input.period]);
    if(seen.has(key)) throw new BadRequestException('Mục bổ sung trùng nhau.');seen.add(key);
    return {id:randomUUID(),documentGroup:input.documentGroup,documentTypeCode:input.documentTypeCode,...(input.period===undefined?{}:{period:input.period}),reason:input.reason.trim(),status:'PENDING'};
  });
  return {version:1,revision:0,createId:clientRequestId,createHash:'',items:result,files:[],responses:[],events:[{type:'REQUESTED',at:new Date().toISOString()}],operations:[]};
}
export function metadata(request:any):SupplementMetadata {
  const m=request.portalSupplement;
  if(!m || m.version!==1 || !Array.isArray(m.items)) throw new BadRequestException('Yêu cầu bổ sung này dùng quy trình cũ.');
  return structuredClone(m);
}
export function revision(m:SupplementMetadata,value:unknown) {
  if(!Number.isSafeInteger(value) || value!==m.revision) throw new ConflictException('Dữ liệu đã thay đổi. Vui lòng tải lại.');
}
export function replay(m:SupplementMetadata,id:unknown,kind:string,hash:string) {
  uuid(id);const old=m.operations.find(o=>o.id===id);
  if(old && (old.kind!==kind || old.hash!==hash)) throw new ConflictException('Mã thao tác đã được dùng cho nội dung khác.');
  return !!old;
}
export function heads(m:SupplementMetadata) {const superseded=new Set(m.files.map(f=>f.supersedesId).filter(Boolean));return m.files.filter(f=>!superseded.has(f.id));}
export function respond(m:SupplementMetadata,documentIds:unknown) {
  if(!Array.isArray(documentIds) || documentIds.some(id=>typeof id!=='string') || new Set(documentIds).size!==documentIds.length) throw new BadRequestException('Danh sách tệp không hợp lệ.');
  const pending=m.items.filter(i=>['PENDING','REPLACE_REQUIRED'].includes(i.status));
  const manifest=heads(m).filter(f=>pending.some(i=>i.id===f.itemId) && !f.submittedAt);
  if(!pending.length || pending.some(i=>!manifest.some(f=>f.itemId===i.id)) || JSON.stringify([...documentIds].sort())!==JSON.stringify(manifest.map(f=>f.id).sort())) throw new ConflictException('Cần gửi chính xác tất cả tệp hiện hành của các mục đang chờ bổ sung.');
  const at=new Date().toISOString();for(const f of manifest) f.submittedAt=at;
  for(const i of pending) i.status='SUBMITTED';
  m.responses.push({id:randomUUID(),at,documentIds:[...documentIds]});m.events.push({type:'RESPONDED',at});
}
export function review(m:SupplementMetadata,itemId:string,body:any) {
  const item=m.items.find(i=>i.id===itemId);
  if(!item || item.status!=='SUBMITTED') throw new ConflictException('Chỉ kiểm tra mục đã được doanh nghiệp gửi.');
  if(typeof body.accepted!=='boolean' || typeof body.message!=='string' || body.message.length>2000 || (!body.accepted && !body.message.trim())) throw new BadRequestException('Kết quả hoặc lý do kiểm tra không hợp lệ.');
  const at=new Date().toISOString();item.status=body.accepted?'ACCEPTED':'REPLACE_REQUIRED';item.message=body.message.trim();item.reviewedAt=at;
  m.events.push({type:item.status,at,itemId,message:item.message});
}
/**
 * Bên đang phải hành động trong yêu cầu bổ sung (C.9.2).
 * - ENTERPRISE: còn mục chờ doanh nghiệp (chưa gửi hoặc bị yêu cầu thay). Yêu cầu quy trình cũ (không có danh sách mục) luôn chờ doanh nghiệp.
 * - BANK: doanh nghiệp đã gửi đủ; ngân hàng kiểm tra hoặc hoàn tất. Không được nhắc thiếu hay đóng quá hạn vì lý do này.
 */
export function waitingOn(request:{portalSupplement?:any}):'ENTERPRISE'|'BANK' {
  const items=request.portalSupplement?.items;
  if(!Array.isArray(items) || !items.length) return 'ENTERPRISE';
  return items.some((i:any)=>i.status==='PENDING' || i.status==='REPLACE_REQUIRED') ? 'ENTERPRISE' : 'BANK';
}
export function safeView(r:any) {
  const m=r.portalSupplement;
  const pick=(obj:any,keys:string[])=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
  return {...pick(r,['id','applicationId','requestContent','status','requestedAt','deadlineAt','resolvedAt']),revision:m?.revision??0,
    items:(m?.items??[]).map((i:any)=>pick(i,['id','documentGroup','documentTypeCode','period','reason','status','message','reviewedAt'])),
    files:(m?.files??[]).map((f:any)=>pick(f,['id','itemId','fileName','fileSize','mimeType','version','supersedesId','uploadedAt','submittedAt'])),
    events:(m?.events??[]).map((e:any)=>pick(e,['type','at','itemId','message']))};
}
