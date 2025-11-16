'use strict'

const t = require('tap')
const { createTestServer } = require('../helper')

t.test('Migration 001 adds soft delete columns to reports', async (t) => {
  const app = await createTestServer(t)
  
  // Query schema to verify deleted_at column exists
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(reports)
  `)
  
  const deletedAtCol = schema.find(c => c.name === 'deleted_at')
  t.ok(deletedAtCol, 'reports.deleted_at column exists')
  t.equal(deletedAtCol.type, 'DATETIME', 'deleted_at is DATETIME type')
  
  const deletedByCol = schema.find(c => c.name === 'deleted_by')
  t.ok(deletedByCol, 'reports.deleted_by column exists')
  t.equal(deletedByCol.type, 'INTEGER', 'deleted_by is INTEGER type')
})

t.test('Migration 001 adds soft delete columns to report_types', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(report_types)
  `)
  
  const deletedAtCol = schema.find(c => c.name === 'deleted_at')
  t.ok(deletedAtCol, 'report_types.deleted_at column exists')
  
  const deletedByCol = schema.find(c => c.name === 'deleted_by')
  t.ok(deletedByCol, 'report_types.deleted_by column exists')
})

t.test('Migration 001 adds soft delete columns to practitioners', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(practitioners)
  `)
  
  const deletedAtCol = schema.find(c => c.name === 'deleted_at')
  t.ok(deletedAtCol, 'practitioners.deleted_at column exists')
  
  const deletedByCol = schema.find(c => c.name === 'deleted_by')
  t.ok(deletedByCol, 'practitioners.deleted_by column exists')
})

t.test('Migration 001 adds soft delete columns to patients', async (t) => {
  const app = await createTestServer(t)
  
  const schema = await app.platformatic.db.query(`
    PRAGMA table_info(patients)
  `)
  
  const deletedAtCol = schema.find(c => c.name === 'deleted_at')
  t.ok(deletedAtCol, 'patients.deleted_at column exists')
  
  const deletedByCol = schema.find(c => c.name === 'deleted_by')
  t.ok(deletedByCol, 'patients.deleted_by column exists')
})

t.test('Migration 001 creates indexes on deleted_at', async (t) => {
  const app = await createTestServer(t)
  
  const indexes = await app.platformatic.db.query(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND name LIKE '%deleted_at%'
  `)
  
  const indexNames = indexes.map(idx => idx.name)
  
  t.ok(indexNames.includes('idx_reports_deleted_at'), 'idx_reports_deleted_at exists')
  t.ok(indexNames.includes('idx_report_types_deleted_at'), 'idx_report_types_deleted_at exists')
  t.ok(indexNames.includes('idx_practitioners_deleted_at'), 'idx_practitioners_deleted_at exists')
  t.ok(indexNames.includes('idx_patients_deleted_at'), 'idx_patients_deleted_at exists')
})

t.test('Migration 001 allows NULL values for deleted_at (active records)', async (t) => {
  const app = await createTestServer(t)
  
  // Insert test data
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('LAB', 'Laboratory Analysis')
  `)
  await app.platformatic.db.query(`
    INSERT INTO practitioners (license_number, first_name, last_name, email) 
    VALUES ('MED12345', 'John', 'Doe', 'j.doe@hospital.com')
  `)
  await app.platformatic.db.query(`
    INSERT INTO patients (patient_code, first_name, last_name, date_of_birth) 
    VALUES ('PAT001', 'Jane', 'Smith', '1980-05-15')
  `)
  await app.platformatic.db.query(`
    INSERT INTO reports (report_number, report_type_id, patient_id, practitioner_id, report_date, title, content, status)
    VALUES ('RPT-2025-001', 1, 1, 1, '2025-11-16', 'Blood Test Results', 'Normal values', 'FINAL')
  `)
  
  const [report] = await app.platformatic.db.query(`
    SELECT deleted_at FROM reports WHERE report_number = 'RPT-2025-001'
  `)
  
  t.equal(report.deleted_at, null, 'deleted_at defaults to NULL for active reports')
})

t.test('Healthcare compliance: soft delete is mandatory (no hard delete)', async (t) => {
  const app = await createTestServer(t)
  
  // This test verifies the presence of soft-delete infrastructure
  // Actual hook implementation will prevent hard deletes in TASK-002
  
  const tables = ['reports', 'report_types', 'practitioners', 'patients']
  
  for (const table of tables) {
    const schema = await app.platformatic.db.query(`
      PRAGMA table_info(${table})
    `)
    
    const hasDeletedAt = schema.some(c => c.name === 'deleted_at')
    const hasDeletedBy = schema.some(c => c.name === 'deleted_by')
    
    t.ok(hasDeletedAt, `${table} has deleted_at for compliance`)
    t.ok(hasDeletedBy, `${table} has deleted_by for audit trail`)
  }
})
