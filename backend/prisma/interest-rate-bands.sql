-- Additive: khung lãi suất theo loại vay. Apply only to the explicitly selected schema, after a backup; do not apply to public without PO approval.
-- Chạy lại an toàn. Bảng chỉ thêm: trigger từ chối mọi UPDATE, DELETE, TRUNCATE. Nhật ký quản trị nhận thêm thao tác thêm khung.
BEGIN;
CREATE TABLE IF NOT EXISTS interest_rate_bands (
  id TEXT PRIMARY KEY,
  loan_type "LoanType" NOT NULL,
  term_from_months INTEGER,
  term_to_months INTEGER,
  min_rate DECIMAL(5,2) NOT NULL,
  max_rate DECIMAL(5,2) NOT NULL,
  effective_from TIMESTAMP(3) NOT NULL,
  basis TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT interest_rate_bands_rate_check CHECK (min_rate > 0 AND min_rate <= max_rate AND max_rate <= 100),
  CONSTRAINT interest_rate_bands_term_check CHECK (
    (term_from_months IS NULL OR term_from_months >= 1)
    AND (term_to_months IS NULL OR term_to_months >= 1)
    AND (term_from_months IS NULL OR term_to_months IS NULL OR term_from_months <= term_to_months)
  ),
  CONSTRAINT interest_rate_bands_basis_check CHECK (length(btrim(basis)) BETWEEN 1 AND 500)
);
CREATE INDEX IF NOT EXISTS interest_rate_bands_loan_type_effective_from_idx ON interest_rate_bands(loan_type, effective_from);

CREATE OR REPLACE FUNCTION interest_rate_bands_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Khung lãi suất chỉ được thêm phiên bản mới, không được sửa hoặc xóa.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS interest_rate_bands_append_only ON interest_rate_bands;
CREATE TRIGGER interest_rate_bands_append_only BEFORE UPDATE OR DELETE ON interest_rate_bands
  FOR EACH ROW EXECUTE FUNCTION interest_rate_bands_append_only();
DROP TRIGGER IF EXISTS interest_rate_bands_no_truncate ON interest_rate_bands;
CREATE TRIGGER interest_rate_bands_no_truncate BEFORE TRUNCATE ON interest_rate_bands
  FOR EACH STATEMENT EXECUTE FUNCTION interest_rate_bands_append_only();

ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;
ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_action_check CHECK (action IN ('USER_CREATED','USER_PROFILE_UPDATED','USER_LOCKED','USER_UNLOCKED','USER_ROLES_CHANGED','STAGE_SLA_UPDATED','INTEREST_RATE_BAND_CREATED'));
ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check;
ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_target_type_check CHECK (target_type IN ('USER','WORKFLOW_STAGE','INTEREST_RATE_BAND'));
COMMIT;
