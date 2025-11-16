# TASK-001: Create Soft Delete Migration

**Story**: STORY-001  
**Epic**: EPIC-001  
**Status**: COMPLETED  
**Assignee**: AI Agent  
**Effort**: 1h  
**Completed**: 2025-11-16

## Objective
Create migration files `001.do.sql` and `001.undo.sql` to add soft-delete columns to `products`, `categories`, `users` tables.

## Acceptance Criteria
```gherkin
GIVEN empty migrations/ directory
WHEN I create 001.do.sql with ALTER TABLE statements
THEN products, categories, users tables gain:
  - deleted_at DATETIME DEFAULT NULL
  - deleted_by INTEGER (FK to users.id)
  - Index on deleted_at

WHEN I run `npx platformatic db migrations apply`
THEN migration executes without errors
  AND schema matches expected state

WHEN I run migration with --to 000 (rollback)
THEN columns are removed
  AND no orphan constraints remain

EDGE CASES:
- [ ] Re-running migration is idempotent (no duplicate columns)
- [ ] Rollback on empty table vs table with data
- [ ] Foreign key cascade behavior

VERIFICATION:
- [ ] Unit test: load migration, check SQL syntax
- [ ] Integration test: apply to test DB, query schema
- [ ] Manual: `sqlite3 db.sqlite ".schema products"`
```

## Implementation Steps (TDD)

### RED: Write Failing Test
```javascript
// test/migrations/001.test.js
const t = require('tap')
const { buildServer } = require('../helper')

t.test('Migration 001 adds soft delete columns', async (t) => {
  const app = await buildServer(t)
  
  // Apply migration
  await app.platformatic.db.migrate()
  
  // Check schema
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(products)
  `)
  
  const deletedAtCol = schema.find(c => c.name === 'deleted_at')
  t.ok(deletedAtCol, 'deleted_at column exists')
  t.equal(deletedAtCol.type, 'DATETIME', 'deleted_at is DATETIME')
  t.equal(deletedAtCol.dflt_value, 'NULL', 'deleted_at defaults to NULL')
  
  const deletedByCol = schema.find(c => c.name === 'deleted_by')
  t.ok(deletedByCol, 'deleted_by column exists')
})
```

### GREEN: Create Migration
```sql
-- migrations/001.do.sql
ALTER TABLE products ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE products ADD COLUMN deleted_by INTEGER;
ALTER TABLE categories ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE categories ADD COLUMN deleted_by INTEGER;
ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN deleted_by INTEGER;

CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

```sql
-- migrations/001.undo.sql
DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_categories_deleted_at;
DROP INDEX IF EXISTS idx_products_deleted_at;

ALTER TABLE users DROP COLUMN deleted_by;
ALTER TABLE users DROP COLUMN deleted_at;
ALTER TABLE categories DROP COLUMN deleted_by;
ALTER TABLE categories DROP COLUMN deleted_at;
ALTER TABLE products DROP COLUMN deleted_by;
ALTER TABLE products DROP COLUMN deleted_at;
```

### REFACTOR
- Validate SQL syntax with sqlfluff
- Add migration description comment
- Update CHANGELOG.md

## Dependencies
- Base tables (products, categories, users) must exist (migration 000 or initial schema)
- Platformatic DB installed

## Test Strategy
1. **Unit**: SQL syntax validation
2. **Integration**: Apply to test DB, verify schema
3. **E2E**: Full app start, check entity metadata

## Rollback Plan
If migration fails in production:
```bash
npx platformatic db migrations apply --to 000
# Remove migration files
# Re-run previous stable migration
```

## Notes
- SQLite `ALTER TABLE DROP COLUMN` requires SQLite 3.35+ (check version)
- PostgreSQL syntax identical except `TIMESTAMP` vs `DATETIME`
- Consider generated column for `is_deleted` (deleted_at IS NOT NULL) if needed

## Completion Checklist
- [ ] Migration files created in `migrations/`
- [ ] Test written and passing
- [ ] Applied to local dev DB
- [ ] Rollback tested successfully
- [ ] CHANGELOG.md updated
- [ ] Committed with message: `feat(migration): add soft-delete columns (TASK-001)`
