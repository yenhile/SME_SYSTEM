import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import type { DocumentType } from '../types';
import { documentFormat } from './loanInputRules';

const DOCUMENT_OPTIONS: ReadonlyArray<readonly [DocumentType, string]> = [
  ['PHAP_LY', 'Pháp lý (GPKD, Điều lệ)'],
  ['TAI_CHINH', 'Tài chính (BCTC, Sao kê)'],
  ['HOAT_DONG_SX', 'Hoạt động sản xuất kinh doanh'],
  ['PHUONG_AN', 'Phương án kinh doanh'],
  ['TSBD', 'Tài sản bảo đảm (Sổ đỏ, Xe)'],
  ['KHAC', 'Khác'],
  ['DU_NO', 'Dư nợ hiện tại'],
];

interface OfficerDocumentToolbarProps {
  loanId: string;
  busy: boolean;
  run: (work: () => Promise<unknown>, success: string) => Promise<boolean>;
}

export function OfficerDocumentToolbar({ loanId, busy, run }: OfficerDocumentToolbarProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>('PHAP_LY');
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState(0);
  const format = documentFormat(type);

  const clearFile = () => { setFile(null); setSelection(value => value + 1); };
  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append('documentType', type);
    form.append('file', file);
    const saved = await run(() => api.post(`/documents/${loanId}`, form), 'Đã thêm chứng từ.');
    if (saved) { clearFile(); setOpen(false); }
  };

  if (!open) return <div className="oc-doc-toolbar"><button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}><Plus size={14} aria-hidden="true" /> Thêm tài liệu</button></div>;

  return <form className="aw-form oc-doc-form" onSubmit={event => { event.preventDefault(); void upload(); }}>
    <label>Loại chứng từ
      <select value={type} disabled={busy} onChange={event => { setType(event.target.value as DocumentType); clearFile(); }}>
        {DOCUMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label>Tệp chứng từ
      <input key={selection} type="file" accept={format.accept} disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
    </label>
    <p className="aw-hint">Định dạng {format.label}, tối đa 10 MB.</p>
    <div className="aw-form-actions">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { clearFile(); setOpen(false); }}>Hủy</button>
      <button type="submit" className="btn btn-primary" disabled={busy || !file}>Lưu tài liệu</button>
    </div>
  </form>;
}
