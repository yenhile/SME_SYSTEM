-- Additive, repeatable: lets the bank close a submitted Portal request (e.g. wrong legal entity). No records are replaced.
ALTER TYPE "PortalRequestStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
BEGIN;
ALTER TABLE "portal_requests" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3);
ALTER TABLE "portal_requests" ADD COLUMN IF NOT EXISTS "closed_by" TEXT;
ALTER TABLE "portal_requests" ADD COLUMN IF NOT EXISTS "closed_reason" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portal_requests_closed_by_fkey') THEN
    ALTER TABLE "portal_requests" ADD CONSTRAINT "portal_requests_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
COMMIT;
