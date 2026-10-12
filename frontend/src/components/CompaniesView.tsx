import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Company } from '../types';
export function CompaniesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setCompanies(await api.get<Company[]>(`/companies?keyword=${encodeURIComponent(keyword.trim())}`)); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  return <section><div className="page-heading"><div><h2>Doanh nghiệp</h2><p>Thông tin doanh nghiệp đã lưu trong hệ thống.</p></div><button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Làm mới</button></div><form className="search-row" onSubmit={e => { e.preventDefault(); void load(); }}><input aria-label="Tìm doanh nghiệp" placeholder="Tên doanh nghiệp hoặc mã số thuế" value={keyword} onChange={e => setKeyword(e.target.value)} /><button className="btn btn-primary" disabled={busy}>Tìm</button></form>{error && <p role="alert" className="error-message">{error}</p>}<div className="data-table-container"><table className="data-table"><thead><tr><th>Mã số thuế</th><th>Doanh nghiệp</th><th>Ngành nghề</th><th>Đại diện</th><th>Điện thoại</th></tr></thead><tbody>{companies.map(company => <tr key={company.id}><td>{company.taxCode}</td><td>{company.companyName}</td><td>{company.industry}</td><td>{company.representativeName}</td><td>{company.phone}</td></tr>)}</tbody></table>{!busy && !companies.length && <p>Không tìm thấy doanh nghiệp.</p>}</div></section>;
}
