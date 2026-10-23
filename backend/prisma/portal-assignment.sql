-- Additive only; apply after portal-phase1.sql to the authorized local DB.
-- Commit enum addition before using the value in a later transaction.
ALTER TYPE "PortalRequestStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
BEGIN;
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS assigned_by TEXT;
ALTER TABLE portal_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP(3);
DO $$ BEGIN ALTER TABLE portal_requests ADD CONSTRAINT portal_requests_assigned_to_fkey FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE portal_requests ADD CONSTRAINT portal_requests_assigned_by_fkey FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS portal_requests_assigned_to_status_idx ON portal_requests(assigned_to,status);
CREATE TABLE IF NOT EXISTS portal_assignments (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES portal_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 from_user_id TEXT REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 note TEXT, assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS portal_assignments_request_id_assigned_at_idx ON portal_assignments(request_id,assigned_at);
CREATE TABLE IF NOT EXISTS internal_notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 request_id TEXT NOT NULL REFERENCES portal_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 title TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS internal_notifications_user_id_created_at_idx ON internal_notifications(user_id,created_at);
COMMIT;
