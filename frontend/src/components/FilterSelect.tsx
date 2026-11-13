import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface FilterSelectProps {
  label: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  /** Tên nhóm của từng phương án; khi có, danh sách hiện tiêu đề nhóm. */
  groupOf?: (value: string) => string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Ô chọn có nhãn nổi: bấm vào để mở danh sách, gõ để lọc phương án, dùng mũi tên và Enter để chọn. */
export function FilterSelect({ label, placeholder, value, options, onChange, groupOf }: FilterSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find(([optionValue]) => optionValue === value);
  const shown = query.trim() ? options.filter(([, optionLabel]) => normalize(optionLabel).includes(normalize(query.trim()))) : options;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const index = options.findIndex(([optionValue]) => optionValue === value);
    setActive(index < 0 ? 0 : index);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => Math.min(Math.max(current + step, 0), Math.max(shown.length - 1, 0)));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (shown[active]) choose(shown[active][0]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const floated = open || Boolean(selected);
  return <div ref={rootRef} className={`ff-field ff-select${floated ? ' is-floated' : ''}${open ? ' is-open' : ''}`}>
    <label htmlFor={id} className="ff-label">{label}</label>
    <input
      ref={inputRef}
      id={id}
      role="combobox"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
      autoComplete="off"
      placeholder={open ? placeholder : ''}
      value={open ? query : selected?.[1] ?? ''}
      readOnly={!open}
      onClick={() => setOpen(true)}
      onChange={event => { setQuery(event.target.value); setActive(0); }}
      onKeyDown={onKeyDown}
    />
    {selected && !open
      ? <button type="button" className="ff-icon-button" aria-label={`Bỏ chọn ${label.toLowerCase()}`} onClick={() => onChange('')}><X size={16} aria-hidden="true" /></button>
      : <ChevronDown className="ff-chevron" size={18} aria-hidden="true" onMouseDown={event => { event.preventDefault(); setOpen(!open); inputRef.current?.focus(); }} />}
    {open && <ul id={listId} role="listbox" aria-label={label} className="ff-menu">
      {shown.length === 0 && <li className="ff-empty">Không có lựa chọn phù hợp</li>}
      {shown.map(([optionValue, optionLabel], index) => {
        const group = groupOf?.(optionValue) ?? '';
        const newGroup = group && (index === 0 || groupOf?.(shown[index - 1][0]) !== group);
        return <Fragment key={optionValue}>
          {newGroup && <li role="presentation" className="ff-group">{group}</li>}
          <li
            id={`${id}-opt-${index}`}
            role="option"
            aria-selected={optionValue === value}
            className={`ff-option${index === active ? ' is-active' : ''}${group ? ' is-grouped' : ''}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={event => { event.preventDefault(); choose(optionValue); }}
          >
            <span>{optionLabel}</span>
            {optionValue === value && <Check size={16} aria-hidden="true" />}
          </li>
        </Fragment>;
      })}
    </ul>}
  </div>;
}
