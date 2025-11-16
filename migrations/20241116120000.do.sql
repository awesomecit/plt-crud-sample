-- Migration 002: Users, Versioning, Tags, Attachments
-- Adds: authentication, report versions (1-1), tags (N-M), attachments (1-N)

-- ============================================================================
-- USERS TABLE (Authentication - separate from practitioners)
-- ============================================================================
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt/argon2 hash
  role VARCHAR(50) DEFAULT 'USER',               -- USER, ADMIN, AUDITOR
  practitioner_id INTEGER,                       -- Optional link to practitioner
  active BOOLEAN DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,                           -- Soft delete
  deleted_by INTEGER,
  FOREIGN KEY (practitioner_id) REFERENCES practitioners(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ============================================================================
-- REPORT VERSIONS (1-1 relationship: report has ONE current version)
-- ============================================================================
CREATE TABLE report_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  findings TEXT,
  diagnosis TEXT,
  changed_by INTEGER NOT NULL,                   -- User who made the change
  change_reason VARCHAR(500),                    -- Why was it amended
  is_current BOOLEAN DEFAULT 0,                  -- Only ONE version is current
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id),
  UNIQUE (report_id, version_number)             -- Ensure version uniqueness
);

CREATE INDEX idx_report_versions_report ON report_versions(report_id);
CREATE INDEX idx_report_versions_current ON report_versions(report_id, is_current);
CREATE INDEX idx_report_versions_deleted_at ON report_versions(deleted_at);

-- ============================================================================
-- TAGS (N-M relationship: reports can have multiple tags, tags on multiple reports)
-- ============================================================================
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,              -- e.g., DIABETES, HYPERTENSION, COVID19
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),                         -- DIAGNOSIS, SYMPTOM, PROCEDURE, etc.
  description TEXT,
  color VARCHAR(7),                              -- Hex color for UI (e.g., #FF5733)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE INDEX idx_tags_code ON tags(code);
CREATE INDEX idx_tags_category ON tags(category);
CREATE INDEX idx_tags_deleted_at ON tags(deleted_at);

-- ============================================================================
-- REPORT_TAGS (Junction table for N-M relationship)
-- ============================================================================
CREATE TABLE report_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  tagged_by INTEGER NOT NULL,                    -- User who added the tag
  tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id),
  FOREIGN KEY (tagged_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id),
  UNIQUE (report_id, tag_id)                     -- Prevent duplicate tags on same report
);

CREATE INDEX idx_report_tags_report ON report_tags(report_id);
CREATE INDEX idx_report_tags_tag ON report_tags(tag_id);
CREATE INDEX idx_report_tags_deleted_at ON report_tags(deleted_at);

-- ============================================================================
-- ATTACHMENTS (1-N relationship: ONE report has MANY attachments)
-- ============================================================================
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,               -- application/pdf, image/jpeg, etc.
  file_size INTEGER NOT NULL,                    -- bytes
  storage_path VARCHAR(500) NOT NULL,            -- S3 key or local path
  checksum VARCHAR(64),                          -- SHA256 for integrity
  uploaded_by INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE INDEX idx_attachments_report ON attachments(report_id);
CREATE INDEX idx_attachments_mime_type ON attachments(mime_type);
CREATE INDEX idx_attachments_deleted_at ON attachments(deleted_at);

-- ============================================================================
-- ADD current_version_id to reports (1-1 relationship)
-- ============================================================================
ALTER TABLE reports ADD COLUMN current_version_id INTEGER;
ALTER TABLE reports ADD COLUMN last_modified_by INTEGER;

CREATE INDEX idx_reports_current_version ON reports(current_version_id);

-- Note: Foreign key constraint for current_version_id will be added after 
-- initial data migration to avoid circular dependency issues
