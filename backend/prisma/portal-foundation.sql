-- Development only; apply after portal-phase1.sql and portal-assignment.sql.
-- Additive and repeatable. No existing fields, enums, or foreign keys are changed.
-- Legacy requests remain v1; nullable metadata means unclassified, not inferred.
-- Coverage shape, same-request version chains, and current-version writes are
-- validated by the portal service while holding the parent request row lock.
BEGIN;

ALTER TABLE portal_requests
  ADD COLUMN IF NOT EXISTS form_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checklist_version TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB;

ALTER TABLE portal_documents
  ADD COLUMN IF NOT EXISTS coverage JSONB,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id TEXT,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS client_upload_id TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- PostgreSQL allows multiple NULL values in these unique indexes: legacy files
-- without metadata remain valid; a predecessor can have at most one successor.
CREATE UNIQUE INDEX IF NOT EXISTS portal_documents_supersedes_id_key
  ON portal_documents(supersedes_id);
CREATE UNIQUE INDEX IF NOT EXISTS portal_documents_request_id_client_upload_id_key
  ON portal_documents(request_id, client_upload_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portal_documents'::regclass
      AND conname = 'portal_documents_supersedes_id_fkey'
  ) THEN
    ALTER TABLE portal_documents
      ADD CONSTRAINT portal_documents_supersedes_id_fkey
      FOREIGN KEY (supersedes_id) REFERENCES portal_documents(id)
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portal_requests'::regclass
      AND conname = 'portal_requests_revision_nonnegative'
  ) THEN
    ALTER TABLE portal_requests
      ADD CONSTRAINT portal_requests_revision_nonnegative CHECK (revision >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portal_documents'::regclass
      AND conname = 'portal_documents_version_positive'
  ) THEN
    ALTER TABLE portal_documents
      ADD CONSTRAINT portal_documents_version_positive CHECK (version > 0);
  END IF;
END $$;

COMMIT;
