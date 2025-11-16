# STORY-001: Database Schema per Soft Delete

**Epic**: EPIC-001  
**Status**: NOT_STARTED  
**Points**: 2  
**Owner**: TBD

## User Story
AS A system administrator  
I WANT deleted records to remain in the database  
SO THAT I can recover them if needed

## Acceptance Criteria
```gherkin
GIVEN products table exists
WHEN migration 001 is applied
THEN products table has deleted_at DATETIME NULL
  AND products table has deleted_by INTEGER NULL
  AND index idx_products_deleted_at exists

EDGE CASES:
- [ ] Migration idempotent (re-run safe)
- [ ] Rollback removes columns cleanly
- [ ] Existing data unaffected (NULL defaults)

VERIFICATION:
- [ ] `npm run migrate` succeeds
- [ ] Schema introspection confirms columns
- [ ] `npm run migrate:undo` removes columns
```

## Tasks
- **TASK-001**: Create migration 001.do.sql and 001.undo.sql

## Technical Notes
- SQLite: `ALTER TABLE ADD COLUMN` supportato
- PostgreSQL: same syntax, TIMESTAMP vs DATETIME
- Index needed: `deleted_at` filtrato in ogni query

## DoD Checklist
- [ ] Migration files created
- [ ] Applied to local DB
- [ ] Rollback tested
- [ ] Documented in CHANGELOG.md
