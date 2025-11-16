# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial healthcare document management domain (reports, practitioners, patients, report_types)
- Migration 000: Base schema with medical entities
- Migration 001: Soft-delete columns for GDPR/HIPAA compliance (TASK-001)
- Test suite for migration 001 (TAP framework)
- Project structure: EPIC-001/002/003 breakdown
- Compliance documentation (GDPR/HIPAA requirements)
- README with healthcare domain examples

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- Hashed SSN storage (ssn_hash field)
- Soft-delete mandatory for compliance
- Audit trail infrastructure (deleted_by tracking)

## [0.1.0] - YYYY-MM-DD (planned)

### Target Features

- EPIC-001: Complete soft-delete system with restore API
- EPIC-002: Automatic versioning for reports
- EPIC-003: Universal audit log

---

**Status**: TASK-001 completed (schema), TASK-002 in progress (plugin hooks)
