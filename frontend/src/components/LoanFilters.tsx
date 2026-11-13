import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { hasActiveFilters, stageOfStatus, withStageChoice, withStatusChoice, type LoanFilterValues, type StatusGroup } from '../loanListDisplay';
import { FilterSelect } from './FilterSelect';
import './loan-table.css';

interface LoanFiltersProps {
  values: LoanFilterValues;
  stageOptions: ReadonlyArray<readonly [string, string]>;
  statusOptions: ReadonlyArray<readonly [string, string]>;
  showOfficer: boolean;
  minimal?: boolean;
  /** Thẻ bộ lọc với ô nhãn nổi và ô chọn có tìm kiếm; lọc khi bấm Áp dụng hoặc Enter. */
  panel?: boolean;
  /** Trạng thái chia theo công đoạn: ô Tình trạng phụ thuộc ô Công đoạn và ngược lại. */
  statusGroups?: ReadonlyArray<StatusGroup>;
  busy: boolean;
  onChange: (values: LoanFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
}

const LOAN_TYPES: ReadonlyArray<readonly [string, string]> = [['VAY_VON_LUU_DONG', 'Vốn lưu động'], ['VAY_DAU_TU_TSCD', 'Đầu tư tài sản cố định'], ['THAU_CHI', 'Thấu chi']];

function FilterText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className={`ff-field${value ? ' is-floated' : ''}`}>
    <input id={`ff-${label}`} type="text" placeholder=" " value={value} onChange={event => onChange(event.target.value)} />
    <label htmlFor={`ff-${label}`} className="ff-label">{label}</label>
    {value && <button type="button" className="ff-icon-button" aria-label={`Xóa ${label.toLowerCase()}`} onClick={() => onChange('')}><X size={16} aria-hidden="true" /></button>}
  </div>;
}

function FilterPanel({ values, stageOptions, statusOptions, statusGroups, showOfficer, busy, onChange, onApply, onClear }: Pick<LoanFiltersProps, 'values' | 'stageOptions' | 'statusOptions' | 'statusGroups' | 'showOfficer' | 'busy' | 'onChange' | 'onApply' | 'onClear'>) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof LoanFilterValues>(key: K, value: LoanFilterValues[K]) => onChange({ ...values, [key]: value });
  const activeCount = (Object.keys(values) as Array<keyof LoanFilterValues>).filter(key => values[key] === true || (typeof values[key] === 'string' && (values[key] as string).trim() !== '')).length;

  return <form className="card ff-panel" aria-label="Bộ lọc hồ sơ" onSubmit={event => { event.preventDefault(); onApply(); }}>
    <div className="ff-head">
      <h3>Bộ lọc{activeCount > 0 && <span className="ff-count">{activeCount}</span>}</h3>
      <div className="ff-actions">
        {hasActiveFilters(values) && <button type="button" className="btn btn-secondary" onClick={onClear}>Xóa bộ lọc</button>}
        <button type="submit" className="btn ff-apply" disabled={busy}>Áp dụng bộ lọc</button>
        <button type="button" className="ff-collapse" aria-expanded={open} aria-label={open ? 'Thu gọn bộ lọc' : 'Mở bộ lọc'} onClick={() => setOpen(!open)}>{open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}</button>
      </div>
    </div>
    {open && <div className="ff-grid">
      <FilterText label="Mã hồ sơ" value={values.code} onChange={code => set('code', code)} />
      <FilterText label="Doanh nghiệp hoặc MST" value={values.company} onChange={company => set('company', company)} />
      {statusGroups ? <>
        <FilterSelect label="Công đoạn" placeholder="Chọn công đoạn" value={values.stage} options={statusGroups.map(group => [group.stage, group.label] as const)} onChange={stage => onChange(withStageChoice(values, statusGroups, stage))} />
        <FilterSelect
          label="Tình trạng"
          placeholder="Chọn tình trạng"
          value={values.status}
          options={(values.stage ? statusGroups.filter(group => group.stage === values.stage) : statusGroups).flatMap(group => group.statuses)}
          groupOf={values.stage ? undefined : status => statusGroups.find(group => group.stage === stageOfStatus(statusGroups, status))?.label ?? ''}
          onChange={status => onChange(withStatusChoice(values, statusGroups, status))}
        />
      </> : <>
        {stageOptions.length > 0 && <FilterSelect label="Công đoạn" placeholder="Chọn công đoạn" value={values.stage} options={stageOptions} onChange={stage => set('stage', stage)} />}
        <FilterSelect label="Trạng thái hồ sơ" placeholder="Chọn trạng thái" value={values.status} options={statusOptions} onChange={status => set('status', status)} />
      </>}
      {showOfficer && <FilterText label="CBTD phụ trách" value={values.officer} onChange={officer => set('officer', officer)} />}
      <FilterSelect label="Loại vay" placeholder="Chọn loại vay" value={values.loanType} options={LOAN_TYPES} onChange={loanType => set('loanType', loanType)} />
      {values.stage !== 'HOAN_TAT' && <label className={`ff-check${values.overdueOnly ? ' is-checked' : ''}`}><input type="checkbox" checked={values.overdueOnly} onChange={event => set('overdueOnly', event.target.checked)} />Chỉ hồ sơ quá hạn SLA</label>}
    </div>}
  </form>;
}

export function LoanFilters({ values, stageOptions, statusOptions, showOfficer, minimal = false, panel = false, statusGroups, busy, onChange, onApply, onClear }: LoanFiltersProps) {
  const [open, setOpen] = useState(() => window.innerWidth > 768);
  const set = <K extends keyof LoanFilterValues>(key: K, value: LoanFilterValues[K]) => onChange({ ...values, [key]: value });

  if (panel) return <FilterPanel values={values} stageOptions={stageOptions} statusOptions={statusOptions} statusGroups={statusGroups} showOfficer={showOfficer} busy={busy} onChange={onChange} onApply={onApply} onClear={onClear} />;

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
