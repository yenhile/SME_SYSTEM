-- Removes the CAP_TREN stage and the WAITING_HEAD_OFFICE status. Apply only to the explicitly selected schema, after a backup.
-- Stops without changes if any loan or stage history other than the seeded sample still depends on them.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM loan_applications
    WHERE (current_stage::text = 'CAP_TREN' OR current_status::text = 'WAITING_HEAD_OFFICE')
      AND application_code <> 'SME-20260920-0003'
  ) THEN
    RAISE EXCEPTION 'Còn hồ sơ khác ở Cấp trên; dừng để xử lý riêng.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM application_stage_history h
    JOIN workflow_stages s ON s.id = h.stage_id
    WHERE s.stage_code::text = 'CAP_TREN'
  ) THEN
    RAISE EXCEPTION 'Còn lịch sử công đoạn Cấp trên; dừng để xử lý riêng.';
  END IF;
END $$;

DELETE FROM loan_applications WHERE application_code = 'SME-20260920-0003' AND current_stage::text = 'CAP_TREN';
DELETE FROM workflow_stages WHERE stage_code::text = 'CAP_TREN';
UPDATE workflow_stages SET order_index = 3 WHERE stage_code::text = 'HOAN_TAT';

ALTER TYPE "StageCode" RENAME TO "StageCode_old";
CREATE TYPE "StageCode" AS ENUM ('TIEP_NHAN', 'THAM_DINH', 'HOAN_TAT');
ALTER TABLE loan_applications ALTER COLUMN current_stage DROP DEFAULT;
ALTER TABLE loan_applications ALTER COLUMN current_stage TYPE "StageCode" USING current_stage::text::"StageCode";
ALTER TABLE loan_applications ALTER COLUMN current_stage SET DEFAULT 'TIEP_NHAN';
ALTER TABLE workflow_stages ALTER COLUMN stage_code TYPE "StageCode" USING stage_code::text::"StageCode";
DROP TYPE "StageCode_old";

ALTER TYPE "LoanStatus" RENAME TO "LoanStatus_old";
CREATE TYPE "LoanStatus" AS ENUM ('RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL', 'APPROVED', 'REJECTED', 'CLOSED_TIMEOUT');
ALTER TABLE loan_applications ALTER COLUMN current_status DROP DEFAULT;
ALTER TABLE loan_applications ALTER COLUMN current_status TYPE "LoanStatus" USING current_status::text::"LoanStatus";
ALTER TABLE loan_applications ALTER COLUMN current_status SET DEFAULT 'RECEIVED';
DROP TYPE "LoanStatus_old";

COMMIT;
