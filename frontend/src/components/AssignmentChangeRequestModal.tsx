import {AssignmentChangeRequestPanel} from './AssignmentChangeRequestPanel';
export function AssignmentChangeRequestModal({id,onClose,onChanged,onOpenCase}:{id:string;onClose:()=>void;onChanged:()=>void;onOpenCase:(subject:{type:'LOAN'|'PORTAL';id:string})=>void}){
  return <div className="modal-overlay"><div className="modal-content" role="dialog" aria-label="Biên nhận điều phối"><div className="modal-header"><h3>Biên nhận đề nghị điều phối</h3><button className="btn btn-secondary" onClick={onClose}>Đóng biên nhận</button></div><div className="modal-body"><AssignmentChangeRequestPanel requestId={id} onChanged={onChanged} onOpenCase={onOpenCase}/></div></div></div>;
}
