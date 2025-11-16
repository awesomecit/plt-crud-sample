-- migrations/001.do.sql - Add soft delete columns (MANDATORY for healthcare compliance)
-- GDPR/HIPAA requirement: never hard-delete medical records
ALTER TABLE reports ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE reports ADD COLUMN deleted_by INTEGER;

ALTER TABLE report_types ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE report_types ADD COLUMN deleted_by INTEGER;

ALTER TABLE practitioners ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE practitioners ADD COLUMN deleted_by INTEGER;

ALTER TABLE patients ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE patients ADD COLUMN deleted_by INTEGER;

CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);
CREATE INDEX idx_report_types_deleted_at ON report_types(deleted_at);
CREATE INDEX idx_practitioners_deleted_at ON practitioners(deleted_at);
CREATE INDEX idx_patients_deleted_at ON patients(deleted_at);
