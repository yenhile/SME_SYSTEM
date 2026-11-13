-- Additive: nhật ký thao tác quản trị. Apply only to the explicitly selected schema, after a backup; do not apply to public without PO approval.
-- Chạy lại an toàn. Bảng chỉ thêm: trigger từ chối mọi UPDATE và DELETE.
BEGIN;
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_label TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_audit_logs_action_check CHECK (action IN ('USER_CREATED','USER_PROFILE_UPDATED','USER_LOCKED','USER_UNLOCKED','USER_ROLES_CHANGED','STAGE_SLA_UPDATED')),
  CONSTRAINT admin_audit_logs_target_type_check CHECK (target_type IN ('USER','WORKFLOW_STAGE'))
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_id_created_at_idx ON admin_audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_created_at_idx ON admin_audit_logs(action, created_at);

CREATE OR REPLACE FUNCTION admin_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký quản trị chỉ được thêm, không được sửa hoặc xóa.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_logs_append_only ON admin_audit_logs;
CREATE TRIGGER admin_audit_logs_append_only BEFORE UPDATE OR DELETE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION admin_audit_logs_append_only();
DROP TRIGGER IF EXISTS admin_audit_logs_no_truncate ON admin_audit_logs;
CREATE TRIGGER admin_audit_logs_no_truncate BEFORE TRUNCATE ON admin_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION admin_audit_logs_append_only();
COMMIT;
