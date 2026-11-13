import { AlertCircle, CheckCircle2, ChevronRight, ClipboardCheck, FilePlus2, FileText, Plus, Search, Send, XCircle } from 'lucide-react';
import { groups } from './model';
import { summarizeHome, type HomeOutcome, type HomeRequest } from './home';

const DRAFT_PREVIEW = 3;

const STEPS = [
  { icon: FileText, title: 'Chuẩn bị giấy tờ', text: 'Gom đủ 6 nhóm tài liệu: pháp lý, tài chính, phương án vốn, tài sản bảo đảm…' },
  { icon: FilePlus2, title: 'Khai đề nghị theo 5 bước', text: 'Thông tin doanh nghiệp, nhu cầu vay, phương án vốn, tải tài liệu và rà soát.' },
  { icon: Send, title: 'Gửi và theo dõi', text: 'Ngân hàng tiếp nhận, có thể yêu cầu bổ sung; kết quả hiện ngay trên cổng.' },
] as const;

/** Sáu nhóm giấy tờ cần chuẩn bị trước khi gửi đề nghị. */
export function PortalDocumentGuide({ open = false }: { open?: boolean }) {
  return <details className="portal-card portal-guide" open={open}>
    <summary><ClipboardCheck size={18} aria-hidden="true" /><span>Hướng dẫn chuẩn bị giấy tờ</span><small>6 nhóm tài liệu cần có trước khi gửi</small></summary>
    <ul className="portal-home-guide">{groups.map(group => <li key={group.code}><strong>{group.code}. {group.name}</strong><span>{group.description}</span></li>)}</ul>
  </details>;
}

/**
 * Phần đầu trang chủ doanh nghiệp. Chưa có đề nghị: hướng dẫn 3 bước và nút tạo đề nghị đầu tiên.
 * Đã có đề nghị: việc doanh nghiệp phải làm (chỉnh sửa, bổ sung, bản nháp) và kết quả cuối cùng nếu có.
 */
export function PortalHome({ requests, supplementCounts, outcomes, outcomesFailed, canCreate, onCreate, onOpen, onShowDrafts }: {
  requests: HomeRequest[]; supplementCounts: Record<string, number>; outcomes: Record<string, HomeOutcome | undefined>; outcomesFailed: boolean;
  canCreate: boolean; onCreate: () => void; onOpen: (requestId: string) => void; onShowDrafts: () => void;
}) {
  const { actions, results } = summarizeHome(requests, supplementCounts, outcomes);
  const urgent = actions.filter(action => action.kind !== 'DRAFT');
  const drafts = actions.filter(action => action.kind === 'DRAFT');

  if (requests.length === 0) return <section className="portal-card portal-onboarding" aria-label="Bắt đầu đề nghị vay">
    <h2>Bắt đầu đề nghị vay đầu tiên</h2>
    <p>Chỉ cần 3 bước. Bạn có thể lưu nháp và quay lại bất cứ lúc nào.</p>
    <ol className="portal-steps">{STEPS.map(({ icon: Icon, title, text }, index) => <li key={title}>
      <span className="portal-step-icon" aria-hidden="true"><Icon size={20} /></span>
      <div><strong>{index + 1}. {title}</strong><span>{text}</span></div>
    </li>)}</ol>
    <button type="button" className="btn btn-primary" disabled={!canCreate} onClick={onCreate}><Plus size={17} aria-hidden="true" /> Tạo đề nghị vay</button>
  </section>;

  return <>
    <section className="portal-card portal-todo" aria-label="Việc cần làm">
      <div className="portal-todo-head">
        <AlertCircle size={20} aria-hidden="true" />
        <h2>Việc cần làm</h2>
        {urgent.length + drafts.length > 0 && <span className="portal-count">{urgent.length + drafts.length}</span>}
      </div>
      {urgent.length === 0 && drafts.length === 0 && <p className="portal-todo-empty"><CheckCircle2 size={18} aria-hidden="true" /> Không có việc nào đang chờ doanh nghiệp. Ngân hàng sẽ báo trên cổng khi cần bạn bổ sung.</p>}
      {urgent.length > 0 && <ul className="portal-todo-list">{urgent.map(action => <li key={`${action.kind}-${action.requestId}`} className={`todo-${action.kind.toLowerCase()}`}>
        <button type="button" onClick={() => onOpen(action.requestId)}>
          <span className="portal-todo-tag">{action.kind === 'RETURNED' ? 'Cần chỉnh sửa' : 'Cần bổ sung'}</span>
          <strong>{action.reference}</strong>
          <span className="portal-todo-text">{action.text}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </li>)}</ul>}
      {drafts.length > 0 && <div className="portal-todo-drafts">
        <p><strong>{drafts.length} bản nháp chưa gửi.</strong> Hoàn tất và gửi để ngân hàng tiếp nhận; bản nháp chưa được ngân hàng xem.</p>
        <div className="portal-todo-draft-links">
          {drafts.slice(0, DRAFT_PREVIEW).map(draft => <button key={draft.requestId} type="button" className="btn btn-secondary" onClick={() => onOpen(draft.requestId)}>Tiếp tục {draft.reference}</button>)}
          {drafts.length > DRAFT_PREVIEW && <button type="button" className="portal-link" onClick={onShowDrafts}><Search size={15} aria-hidden="true" /> Xem cả {drafts.length} bản nháp</button>}
        </div>
      </div>}
    </section>
    {(results.length > 0 || outcomesFailed) && <section className="portal-card portal-results" aria-label="Kết quả hồ sơ">
      <div className="portal-todo-head"><ClipboardCheck size={20} aria-hidden="true" /><h2>Kết quả hồ sơ</h2></div>
      {outcomesFailed && <p role="alert" className="portal-error">Chưa tải được kết quả của một số hồ sơ. Bấm Làm mới để thử lại.</p>}
      <ul className="portal-home-list">{results.map(result => <li key={result.requestId} className={`portal-home-result result-${result.code.toLowerCase()}`}>
        {result.code === 'APPROVED' ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
        <div><span className="portal-home-result-head"><button type="button" className="portal-link" onClick={() => onOpen(result.requestId)}>{result.reference}</button> · {result.company}</span>
          <strong className="portal-home-result-label">{result.label}</strong><small>{result.detail}</small></div>
      </li>)}</ul>
    </section>}
  </>;
}
