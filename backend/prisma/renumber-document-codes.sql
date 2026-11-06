-- Explicit PO-authorized data conversion. Back up and test a restore before applying.
-- Existing short codes remain stable; old codes receive the next sequence values.
-- UUIDs, timestamps, snapshots, historical text and all other columns are preserved.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE portal_requests, loan_applications IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE document_code_mapping (
  prefix text NOT NULL, id text NOT NULL, old_code text NOT NULL,
  new_code text NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(prefix, id), UNIQUE(prefix, new_code)
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.document_code_protected_state() RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  item record;
  row_count bigint;
  row_digest text;
  expression text;
  result jsonb := '[]'::jsonb;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    expression := CASE item.tablename
      WHEN 'portal_requests' THEN 'to_jsonb(t) - ''reference'''
      WHEN 'loan_applications' THEN 'to_jsonb(t) - ''application_code'''
      ELSE 'to_jsonb(t)' END;
    EXECUTE format('SELECT count(*),md5(COALESCE(string_agg(md5((%s)::text),'','' ORDER BY md5((%s)::text)),'''')) FROM public.%I t', expression, expression, item.tablename)
      INTO row_count, row_digest;
    result := result || jsonb_build_array(jsonb_build_object('table',item.tablename,'count',row_count,'digest',row_digest));
  END LOOP;
  RETURN result;
END
$function$;

CREATE TEMP TABLE document_code_before ON COMMIT DROP AS SELECT pg_temp.document_code_protected_state() AS fingerprint;

DO $renumber$
DECLARE
  item record;
  allocated text;
BEGIN
  FOR item IN SELECT id,reference,created_at FROM portal_requests
    WHERE reference !~ '^DN-[1-9][0-9]*$' ORDER BY created_at,id LOOP
    allocated := 'DN-' || nextval('portal_request_reference_seq'::regclass)::text;
    UPDATE portal_requests SET reference=allocated WHERE id=item.id;
    INSERT INTO document_code_mapping VALUES ('DN',item.id,item.reference,allocated,item.created_at);
  END LOOP;
  FOR item IN SELECT id,application_code,created_at FROM loan_applications
    WHERE application_code !~ '^SME-[1-9][0-9]*$' ORDER BY created_at,id LOOP
    allocated := 'SME-' || nextval('loan_application_code_seq'::regclass)::text;
    UPDATE loan_applications SET application_code=allocated WHERE id=item.id;
    INSERT INTO document_code_mapping VALUES ('SME',item.id,item.application_code,allocated,item.created_at);
  END LOOP;
  IF (SELECT fingerprint FROM document_code_before) IS DISTINCT FROM pg_temp.document_code_protected_state() THEN
    RAISE EXCEPTION 'Renumbering changed data outside the two authorized code columns';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_requests WHERE reference !~ '^DN-[1-9][0-9]*$')
    OR EXISTS(SELECT 1 FROM loan_applications WHERE application_code !~ '^SME-[1-9][0-9]*$') THEN
    RAISE EXCEPTION 'Legacy document codes remain';
  END IF;
END
$renumber$;

-- The caller must retain this mapping privately, together with the database backup.
SELECT COALESCE(json_agg(row_to_json(m) ORDER BY prefix,created_at,id),'[]'::json) FROM document_code_mapping m;
COMMIT;
