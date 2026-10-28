import type {PortalRequest,PortalFormConfig} from './model';
export function canEditCycle(request:PortalRequest|null,config:PortalFormConfig) {
  if(!config.previewEnabled)return false;
  if(!request)return true;
  if(request.status==='RETURNED')return request.formVersion===2&&config.intakeCycleEnabled===true;
  return request.status==='DRAFT'&&request.checklistVersion===config.checklistVersion;
}
export function canSendCycle(s:{enabled:boolean;editable:boolean;dirty:boolean;busy:boolean;conflict:boolean;pendingFiles:number;dataReady:boolean;assessmentRevision?:number;revision?:number}) {
  return s.enabled&&s.editable&&!s.dirty&&!s.busy&&!s.conflict&&s.pendingFiles===0&&s.dataReady&&s.assessmentRevision===s.revision;
}
