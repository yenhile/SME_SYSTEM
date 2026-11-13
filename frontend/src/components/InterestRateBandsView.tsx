import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  bandConfirmText, bandFormError, bandPayload, dayText, EMPTY_BAND_FORM, LOAN_TYPE_NAMES, rangeText, vnToday,
  type RateBandForm, type RateBandList,
} from '../rateBands';

const timeText = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

export function InterestRateBandsView() {
  const [data, setData] = useState<RateBandList | null>(null);
  const [form, setForm] = useState<RateBandForm>(EMPTY_BAND_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get<RateBandList>('/admin/interest-rate-bands'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được khung lãi suất.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = vnToday();
  const formError = bandFormError(form, today);
  const set = (key: keyof RateBandForm) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    if (formError || !window.confirm(bandConfirmText(form, data?.active[form.loanType] ?? null, today))) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/admin/interest-rate-bands', bandPayload(form));
      setNotice(`Đã thêm khung ${LOAN_TYPE_NAMES[form.loanType]}.`);
      setForm(EMPTY_BAND_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được khung lãi suất.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="admin-view">
    <div className="page-heading"><div><h2>Khung lãi suất</h2></div><button disabled={loading} className="btn btn-secondary" onClick={() => void load()}>Làm mới</button></div>
    {error && <div role="alert" className="error-message"><p>{error}</p></div>}
    {notice && <p role="status" className="success-message">{notice}</p>}

    <div className="data-table-container"><table className="data-table" aria-label="Khung đang áp dụng">
      <thead><tr><th>Loại vay</th><th>Khung đang áp dụng</th><th>Hiệu lực từ</th><th>Căn cứ ban hành</th></tr></thead>
      <tbody>{Object.entries(LOAN_TYPE_NAMES).map(([code, name]) => {
        const band = data?.active[code];
        return <tr key={code}><td>{name}</td>{band
          ? <><td>{rangeText(band.minRate, band.maxRate)}</td><td>{dayText(band.effectiveFrom)}</td><td>{band.basis}</td></>
          : <td colSpan={3}>{loading && !data ? 'Đang tải…' : 'Chưa có khung: hồ sơ loại vay này chưa trình tờ trình và chưa phê duyệt được.'}</td>}</tr>;
      })}</tbody>
    </table></div>

    <form className="card admin-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3>Thêm phiên bản khung</h3>
      <label>Loại vay<select value={form.loanType} onChange={set('loanType')} disabled={busy}><option value="">Chọn loại vay</option>{Object.entries(LOAN_TYPE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label>Sàn (%/năm)<input type="number" inputMode="decimal" min={0.01} max={100} step="0.01" value={form.minRate} onChange={set('minRate')} disabled={busy} /></label>
      <label>Trần (%/năm)<input type="number" inputMode="decimal" min={0.01} max={100} step="0.01" value={form.maxRate} onChange={set('maxRate')} disabled={busy} /></label>
      <label>Hiệu lực từ<input type="date" min={today} value={form.effectiveDate} onChange={set('effectiveDate')} disabled={busy} /></label>
      <label>Căn cứ ban hành<input type="text" maxLength={500} placeholder="Số văn bản, ngày ban hành hoặc nguồn số liệu" value={form.basis} onChange={set('basis')} disabled={busy} /></label>
      {formError && form !== EMPTY_BAND_FORM && <p className="error-message">{formError}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || Boolean(formError)}>{busy ? 'Đang lưu…' : 'Thêm khung'}</button>
    </form>

    <div className="data-table-container"><table className="data-table" aria-label="Các phiên bản khung">
      <thead><tr><th>Loại vay</th><th>Khung</th><th>Hiệu lực từ</th><th>Căn cứ ban hành</th><th>Thời điểm lưu</th></tr></thead>
      <tbody>{!data?.items.length
        ? <tr><td colSpan={5}>{loading && !data ? 'Đang tải…' : 'Chưa có phiên bản khung nào.'}</td></tr>
        : data.items.map(row => <tr key={row.id}><td>{LOAN_TYPE_NAMES[row.loanType] ?? row.loanType}</td><td>{rangeText(row.minRate, row.maxRate)}</td><td>{dayText(row.effectiveFrom)}</td><td>{row.basis}</td><td>{timeText(row.createdAt)}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
