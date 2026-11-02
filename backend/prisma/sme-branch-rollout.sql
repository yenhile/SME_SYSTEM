-- Additive upgrade only. No activation of SLA PA1 and no backfill of legacy applications.
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS business_policy_version TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS intake_officer_id TEXT;
CREATE TABLE IF NOT EXISTS appraisal_reports (
  id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE ON UPDATE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'DRAFT', draft JSONB NOT NULL,
  clarification JSONB, decided_version_id TEXT,
  CONSTRAINT appraisal_reports_application_id_key UNIQUE(application_id)
);
CREATE TABLE IF NOT EXISTS appraisal_report_versions (
  id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES appraisal_reports(id) ON DELETE CASCADE ON UPDATE CASCADE,
  sequence INTEGER NOT NULL, content JSONB NOT NULL, evidence JSONB NOT NULL, evidence_hash TEXT NOT NULL,
  submitted_by TEXT NOT NULL, submitted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT appraisal_report_versions_report_id_sequence_key UNIQUE(report_id,sequence)
);
CREATE TABLE IF NOT EXISTS appraisal_report_events (
  id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES appraisal_reports(id) ON DELETE CASCADE ON UPDATE CASCADE,
  actor_id TEXT NOT NULL, kind TEXT NOT NULL, client_request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT appraisal_report_events_report_id_client_request_id_key UNIQUE(report_id,client_request_id)
);
