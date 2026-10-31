-- Additive SLA PA1 (giờ làm việc). Apply only to the explicitly selected schema; do not apply to public without PO approval.
-- Keeps all existing stage history rows unchanged: new columns are nullable (null = cách tính cũ).
BEGIN;
ALTER TABLE application_stage_history ADD COLUMN IF NOT EXISTS sla_policy TEXT;
ALTER TABLE application_stage_history ADD COLUMN IF NOT EXISTS sla_calendar_version TEXT;
CREATE TABLE IF NOT EXISTS application_stage_pauses (
  id TEXT PRIMARY KEY,
  history_id TEXT NOT NULL REFERENCES application_stage_history(id) ON DELETE CASCADE ON UPDATE CASCADE,
  started_at TIMESTAMP(3) NOT NULL, ended_at TIMESTAMP(3), reason TEXT NOT NULL, supplement_id TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT application_stage_pauses_period_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS application_stage_pauses_history_id_idx ON application_stage_pauses(history_id);
-- Không cho hai khoảng dừng cùng mở trên một công đoạn (chống dừng trùng khi gửi lặp hoặc đồng thời).
CREATE UNIQUE INDEX IF NOT EXISTS application_stage_pauses_one_open_idx ON application_stage_pauses(history_id) WHERE ended_at IS NULL;
CREATE TABLE IF NOT EXISTS sla_policy_activations (
  id TEXT PRIMARY KEY, policy_code TEXT NOT NULL, calendar_version TEXT NOT NULL,
  activated_at TIMESTAMP(3) NOT NULL, activated_by TEXT, note TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sla_policy_activations_activated_at_idx ON sla_policy_activations(activated_at);
COMMIT;
