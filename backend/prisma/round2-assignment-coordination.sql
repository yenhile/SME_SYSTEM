-- Additive Package B/C migration. Existing rows remain unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
-- AlterTable
ALTER TABLE "portal_assignments" ADD COLUMN IF NOT EXISTS     "assignment_change_request_id" TEXT;

-- AlterTable
ALTER TABLE "internal_notifications" ADD COLUMN IF NOT EXISTS     "assignment_change_request_id" TEXT;

-- AlterTable
ALTER TABLE "application_assignments" ADD COLUMN IF NOT EXISTS     "assignment_change_request_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "assignment_change_requests" (
    "id" TEXT NOT NULL,
    "portal_request_id" TEXT,
    "application_id" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "assignment_version_at_request" INTEGER NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "request_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "decision_reason" TEXT,
    "resolution_code" TEXT,
    "target_officer_id" TEXT,
    "manager_recipient_count" INTEGER NOT NULL DEFAULT 0,
    "create_client_request_id" TEXT NOT NULL,
    "create_payload_hash" TEXT NOT NULL,
    "resolution_client_request_id" TEXT,
    "resolution_payload_hash" TEXT,

    CONSTRAINT "assignment_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assignment_change_requests_status_created_at_idx" ON "assignment_change_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assignment_change_requests_application_id_status_idx" ON "assignment_change_requests"("application_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assignment_change_requests_portal_request_id_status_idx" ON "assignment_change_requests"("portal_request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "assignment_change_requests_requested_by_id_create_client_re_key" ON "assignment_change_requests"("requested_by_id", "create_client_request_id");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_assignments_assignment_change_request_id_fkey' AND conrelid='portal_assignments'::regclass) THEN ALTER TABLE "portal_assignments" ADD CONSTRAINT "portal_assignments_assignment_change_request_id_fkey" FOREIGN KEY ("assignment_change_request_id") REFERENCES "assignment_change_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='internal_notifications_assignment_change_request_id_fkey' AND conrelid='internal_notifications'::regclass) THEN ALTER TABLE "internal_notifications" ADD CONSTRAINT "internal_notifications_assignment_change_request_id_fkey" FOREIGN KEY ("assignment_change_request_id") REFERENCES "assignment_change_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='application_assignments_assignment_change_request_id_fkey' AND conrelid='application_assignments'::regclass) THEN ALTER TABLE "application_assignments" ADD CONSTRAINT "application_assignments_assignment_change_request_id_fkey" FOREIGN KEY ("assignment_change_request_id") REFERENCES "assignment_change_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignment_change_requests_portal_request_id_fkey' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE "assignment_change_requests" ADD CONSTRAINT "assignment_change_requests_portal_request_id_fkey" FOREIGN KEY ("portal_request_id") REFERENCES "portal_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignment_change_requests_application_id_fkey' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE "assignment_change_requests" ADD CONSTRAINT "assignment_change_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignment_change_requests_requested_by_id_fkey' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE "assignment_change_requests" ADD CONSTRAINT "assignment_change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignment_change_requests_resolved_by_id_fkey' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE "assignment_change_requests" ADD CONSTRAINT "assignment_change_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignment_change_requests_target_officer_id_fkey' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE "assignment_change_requests" ADD CONSTRAINT "assignment_change_requests_target_officer_id_fkey" FOREIGN KEY ("target_officer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;


CREATE UNIQUE INDEX IF NOT EXISTS coordination_pending_loan_key ON assignment_change_requests(application_id) WHERE status='PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS coordination_pending_portal_key ON assignment_change_requests(portal_request_id) WHERE status='PENDING';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='coordination_subject_check' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE assignment_change_requests ADD CONSTRAINT coordination_subject_check CHECK ((portal_request_id IS NOT NULL) <> (application_id IS NOT NULL)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='coordination_status_check' AND conrelid='assignment_change_requests'::regclass) THEN ALTER TABLE assignment_change_requests ADD CONSTRAINT coordination_status_check CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','OBSOLETE')); END IF; END $$;
COMMIT;
