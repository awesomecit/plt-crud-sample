-- migrations/000.do.sql - Initial schema: Healthcare Document Management
-- Domain: Medical Reports with revisions (HIPAA/GDPR compliant)

CREATE TABLE report_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,        -- e.g., LAB_ANALYSIS, RADIOLOGY, DIAGNOSIS
  name VARCHAR(255) NOT NULL,
  description TEXT,
  retention_years INTEGER DEFAULT 10,      -- Legal retention requirement
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practitioners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_number VARCHAR(100) NOT NULL UNIQUE,  -- Medical license
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  specialization VARCHAR(255),
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_code VARCHAR(100) NOT NULL UNIQUE,   -- Anonymized patient ID
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  ssn_hash VARCHAR(64),                         -- Hashed SSN for privacy
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_number VARCHAR(100) NOT NULL UNIQUE,   -- Unique report identifier
  report_type_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  practitioner_id INTEGER NOT NULL,
  report_date DATE NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,                        -- Main report content
  findings TEXT,                                -- Clinical findings
  diagnosis TEXT,                               -- Diagnosis/conclusion
  status VARCHAR(50) DEFAULT 'DRAFT',           -- DRAFT, FINAL, AMENDED, SUPERSEDED
  signed_at DATETIME,
  signature_hash VARCHAR(128),                  -- Digital signature verification
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_type_id) REFERENCES report_types(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (practitioner_id) REFERENCES practitioners(id)
);

CREATE INDEX idx_reports_type ON reports(report_type_id);
CREATE INDEX idx_reports_patient ON reports(patient_id);
CREATE INDEX idx_reports_practitioner ON reports(practitioner_id);
CREATE INDEX idx_reports_date ON reports(report_date);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_number ON reports(report_number);
