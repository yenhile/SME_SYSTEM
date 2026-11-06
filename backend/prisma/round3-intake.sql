-- Additive only. Apply to an explicitly authorized target after backup.
BEGIN;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS company_snapshot JSONB;
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS correction_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE portal_intake_issues ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE portal_intake_issues ADD COLUMN IF NOT EXISTS context JSONB;
COMMIT;
