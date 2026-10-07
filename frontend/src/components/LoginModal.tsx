import React from 'react';
import { useAuth, SAMPLE_USERS } from '../context/AuthContext';
import { Landmark, ShieldCheck, User, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { user, quickSwitch } = useAuth();

  if (!isOpen) return null;

  const handleSelectUser = async (username: string) => {
    await quickSwitch(username);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header" style={{ textAlign: 'center', display: 'block', padding: '24px 24px 16px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Landmark size={26} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            HỆ THỐNG XÉT DUYỆT TÍN DỤNG SME
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>
            Vui lòng chọn 1 trong 4 vai trò (Actor) bên dưới để đăng nhập nhanh kiểm thử hệ thống:
          </p>
        </div>

        <div className="modal-body" style={{ padding: '0 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {SAMPLE_USERS.map((u) => {
              const isCurrent = user?.username === u.username;

              return (
                <div
                  key={u.username}
                  onClick={() => handleSelectUser(u.username)}
                  style={{
                    background: isCurrent ? '#f0f9ff' : '#ffffff',
                    border: `2px solid ${isCurrent ? '#0284c7' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isCurrent ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span
                        className={`badge ${
                          u.role === 'QUAN_LY'
                            ? 'badge-soft-purple'
                            : u.role === 'THAM_QUYEN'
                            ? 'badge-soft-green'
                            : u.role === 'ADMIN'
                            ? 'badge-soft-red'
                            : 'badge-soft-blue'
                        }`}
                        style={{ fontSize: '11px', fontWeight: 700 }}
                      >
                        {u.role}
                      </span>
                      {isCurrent && <CheckCircle2 size={16} color="#0284c7" />}
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {u.name}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {u.desc}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0284c7',
                      marginTop: 14,
                    }}
                  >
                    <span>{isCurrent ? 'Đang hoạt động' : 'Đăng nhập vai trò này'}</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center', background: '#f8fafc' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ minWidth: '120px' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
