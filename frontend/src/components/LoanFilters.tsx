import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LoanFilterValues } from '../loanListDisplay';
import './loan-table.css';

interface LoanFiltersProps {
  values: LoanFilterValues;
  stageOptions: ReadonlyArray<readonly [string, string]>;
  statusOptions: ReadonlyArray<readonly [string, string]>;
  showOfficer: boolean;
  minimal?: boolean;
  busy: boolean;
  onChange: (values: LoanFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
}

const LOAN_TYPES: ReadonlyArray<readonly [string, string]> = [['VAY_VON_LUU_DONG', 'Vốn lưu động'], ['VAY_DAU_TU_TSCD', 'Đầu tư tài sản cố định'], ['THAU_CHI', 'Thấu chi']];

export function LoanFilters({ values, stageOptions, statusOptions, showOfficer, minimal = false, busy, onChange, onApply, onClear }: LoanFiltersProps) {
  const [open, setOpen] = useState(() => window.innerWidth > 768);
  const set = <K extends keyof LoanFilterValues>(key: K, value: LoanFilterValues[K]) => onChange({ ...values, [key]: value });

  return <form className="card lt-filters" onSubmit={event => { event.preventDefault(); onApply(); }}>
    <div className="lt-filters-head">
      <h3>Bộ lọc</h3>
      <div className="lt-filters-actions">
        <button type="button" className="btn btn-secondary" onClick={onClear}>Xóa bộ lọc</button>
        <button type="submit" className="btn lt-apply" disabled={busy}>Áp dụng bộ lọc</button>
        <button type="button" className="lt-icon-button" aria-expanded={open} aria-label={open ? 'Thu gọn bộ lọc' : 'Mở bộ lọc'} onClick={() => setOpen(!open)}>{open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}</button>
      </div>
    </div>
    {open && <div className="lt-filters-grid">
      <label>Mã hồ sơ<input type="text" placeholder="SME-12" value={values.code} onChange={event => set('code', event.target.value)} /></label>
      <label>Doanh nghiệp, MST<input type="text" placeholder="Tên hoặc mã số thuế" value={values.company} onChange={event => set('company', event.target.value)} /></label>
      {stageOptions.length > 0 && <label>Công đoạn
        <select value={values.stage} onChange={event => set('stage', event.target.value)}>
          <option value="">Tất cả công đoạn</option>
          {stageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
      {!minimal && <>
        <label>Trạng thái
          <select value={values.status} onChange={event => set('status', event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Loại vay
          <select value={values.loanType} onChange={event => set('loanType', event.target.value)}>
            <option value="">Tất cả loại vay</option>
            {LOAN_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {showOfficer && <label>CBTD phụ trách<input type="text" placeholder="Tên cán bộ" value={values.officer} onChange={event => set('officer', event.target.value)} /></label>}
        <label className="lt-check"><input type="checkbox" checked={values.overdueOnly} onChange={event => set('overdueOnly', event.target.checked)} />Chỉ hồ sơ quá hạn SLA</label>
      </>}
    </div>}
  </form>;
}
