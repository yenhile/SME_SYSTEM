import { AlertCircle, CheckCircle2, ClipboardList, FileText, XCircle } from 'lucide-react';
import { groups } from './model';
import { summarizeHome, type HomeOutcome, type HomeRequest } from './home';

/** Trang chủ doanh nghiệp: việc cần làm ngay, kết quả cuối cùng của hồ sơ và hướng dẫn chuẩn bị giấy tờ. */
export function PortalHome({ contactName, requests, supplementCounts, outcomes, outcomesFailed, onOpen }: {
  contactName: string; requests: HomeRequest[]; supplementCounts: Record<string, number>;
  outcomes: Record<string, HomeOutcome | undefined>; outcomesFailed: boolean; onOpen: (requestId: string) => void;
}) {
  const { actions, results } = summarizeHome(requests, supplementCounts, outcomes);
  return <section className="portal-home" aria-label="Trang chủ doanh nghiệp">
    <p className="portal-home-greeting">Xin chào <strong>{contactName}</strong>. Dưới đây là những việc cần chú ý và kết quả mới nhất từ ngân hàng.</p>
    <div className="portal-home-grid">
      <section className="portal-card portal-home-card" aria-label="Việc cần làm ngay">
        <div className="portal-card-title"><AlertCircle size={20} /><div><h2>Việc cần làm ngay</h2><p>Các đề nghị đang chờ doanh nghiệp xử lý.</p></div></div>
        {actions.length === 0 ? <p className="portal-home-empty">Hiện không có việc nào đang chờ doanh nghiệp.</p> :
          <ul className="portal-home-list">{actions.map(action => <li key={`${action.kind}-${action.requestId}`}>
            <button type="button" className="portal-link" onClick={() => onOpen(action.requestId)}>{action.reference}</button><span>{action.text}</span>
          </li>)}</ul>}
      </section>
      <section className="portal-card portal-home-card" aria-label="Kết quả hồ sơ">
        <div className="portal-card-title"><ClipboardList size={20} /><div><h2>Kết quả hồ sơ</h2><p>Quyết định cuối cùng sau thẩm định.</p></div></div>
        {outcomesFailed && <p role="alert" className="portal-error">Chưa tải được kết quả của một số hồ sơ. Bấm Làm mới để thử lại.</p>}
        {results.length === 0 ? <p className="portal-home-empty">Chưa có hồ sơ nào có quyết định cuối cùng.</p> :
          <ul className="portal-home-list">{results.map(result => <li key={result.requestId} className={`portal-home-result result-${result.code.toLowerCase()}`}>
            {result.code === 'APPROVED' ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
            <div><button type="button" className="portal-link" onClick={() => onOpen(result.requestId)}>{result.reference}</button> · <span>{result.company}</span>
              <strong className="portal-home-result-label">{result.label}</strong><small>{result.detail}</small></div>
          </li>)}</ul>}
      </section>
    </div>
    <section className="portal-card portal-home-card" aria-label="Chuẩn bị hồ sơ">
      <div className="portal-card-title"><FileText size={20} /><div><h2>Chuẩn bị giấy tờ trước khi gửi</h2><p>Hồ sơ gồm 6 nhóm tài liệu; hoàn tất đủ các nhóm trước khi gửi để ngân hàng tiếp nhận nhanh hơn.</p></div></div>
      <ul className="portal-home-guide">{groups.map(group => <li key={group.code}><strong>{group.code}. {group.name}</strong><span>{group.description}</span></li>)}</ul>
    </section>
  </section>;
}
