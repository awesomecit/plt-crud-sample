-- migrations/001.undo.sql
DROP INDEX IF EXISTS idx_patients_deleted_at;
DROP INDEX IF EXISTS idx_practitioners_deleted_at;
DROP INDEX IF EXISTS idx_report_types_deleted_at;
DROP INDEX IF EXISTS idx_reports_deleted_at;

-- Note: SQLite ALTER TABLE DROP COLUMN requires 3.35+
-- WARNING: Rollback in production healthcare environment requires regulatory approval
ALTER TABLE patients DROP COLUMN deleted_by;
ALTER TABLE patients DROP COLUMN deleted_at;

ALTER TABLE practitioners DROP COLUMN deleted_by;
ALTER TABLE practitioners DROP COLUMN deleted_at;

ALTER TABLE report_types DROP COLUMN deleted_by;
ALTER TABLE report_types DROP COLUMN deleted_at;

ALTER TABLE reports DROP COLUMN deleted_by;
ALTER TABLE reports DROP COLUMN deleted_at;
