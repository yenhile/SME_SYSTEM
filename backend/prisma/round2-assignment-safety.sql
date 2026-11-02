-- Package A only: additive versions and idempotent assignment history.
-- No coordination request, role, workflow or SLA changes.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS assignment_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS assignment_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE application_assignments ADD COLUMN IF NOT EXISTS client_request_id TEXT;
ALTER TABLE application_assignments ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE portal_assignments ADD COLUMN IF NOT EXISTS client_request_id TEXT;
ALTER TABLE portal_assignments ADD COLUMN IF NOT EXISTS payload_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS application_assignments_application_id_client_request_id_key ON application_assignments(application_id,client_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS portal_assignments_request_id_client_request_id_key ON portal_assignments(request_id,client_request_id);
COMMIT;
