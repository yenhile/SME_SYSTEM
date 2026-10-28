-- Additive Portal V2 intake cycle. Apply only to the explicitly selected schema.
-- Keep all existing requests, documents, Company and Loan/history data.
BEGIN;
ALTER TYPE "PortalRequestStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS correction_request JSONB;
CREATE TABLE IF NOT EXISTS portal_submissions (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES portal_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  sequence INTEGER NOT NULL CHECK (sequence > 0), source_revision INTEGER NOT NULL CHECK (source_revision >= 0),
  snapshot JSONB NOT NULL, reviews JSONB NOT NULL DEFAULT '[]', changes JSONB NOT NULL DEFAULT '{}',
  return_items JSONB NOT NULL DEFAULT '[]', returned_at TIMESTAMP(3), submitted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_submissions_request_id_sequence_key UNIQUE(request_id,sequence),
  CONSTRAINT portal_submissions_request_id_source_revision_key UNIQUE(request_id,source_revision)
);
CREATE TABLE IF NOT EXISTS portal_intake_operations (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES portal_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  client_request_id TEXT NOT NULL, actor_id TEXT NOT NULL, kind TEXT NOT NULL, payload_hash TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_intake_operations_request_id_client_request_id_key UNIQUE(request_id,client_request_id)
);
CREATE TABLE IF NOT EXISTS portal_intake_issues (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES portal_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  description TEXT NOT NULL, proposal TEXT NOT NULL, public_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')), resolution TEXT,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_intake_issues_request_id_status_idx ON portal_intake_issues(request_id,status);
COMMIT;
