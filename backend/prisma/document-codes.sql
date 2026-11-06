-- Apply once before starting the backend version that uses nextDocumentCode.
-- Adds two independent counters; never renames or updates existing records.
-- Reapplication does not reset counters (including numbers used by rolled-back transactions).
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('sme-document-codes-migration'))::text;

DO $migration$
DECLARE
  next_code bigint;
BEGIN
  IF to_regclass('portal_request_reference_seq') IS NULL THEN
    CREATE SEQUENCE portal_request_reference_seq AS bigint MINVALUE 1 START WITH 1 NO CYCLE CACHE 1;
    SELECT COALESCE(MAX(substring(reference FROM '^DN-([0-9]+)$')::bigint), 0) + 1
      INTO next_code FROM portal_requests;
    PERFORM setval('portal_request_reference_seq'::regclass, next_code, false);
  END IF;

  IF to_regclass('loan_application_code_seq') IS NULL THEN
    CREATE SEQUENCE loan_application_code_seq AS bigint MINVALUE 1 START WITH 1 NO CYCLE CACHE 1;
    SELECT COALESCE(MAX(substring(application_code FROM '^SME-([0-9]+)$')::bigint), 0) + 1
      INTO next_code FROM loan_applications;
    PERFORM setval('loan_application_code_seq'::regclass, next_code, false);
  END IF;
END
$migration$;
COMMIT;
