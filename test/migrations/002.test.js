'use strict'

const t = require('tap')
const { createTestServer } = require('../helper')

t.test('Migration 002 creates users table with authentication fields', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(users)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('username'), 'has username column')
  t.ok(columns.includes('email'), 'has email column')
  t.ok(columns.includes('password_hash'), 'has password_hash column')
  t.ok(columns.includes('role'), 'has role column')
  t.ok(columns.includes('practitioner_id'), 'has practitioner_id FK')
  t.ok(columns.includes('deleted_at'), 'has soft delete column')
})

t.test('Migration 002 creates report_versions table for versioning', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(report_versions)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('report_id'), 'has report_id FK')
  t.ok(columns.includes('version_number'), 'has version_number')
  t.ok(columns.includes('is_current'), 'has is_current flag')
  t.ok(columns.includes('changed_by'), 'has changed_by user FK')
  t.ok(columns.includes('change_reason'), 'has change_reason')
  
  const versionNumberCol = schema.find(c => c.name === 'version_number')
  t.equal(versionNumberCol.dflt_value, '1', 'version_number defaults to 1')
})

t.test('Migration 002 creates tags table', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(tags)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('code'), 'has code column')
  t.ok(columns.includes('category'), 'has category column')
  t.ok(columns.includes('color'), 'has color column for UI')
})

t.test('Migration 002 creates report_tags junction table (N-M)', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(report_tags)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('report_id'), 'has report_id FK')
  t.ok(columns.includes('tag_id'), 'has tag_id FK')
  t.ok(columns.includes('tagged_by'), 'has tagged_by user FK')
  t.ok(columns.includes('tagged_at'), 'has tagged_at timestamp')
  
  // Check UNIQUE constraint exists
  const indexes = await app.platformatic.db.query(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='report_tags'
  `)
  
  const createSql = indexes[0]?.sql || ''
  t.ok(createSql.includes('UNIQUE'), 'has UNIQUE constraint to prevent duplicate tags')
})

t.test('Migration 002 creates attachments table (1-N)', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(attachments)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('report_id'), 'has report_id FK')
  t.ok(columns.includes('filename'), 'has filename')
  t.ok(columns.includes('mime_type'), 'has mime_type')
  t.ok(columns.includes('file_size'), 'has file_size')
  t.ok(columns.includes('storage_path'), 'has storage_path')
  t.ok(columns.includes('checksum'), 'has checksum for integrity')
  t.ok(columns.includes('uploaded_by'), 'has uploaded_by user FK')
})

t.test('Migration 002 adds current_version_id to reports (1-1 relationship)', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(reports)
  `)
  
  const columns = schema.map(c => c.name)
  t.ok(columns.includes('current_version_id'), 'has current_version_id column')
  t.ok(columns.includes('last_modified_by'), 'has last_modified_by column')
})

