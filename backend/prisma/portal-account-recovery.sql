-- Additive, repeatable Portal-only recovery migration. No records are replaced.
BEGIN;
ALTER TABLE "portal_accounts" ADD COLUMN IF NOT EXISTS "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "portal_accounts" ADD COLUMN IF NOT EXISTS "password_reset_hash" TEXT;
ALTER TABLE "portal_accounts" ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMP(3);
ALTER TABLE "portal_accounts" ADD COLUMN IF NOT EXISTS "password_reset_sent_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "portal_accounts_password_reset_hash_key" ON "portal_accounts"("password_reset_hash");
COMMIT;
