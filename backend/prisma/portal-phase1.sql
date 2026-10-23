-- Additive only. Review and apply to the authorized local database; no reset or seed.
-- Run enum additions outside the table transaction (compatible with PostgreSQL enum semantics).
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'HOAT_DONG_SX';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DU_NO';
DO $$ BEGIN CREATE TYPE "PortalRequestStatus" AS ENUM ('DRAFT','SUBMITTED','ACCEPTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS portal_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 contact_name TEXT NOT NULL, phone TEXT NOT NULL, verified_at TIMESTAMP(3),
 verification_hash TEXT, verification_expires_at TIMESTAMP(3), verification_sent_at TIMESTAMP(3),
 verification_attempts INTEGER NOT NULL DEFAULT 0, login_attempts INTEGER NOT NULL DEFAULT 0,
 login_locked_until TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_requests (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, account_id TEXT NOT NULL REFERENCES portal_accounts(id),
 status "PortalRequestStatus" NOT NULL DEFAULT 'DRAFT', data JSONB NOT NULL DEFAULT '{}',
 submitted_at TIMESTAMP(3), accepted_at TIMESTAMP(3), accepted_by TEXT REFERENCES users(id),
 loan_id TEXT UNIQUE REFERENCES loan_applications(id), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_requests_account_id_status_idx ON portal_requests(account_id,status);
CREATE TABLE IF NOT EXISTS portal_documents (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES portal_requests(id),
 document_group TEXT NOT NULL CHECK (document_group IN ('A','B','C','D','E','F')),
 file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size INTEGER NOT NULL,
 mime_type TEXT NOT NULL, uploaded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS portal_documents_request_id_idx ON portal_documents(request_id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS portal_document_id TEXT;
DO $$ BEGIN ALTER TABLE documents ADD CONSTRAINT documents_portal_document_id_fkey FOREIGN KEY(portal_document_id) REFERENCES portal_documents(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMIT;