t.test('Migration 002 creates required indexes', async (t) => {
  const app = await createTestServer(t)
  
  const indexes = await app.platformatic.db.query(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND name LIKE 'idx_%'
  `)
  
  const indexNames = indexes.map(idx => idx.name)
  
  // Users indexes
  t.ok(indexNames.includes('idx_users_username'), 'has users username index')
  t.ok(indexNames.includes('idx_users_email'), 'has users email index')
  t.ok(indexNames.includes('idx_users_role'), 'has users role index')
  t.ok(indexNames.includes('idx_users_deleted_at'), 'has users soft delete index')
  
  // Report versions indexes
  t.ok(indexNames.includes('idx_report_versions_report'), 'has report versions report index')
  t.ok(indexNames.includes('idx_report_versions_current'), 'has report versions current index')
  
  // Tags indexes
  t.ok(indexNames.includes('idx_tags_code'), 'has tags code index')
  t.ok(indexNames.includes('idx_tags_category'), 'has tags category index')
  
  // Junction table indexes
  t.ok(indexNames.includes('idx_report_tags_report'), 'has report_tags report index')
  t.ok(indexNames.includes('idx_report_tags_tag'), 'has report_tags tag index')
  
  // Attachments indexes
  t.ok(indexNames.includes('idx_attachments_report'), 'has attachments report index')
  t.ok(indexNames.includes('idx_attachments_mime_type'), 'has attachments mime_type index')
})

t.test('Migration 002 enforces UNIQUE constraints', async (t) => {
  const app = await createTestServer(t)
  
  // Insert user
  await app.platformatic.db.query(`
    INSERT INTO users (username, email, password_hash, role) 
    VALUES ('admin', 'admin@hospital.example', 'hashed123', 'ADMIN')
  `)
  
  // Try duplicate username (should fail with sync exception)
  t.throws(
    () => app.platformatic.db.query(`
      INSERT INTO users (username, email, password_hash, role) 
      VALUES ('admin', 'other@hospital.example', 'hashed456', 'USER')
    `),
    /UNIQUE constraint failed/,
    'username must be unique'
  )
})

t.test('Migration 002 allows soft delete on all new tables', async (t) => {
  const app = await createTestServer(t)
  
  const tables = ['users', 'report_versions', 'tags', 'report_tags', 'attachments']
  
  for (const table of tables) {
    const schema = await app.platformatic.db.query(`
      PRAGMA table_info(${table})
    `)
    
    const hasDeletedAt = schema.some(c => c.name === 'deleted_at')
    const hasDeletedBy = schema.some(c => c.name === 'deleted_by')
    
    t.ok(hasDeletedAt, `${table} has deleted_at for GDPR compliance`)
    t.ok(hasDeletedBy, `${table} has deleted_by for audit trail`)
  }
})

t.test('Healthcare: report versioning workflow', async (t) => {
  const app = await createTestServer(t)
  
  // Setup: create required entities
  await app.platformatic.db.query(`
    INSERT INTO users (username, email, password_hash, role) 
    VALUES ('dr.smith', 'smith@hospital.example', 'hash', 'USER')
  `)
  
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('LAB', 'Lab Analysis')
  `)
  
  await app.platformatic.db.query(`
    INSERT INTO practitioners (license_number, first_name, last_name, email) 
    VALUES ('MED001', 'John', 'Smith', 'j.smith@hospital.example')
  `)
  
  await app.platformatic.db.query(`
    INSERT INTO patients (patient_code, first_name, last_name, date_of_birth) 
    VALUES ('PAT001', 'Jane', 'Doe', '1980-01-01')
  `)
  
  await app.platformatic.db.query(`
    INSERT INTO reports (report_number, report_type_id, patient_id, practitioner_id, report_date, title, content, status)
    VALUES ('RPT001', 1, 1, 1, '2025-11-16', 'Blood Test', 'Results...', 'DRAFT')
  `)
  
  // Create version 1
  await app.platformatic.db.query(`
    INSERT INTO report_versions (report_id, version_number, title, content, changed_by, is_current)
    VALUES (1, 1, 'Blood Test', 'Initial results', 1, 1)
  `)
  
  const [version] = await app.platformatic.db.query(`
    SELECT version_number, is_current FROM report_versions WHERE report_id = 1
  `)
  
  t.equal(version.version_number, 1, 'version 1 created')
  t.equal(version.is_current, 1, 'version 1 is current')
})

t.test('Healthcare: N-M tagging workflow', async (t) => {
  const app = await createTestServer(t)
  
  // Setup
  await app.platformatic.db.query(`INSERT INTO users (username, email, password_hash) VALUES ('tagger', 'tagger@hospital.example', 'hash')`)
  await app.platformatic.db.query(`INSERT INTO report_types (code, name) VALUES ('DIAG', 'Diagnosis')`)
  await app.platformatic.db.query(`INSERT INTO practitioners (license_number, first_name, last_name, email) VALUES ('MED002', 'A', 'B', 'ab@hospital.example')`)
  await app.platformatic.db.query(`INSERT INTO patients (patient_code, first_name, last_name, date_of_birth) VALUES ('PAT002', 'C', 'D', '1990-01-01')`)
  await app.platformatic.db.query(`INSERT INTO reports (report_number, report_type_id, patient_id, practitioner_id, report_date, title, content, status) VALUES ('RPT002', 1, 1, 1, '2025-11-16', 'Diagnosis', 'Content', 'FINAL')`)
  
  // Create tags
  await app.platformatic.db.query(`INSERT INTO tags (code, name, category, color) VALUES ('DIABETES', 'Diabetes Mellitus', 'DIAGNOSIS', '#FF5733')`)
  await app.platformatic.db.query(`INSERT INTO tags (code, name, category, color) VALUES ('URGENT', 'Urgent Case', 'PRIORITY', '#FF0000')`)
  
  // Tag report with multiple tags
  await app.platformatic.db.query(`INSERT INTO report_tags (report_id, tag_id, tagged_by) VALUES (1, 1, 1)`)
  await app.platformatic.db.query(`INSERT INTO report_tags (report_id, tag_id, tagged_by) VALUES (1, 2, 1)`)
  
  const tags = await app.platformatic.db.query(`
    SELECT COUNT(*) as count FROM report_tags WHERE report_id = 1
  `)
  
  t.equal(tags[0].count, 2, 'report has 2 tags')
})
