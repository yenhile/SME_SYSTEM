import React, { useState } from 'react';
import { api } from '../api/client';
import { Company, LoanType } from '../types';
import { X, Search, Building2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface CreateLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLoanModal: React.FC<CreateLoanModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [taxCode, setTaxCode] = useState('0312345678');
  const [companyName, setCompanyName] = useState('Công ty Cổ phần Thép Việt Á');
  const [industry, setIndustry] = useState('Sản xuất & Chế biến kim loại');
  const [establishedYear, setEstablishedYear] = useState(2017);
  const [annualRevenue, setAnnualRevenue] = useState<number>(52000000000);
  const [charterCapital, setCharterCapital] = useState<number>(15000000000);
  const [representativeName, setRepresentativeName] = useState('Vũ Mạnh Hùng');
  const [phone, setPhone] = useState('0908123456');
  const [address, setAddress] = useState('Khu công nghiệp Tân Bình, TP. Hồ Chí Minh');

  const [loanPurpose, setLoanPurpose] = useState('Bổ sung vốn lưu động thu mua phôi thép đơn hàng quý 4');
  const [loanType, setLoanType] = useState<LoanType>('VAY_VON_LUU_DONG');
  const [proposedAmount, setProposedAmount] = useState<number>(6000000000);
  const [loanTermMonths, setLoanTermMonths] = useState<number>(12);

  const [checkingTax, setCheckingTax] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // Tính tỷ lệ đòn bẩy Nợ/Vốn chủ sở hữu để cảnh báo Risk Alert tức thì
  const debtToEquity =
    charterCapital > 0 ? (proposedAmount / charterCapital).toFixed(2) : '0';
  const isHighDebt = Number(debtToEquity) > 2.0;
  const isExceedBranchLimit = proposedAmount > 10000000000;

  const handleCheckTaxCode = async () => {
    if (!taxCode.trim()) {
      setStatusMsg({ text: 'Vui lòng nhập Mã số thuế để kiểm tra', type: 'error' });
      return;
    }

    setCheckingTax(true);
    setStatusMsg(null);
    try {
      const company = await api.get<Company>(`/companies/by-tax-code/${taxCode.trim()}`);
      if (company) {
        setCompanyName(company.companyName);
        setIndustry(company.industry);
        setEstablishedYear(company.establishedYear);
        setAnnualRevenue(Number(company.annualRevenue));
        setCharterCapital(Number(company.charterCapital));
        setRepresentativeName(company.representativeName);
        setPhone(company.phone);
        setAddress(company.address);
        setStatusMsg({ text: 'Đã tìm thấy thông tin doanh nghiệp trong hệ thống', type: 'success' });
      }
    } catch {
      setStatusMsg({ text: 'Doanh nghiệp mới - vui lòng nhập các thông tin chi tiết bên dưới', type: 'success' });
    } finally {
      setCheckingTax(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);

    try {
      await api.post('/loan-applications', {
        taxCode,
        companyName,
        industry,
        establishedYear: Number(establishedYear),
        annualRevenue: Number(annualRevenue),
        charterCapital: Number(charterCapital),
        representativeName,
        phone,
        address,
        loanPurpose,
        loanType,
        proposedAmount: Number(proposedAmount),
        loanTermMonths: Number(loanTermMonths),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Lỗi khi tạo hồ sơ vay', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '840px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Tiếp nhận Hồ sơ Vay vốn Doanh nghiệp SME</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Khởi tạo hồ sơ tín dụng mới vào công đoạn Tiếp nhận</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {statusMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: '13px',
                  backgroundColor: statusMsg.type === 'success' ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)',
                  border: `1px solid ${statusMsg.type === 'success' ? 'var(--badge-green-border)' : 'var(--badge-red-border)'}`,
                  color: statusMsg.type === 'success' ? 'var(--badge-green-text)' : 'var(--badge-red-text)',
                }}
              >
                {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {statusMsg.text}
              </div>
            )}

            {/* Khối 1: Thông tin Doanh nghiệp Trắng Sáng Thoáng Đãng */}
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--primary)', marginBottom: '14px', textTransform: 'uppercase', fontWeight: 700 }}>
                1. Thông tin Doanh nghiệp SME
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Mã số thuế *
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="0312345678"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleCheckTaxCode}
                      disabled={checkingTax}
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px' }}
                      title="Kiểm tra MST"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Tên doanh nghiệp *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Ngành nghề kinh doanh *
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Sản xuất & Chế biến kim loại">Sản xuất & Chế biến</option>
                    <option value="Xây dựng & Thi công công trình">Xây dựng & Cơ khí</option>
                    <option value="Thương mại - Bán buôn & Bán lẻ">Thương mại & Dịch vụ</option>
                    <option value="Nông nghiệp & Thủy sản">Nông nghiệp & Thủy sản</option>
                    <option value="Vận tải, Logistics & Kho bãi">Vận tải & Kho bãi</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Năm thành lập *
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max={new Date().getFullYear()}
                    value={establishedYear}
                    onChange={(e) => setEstablishedYear(Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Vốn điều lệ (VNĐ) *
                  </label>
                  <input
                    type="number"
                    step="100000000"
                    value={charterCapital}
                    onChange={(e) => setCharterCapital(Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Doanh thu năm gần nhất (VNĐ) *
                  </label>
                  <input
                    type="number"
                    step="100000000"
                    value={annualRevenue}
                    onChange={(e) => setAnnualRevenue(Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Người đại diện pháp luật *
                  </label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Điện thoại liên hệ *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Địa chỉ trụ sở *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Khối 2: Nhu cầu vay vốn & Cảnh báo rủi ro Risk Alerts */}
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--primary)', marginBottom: '14px', textTransform: 'uppercase', fontWeight: 700 }}>
                2. Nhu cầu Đề xuất Vay vốn & Đánh giá sơ bộ
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Loại hình cấp tín dụng *
                  </label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value as LoanType)}
                    style={{ width: '100%' }}
                  >
                    <option value="VAY_VON_LUU_DONG">Vay vốn lưu động</option>
                    <option value="VAY_DAU_TU_TSCD">Vay đầu tư TSCĐ / Dự án</option>
                    <option value="THAU_CHI">Thấu chi doanh nghiệp</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Số tiền đề nghị (VNĐ) *
                  </label>
                  <input
                    type="number"
                    step="50000000"
                    value={proposedAmount}
                    onChange={(e) => setProposedAmount(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      borderColor: isExceedBranchLimit ? '#f87171' : undefined,
                    }}
                  />
                  {isExceedBranchLimit ? (
                    <div className="risk-alert-inline danger">
                      <AlertTriangle size={12} /> Vượt 10 tỷ (Cần Cấp trên phê duyệt)
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--badge-green-text)', display: 'block', marginTop: 4 }}>
                      Duyệt tại chi nhánh (≤ 10 tỷ)
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Thời hạn vay (tháng) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={loanTermMonths}
                    onChange={(e) => setLoanTermMonths(Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* B. Cảnh báo rủi ro đòn bẩy tự động */}
              <div
                style={{
                  background: isHighDebt ? 'var(--badge-amber-bg)' : '#f8fafc',
                  border: `1px solid ${isHighDebt ? 'var(--badge-amber-border)' : 'var(--border-color)'}`,
                  padding: '10px 14px',
                  borderRadius: 6,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} color={isHighDebt ? '#ea580c' : '#0284c7'} />
                  <span style={{ fontSize: '12.5px', color: isHighDebt ? '#9a3412' : 'var(--text-secondary)' }}>
                    Chỉ số Đòn bẩy Nợ/Vốn chủ sở hữu sơ bộ: <strong>{debtToEquity} lần</strong>
                    {isHighDebt && ' — Cảnh báo: Tỷ lệ cao (> 2.0), có thể tăng xác suất trễ hạn khi thẩm định!'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Mục đích sử dụng vốn vay *
                </label>
                <textarea
                  rows={2}
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Hủy bỏ
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Đang tạo hồ sơ...' : 'Tạo hồ sơ vay mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
