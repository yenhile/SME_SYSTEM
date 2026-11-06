import {useEffect,useState} from 'react';
import {api} from '../api/client';
import {AssignmentChangeRequestPanel,coordinationStatus,type CoordinationReceipt} from './AssignmentChangeRequestPanel';
export function AssignmentChangeRequestsView({onChanged,onOpenCase}:{onChanged?:()=>void|Promise<void>;onOpenCase?:(subject:{type:'LOAN'|'PORTAL';id:string})=>void}){
  const [rows,setRows]=useState<CoordinationReceipt[]>([]),[status,setStatus]=useState('PENDING'),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;api.get<CoordinationReceipt[]>(`/assignment-change-requests${status?'?status='+status:''}`).then(r=>{if(live){setRows(r);setError('');}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[status,revision]);
  return <section className="coordination-queue card" aria-label="Danh sách đề nghị điều phối"><div className="portal-section-heading"><h3>Đề nghị điều phối chờ quản lý</h3><button className="btn btn-secondary" onClick={()=>setRevision(x=>x+1)}>Làm mới điều phối</button></div>
    <label>Trạng thái điều phối<select aria-label="Lọc đề nghị điều phối" value={status} onChange={e=>{setStatus(e.target.value);setSelected(null);}}><option value="">Tất cả</option>{Object.entries(coordinationStatus).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
    {error&&<p role="alert" className="error-message">{error}</p>}<p>{rows.length} đề nghị · Xung đột lợi ích đang chờ được ưu tiên trước, sau đó theo thời gian gửi.</p>
    <div className="data-table-container"><table className="data-table"><thead><tr><th>Đề nghị/hồ sơ</th><th>Người gửi</th><th>Thời điểm gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.subjectCode}{row.reasonCode==='CONFLICT_OF_INTEREST'&&' · Ưu tiên xung đột lợi ích'}</td><td>{row.requester?.fullName||row.requester?.username}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td>{coordinationStatus[row.status]}</td><td><button className="btn btn-secondary" onClick={()=>setSelected(row.id)}>Xem điều phối</button></td></tr>)}</tbody></table></div>
    {selected&&<AssignmentChangeRequestPanel key={selected} requestId={selected} onOpenCase={onOpenCase} onChanged={async()=>{setRevision(x=>x+1);await onChanged?.();}}/>}
  </section>;
}
