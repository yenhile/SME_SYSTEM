import React, { useEffect, useRef, useState } from 'react';
import { labelStep, niceTicks, tickIndexes, wrapLabel, type ChartSeries } from '../../dashboardCharts';

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.floor(node.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

interface TooltipState { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] }

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return <div className="viz-tooltip" role="status" style={{ left: tip.x, top: tip.y }}>
    <strong>{tip.title}</strong>
    {tip.rows.map(row => <span key={row.label}>{row.color && <i style={{ background: row.color }} aria-hidden="true" />}{row.label}<b>{row.value}</b></span>)}
  </div>;
}

export function Legend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null;
  return <ul className="viz-legend">{series.map(item => <li key={item.key}><i style={{ background: item.color }} aria-hidden="true" />{item.label}</li>)}</ul>;
}

interface FrameProps {
  title: string;
  scope: string;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  legend?: ChartSeries[];
  table?: { head: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  wide?: boolean;
}

/** Khung chung của một biểu đồ: tiêu đề, phạm vi thống kê, chú giải, trạng thái tải/rỗng và bảng số liệu để đọc không cần màu. */
export function ChartCard({ title, scope, loading, empty, emptyText, legend, table, children, wide }: FrameProps) {
  return <figure className={`card viz-card${wide ? ' viz-wide' : ''}`}>
    <figcaption>
      <h3>{title}</h3>
      <p>{scope}</p>
    </figcaption>
    {legend && !loading && !empty && <Legend series={legend} />}
    <div className="viz-body">
      {loading ? <div className="viz-skeleton" aria-label="Đang tải biểu đồ" /> : empty ? <p className="viz-empty">{emptyText ?? 'Chưa có dữ liệu trong phạm vi này.'}</p> : children}
    </div>
    {table && !loading && !empty && <details className="viz-table">
      <summary>Xem bảng số liệu</summary>
      <table><thead><tr>{table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>
    </details>}
  </figure>;
}

const PAD = { top: 16, right: 12, bottom: 40, left: 40 };

interface ColumnProps {
  categories: string[];
  series: ChartSeries[];
  /** values[s][c]: giá trị của chuỗi s tại nhóm c; nhiều chuỗi thì xếp chồng. */
  values: number[][];
  height?: number;
  unit?: string;
  onSelect?: (index: number) => void;
  selected?: number | null;
  /** Ghi tổng trên đầu cột; tắt khi có nhiều cột hẹp (giá trị vẫn có trong tooltip và bảng số liệu). */
  showValues?: boolean;
}

/** Biểu đồ cột (một chuỗi) hoặc cột chồng (nhiều chuỗi); tổng ghi trên đầu cột. */
export function ColumnChart({ categories, series, values, height = 240, unit = 'hồ sơ', onSelect, selected, showValues = true }: ColumnProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const totals = categories.map((_, c) => series.reduce((sum, _s, s) => sum + (values[s]?.[c] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const band = categories.length ? plotW / categories.length : 0;
  const barW = Math.min(56, band * 0.56);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const longest = Math.max(0, ...categories.map(c => c.length));
  const step = band * 2 < longest * 6.5 ? labelStep(categories.length, plotW, longest) : 1;
  const labelled = new Set(step > 1 ? tickIndexes(categories.length, step) : categories.map((_, i) => i));
  const show = (c: number, event: React.MouseEvent | React.FocusEvent) => {
    const box = (event.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    const target = (event.currentTarget as SVGElement).getBoundingClientRect();
    setTip({
      x: Math.min(target.left - box.left + target.width / 2, width - 200), y: Math.max(0, target.top - box.top - 8),
      title: categories[c],
      rows: [...series.map((s, i) => ({ label: s.label, value: `${values[i]?.[c] ?? 0} ${unit}`, color: s.color })), ...(series.length > 1 ? [{ label: 'Tổng', value: `${totals[c]} ${unit}` }] : [])],
    });
  };
  return <div className="viz-plot" ref={ref} onMouseLeave={() => setTip(null)}>
    {width > 0 && <svg width={width} height={height} role="img" aria-label={categories.map((c, i) => `${c}: ${totals[i]} ${unit}`).join('; ')}>
      {ticks.map(t => <g key={t}>
        <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="viz-gridline" />
        <text x={PAD.left - 6} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">{t}</text>
      </g>)}
      {categories.map((label, c) => {
        const x = PAD.left + band * c + (band - barW) / 2;
        let acc = 0;
        const active = selected === c;
        return <g key={`${label}-${c}`} className={`viz-col${onSelect ? ' is-clickable' : ''}${selected !== undefined && selected !== null && !active ? ' is-dimmed' : ''}`}
          tabIndex={0} role={onSelect ? 'button' : undefined} aria-label={`${label}: ${totals[c]} ${unit}`}
          onMouseEnter={e => show(c, e)} onFocus={e => show(c, e)} onBlur={() => setTip(null)}
          onClick={onSelect ? () => onSelect(c) : undefined} onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c); } } : undefined}>
          <rect x={PAD.left + band * c} y={PAD.top} width={band} height={plotH} fill="transparent" />
          {series.map((s, i) => {
            const v = values[i]?.[c] ?? 0;
            if (!v) return null;
            const y1 = y(acc + v);
            const h = y(acc) - y1;
            acc += v;
            return <rect key={s.key} x={x} y={y1} width={barW} height={Math.max(0, h - (i < series.length - 1 ? 0 : 0))} rx={3} fill={s.color} className="viz-mark" />;
          })}
          {showValues && <text x={x + barW / 2} y={y(totals[c]) - 6} textAnchor="middle" className="viz-value">{totals[c]}</text>}
          {labelled.has(c) && <text x={x + barW / 2} y={height - PAD.bottom + 16} textAnchor="middle" className="viz-axis">
            {(step > 1 ? [label] : wrapLabel(label, band / 6.2)).map((line, i) => <tspan key={i} x={x + barW / 2} dy={i ? 13 : 0}>{line}</tspan>)}
            <title>{label}</title>
          </text>}
        </g>;
      })}
      <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="viz-baseline" />
    </svg>}
    <Tooltip tip={tip} />
  </div>;
}

interface BarProps { rows: string[]; series: ChartSeries[]; values: number[][]; unit?: string; onSelect?: (index: number) => void; valueText?: (index: number) => string }

/** Thanh ngang (chồng khi nhiều chuỗi), dùng khi nhãn dài như tên cán bộ. */
export function BarChart({ rows, series, values, unit = 'hồ sơ', onSelect, valueText }: BarProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const labelW = Math.min(160, Math.max(90, width * 0.32));
  const rowH = 34;
  const height = rows.length * rowH + 8;
  const totals = rows.map((_, r) => series.reduce((sum, _s, s) => sum + (values[s]?.[r] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const plotW = Math.max(0, width - labelW - 44);
  return <div className="viz-plot" ref={ref} onMouseLeave={() => setTip(null)}>
    {width > 0 && <svg width={width} height={height} role="img" aria-label={rows.map((r, i) => `${r}: ${totals[i]} ${unit}`).join('; ')}>
      {rows.map((label, r) => {
        let acc = 0;
        const yTop = r * rowH + 8;
        const show = (event: React.MouseEvent | React.FocusEvent) => {
          const box = (event.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
          const target = (event.currentTarget as SVGElement).getBoundingClientRect();
          setTip({ x: Math.min(labelW + 8, width - 200), y: Math.max(0, target.top - box.top - 4), title: label,
            rows: [...series.map((s, i) => ({ label: s.label, value: `${values[i]?.[r] ?? 0} ${unit}`, color: s.color })), ...(series.length > 1 ? [{ label: 'Tổng', value: `${totals[r]} ${unit}` }] : [])] });
        };
        return <g key={label + r} className={`viz-col${onSelect ? ' is-clickable' : ''}`} tabIndex={0} role={onSelect ? 'button' : undefined} aria-label={`${label}: ${totals[r]} ${unit}`}
          onMouseEnter={show} onFocus={show} onBlur={() => setTip(null)}
          onClick={onSelect ? () => onSelect(r) : undefined} onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } } : undefined}>
          <rect x={0} y={yTop - 4} width={width} height={rowH} fill="transparent" />
          <text x={labelW - 8} y={yTop + 10} textAnchor="end" dominantBaseline="middle" className="viz-label">{label.length > 22 ? `${label.slice(0, 21)}…` : label}<title>{label}</title></text>
          <rect x={labelW} y={yTop + 2} width={plotW} height={16} rx={3} className="viz-track" />
          {series.map((s, i) => {
            const v = values[i]?.[r] ?? 0;
            if (!v) return null;
            const x = labelW + (acc / max) * plotW;
            const w = (v / max) * plotW;
            acc += v;
            return <rect key={s.key} x={x} y={yTop + 2} width={Math.max(2, w - 2)} height={16} rx={3} fill={s.color} className="viz-mark" />;
          })}
          <text x={labelW + (totals[r] / max) * plotW + 6} y={yTop + 10} dominantBaseline="middle" className="viz-value">{valueText ? valueText(r) : totals[r]}</text>
        </g>;
      })}
    </svg>}
    <Tooltip tip={tip} />
  </div>;
}

interface LineProps { categories: string[]; series: ChartSeries[]; values: number[][]; height?: number; unit?: string; labelEvery?: number }

/** Đường theo thời gian, mỗi chuỗi một màu, điểm đánh dấu và đường dóng khi rê chuột. */
export function LineChart({ categories, series, values, height = 240, unit = 'hồ sơ', labelEvery = 1 }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...values.flat()));
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right - 8);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + 4 + (categories.length > 1 ? (i / (categories.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const pick = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const rel = event.clientX - box.left;
    let best = 0;
    categories.forEach((_, i) => { if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i; });
    setHover(best);
  };
  const tip: TooltipState | null = hover === null ? null : {
    x: Math.min(x(hover) + 8, width - 200), y: PAD.top, title: categories[hover],
    rows: series.map((s, i) => ({ label: s.label, value: `${values[i]?.[hover] ?? 0} ${unit}`, color: s.color })),
  };
  return <div className="viz-plot" ref={ref} onMouseLeave={() => setHover(null)}>
    {width > 0 && <svg width={width} height={height} onMouseMove={pick} role="img"
      aria-label={series.map((s, i) => `${s.label}: ${categories.map((c, j) => `${c} ${values[i]?.[j] ?? 0}`).join(', ')}`).join('; ')}>
      {ticks.map(t => <g key={t}>
        <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="viz-gridline" />
        <text x={PAD.left - 6} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">{t}</text>
      </g>)}
      {tickIndexes(categories.length, labelStep(categories.length, plotW, Math.max(0, ...categories.map(c => c.length)), labelEvery)).map(i => <text key={categories[i]} x={x(i)} y={height - PAD.bottom + 16} textAnchor="middle" className="viz-axis">{categories[i]}</text>)}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="viz-crosshair" />}
      {series.map((s, si) => <g key={s.key}>
        <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={categories.map((_, i) => `${x(i)},${y(values[si]?.[i] ?? 0)}`).join(' ')} />
        {categories.map((_, i) => <circle key={i} cx={x(i)} cy={y(values[si]?.[i] ?? 0)} r={hover === i ? 5 : 3.5} fill={s.color} stroke="var(--bg-card)" strokeWidth={2} />)}
      </g>)}
      <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="viz-baseline" />
    </svg>}
    <Tooltip tip={tip} />
  </div>;
}

interface DonutProps { slices: { key: string; label: string; value: number; color: string }[]; centerLabel: string; unit?: string; onSelect?: (key: string) => void }

/** Tỷ trọng các phần trong một tổng; danh sách bên cạnh ghi số và phần trăm nên không phụ thuộc màu. */
export function DonutChart({ slices, centerLabel, unit = 'hồ sơ', onSelect }: DonutProps) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const size = 168, r = 64, stroke = 22, c = 2 * Math.PI * r;
  let offset = 0;
  const shown = slices.filter(s => s.value > 0);
  const percent = (v: number) => (total ? `${Math.round((v / total) * 1000) / 10}`.replace('.', ',') : '0') + '%';
  const focus = shown.find(s => s.key === hover);
  return <div className="viz-donut">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={shown.map(s => `${s.label}: ${s.value} ${unit}`).join('; ')}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="viz-track-ring" strokeWidth={stroke} />
      {shown.map(s => {
        const len = (s.value / (total || 1)) * c;
        const gap = shown.length > 1 ? Math.min(2, len / 2) : 0;
        const el = <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hover === s.key ? stroke + 4 : stroke}
          strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={`viz-arc${onSelect ? ' is-clickable' : ''}`} tabIndex={0} aria-label={`${s.label}: ${s.value} ${unit}`}
          onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.key)} onBlur={() => setHover(null)}
          onClick={onSelect ? () => onSelect(s.key) : undefined} />;
        offset += len;
        return el;
      })}
      <text x="50%" y="46%" textAnchor="middle" className="viz-donut-value">{focus ? focus.value : total}</text>
      <text x="50%" y="60%" textAnchor="middle" className="viz-donut-label">{focus ? percent(focus.value) : centerLabel}</text>
    </svg>
    <ul className="viz-donut-list">
      {slices.map(s => <li key={s.key} className={hover === s.key ? 'is-active' : ''} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
        <i style={{ background: s.color }} aria-hidden="true" /><span>{s.label}</span><b>{s.value}</b><small>{percent(s.value)}</small>
      </li>)}
    </ul>
  </div>;
}
