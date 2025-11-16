-- Rollback Migration 002: Remove Users, Versioning, Tags, Attachments

-- Remove indexes first
DROP INDEX IF EXISTS idx_reports_current_version;

-- Remove added columns from reports
ALTER TABLE reports DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE reports DROP COLUMN IF EXISTS current_version_id;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS report_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS report_versions;

DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

DROP TABLE IF EXISTS users;
