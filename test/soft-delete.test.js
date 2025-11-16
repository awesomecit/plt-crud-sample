'use strict'

const t = require('tap')
const { createTestServer } = require('./helper')

t.test('Soft delete: deleted records have deleted_at timestamp', async (t) => {
  const app = await createTestServer(t)
  
  // Insert test data
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('TEST', 'Test Type')
  `)
  
  // Soft delete (set deleted_at)
  await app.platformatic.db.query(`
    UPDATE report_types 
    SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 1 
    WHERE code = 'TEST'
  `)
  
  const [result] = await app.platformatic.db.query(`
    SELECT deleted_at, deleted_by FROM report_types WHERE code = 'TEST'
  `)
  
  t.ok(result.deleted_at !== null, 'deleted_at is set')
  t.equal(result.deleted_by, 1, 'deleted_by tracks who deleted')
})

t.test('Soft delete: deleted records excluded from normal queries', async (t) => {
  const app = await createTestServer(t)
  
  // Insert 2 records
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('ACTIVE', 'Active Type')
  `)
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('DELETED', 'Deleted Type')
  `)
  
  // Soft delete one
  await app.platformatic.db.query(`
    UPDATE report_types SET deleted_at = CURRENT_TIMESTAMP WHERE code = 'DELETED'
  `)
  
  // Query excluding deleted
  const active = await app.platformatic.db.query(`
    SELECT code FROM report_types WHERE deleted_at IS NULL
  `)
  
  t.equal(active.length, 1, 'only active record returned')
  t.equal(active[0].code, 'ACTIVE', 'correct record returned')
})

t.test('Soft delete: deleted records can be queried explicitly', async (t) => {
  const app = await createTestServer(t)
  
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('REMOVED', 'Removed Type')
  `)
  
  await app.platformatic.db.query(`
    UPDATE report_types SET deleted_at = CURRENT_TIMESTAMP WHERE code = 'REMOVED'
  `)
  
  // Explicit query for deleted
  const deleted = await app.platformatic.db.query(`
    SELECT code FROM report_types WHERE deleted_at IS NOT NULL
  `)
  
  t.ok(deleted.length > 0, 'deleted records found when explicitly queried')
  t.ok(deleted.some(r => r.code === 'REMOVED'), 'deleted record present')
})

t.test('Soft delete: restore sets deleted_at to NULL', async (t) => {
  const app = await createTestServer(t)
  
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('RESTORE_ME', 'To Restore')
  `)
  
  // Soft delete
  await app.platformatic.db.query(`
    UPDATE report_types SET deleted_at = CURRENT_TIMESTAMP WHERE code = 'RESTORE_ME'
  `)
  
  // Restore
  await app.platformatic.db.query(`
    UPDATE report_types SET deleted_at = NULL, deleted_by = NULL WHERE code = 'RESTORE_ME'
  `)
  
  const [restored] = await app.platformatic.db.query(`
    SELECT deleted_at FROM report_types WHERE code = 'RESTORE_ME'
  `)
  
  t.equal(restored.deleted_at, null, 'record restored (deleted_at is NULL)')
})

t.test('Healthcare compliance: cascade soft delete on related entities', async (t) => {
  const app = await createTestServer(t)
  
  // Setup: create report with attachments
  await app.platformatic.db.query(`INSERT INTO users (username, email, password_hash) VALUES ('testuser', 'test@example.com', 'hash')`)
  await app.platformatic.db.query(`INSERT INTO report_types (code, name) VALUES ('LAB', 'Lab')`)
  await app.platformatic.db.query(`INSERT INTO practitioners (license_number, first_name, last_name, email) VALUES ('LIC001', 'A', 'B', 'ab@example.com')`)
  await app.platformatic.db.query(`INSERT INTO patients (patient_code, first_name, last_name, date_of_birth) VALUES ('PAT001', 'C', 'D', '1990-01-01')`)
  await app.platformatic.db.query(`INSERT INTO reports (report_number, report_type_id, patient_id, practitioner_id, report_date, title, content, status) VALUES ('RPT001', 1, 1, 1, '2025-11-16', 'Test Report', 'Content', 'FINAL')`)
  await app.platformatic.db.query(`INSERT INTO attachments (report_id, filename, original_filename, mime_type, file_size, storage_path, uploaded_by) VALUES (1, 'file.pdf', 'File.pdf', 'application/pdf', 1024, '/path/file.pdf', 1)`)
  
  // Soft delete report
  await app.platformatic.db.query(`
    UPDATE reports SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 1 WHERE id = 1
  `)
  
  // Verify attachment still exists (not hard deleted)
  const attachments = await app.platformatic.db.query(`
    SELECT id FROM attachments WHERE report_id = 1
  `)
  
  t.ok(attachments.length > 0, 'attachments preserved after report soft delete')
  
  // Optionally cascade soft delete to attachments
  await app.platformatic.db.query(`
    UPDATE attachments SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 1 WHERE report_id = 1
  `)
  
  const [attachment] = await app.platformatic.db.query(`
    SELECT deleted_at FROM attachments WHERE report_id = 1
  `)
  
  t.ok(attachment.deleted_at !== null, 'attachment cascaded soft delete')
})

t.test('Soft delete: audit trail preserved', async (t) => {
  const app = await createTestServer(t)
  
  // Create user who will do the delete
  await app.platformatic.db.query(`
    INSERT INTO users (username, email, password_hash, role) VALUES ('auditor', 'auditor@example.com', 'hash', 'ADMIN')
  `)
  
  await app.platformatic.db.query(`
    INSERT INTO report_types (code, name) VALUES ('AUDIT_TEST', 'Audit Test')
  `)
  
  // Soft delete with audit info
  await app.platformatic.db.query(`
    UPDATE report_types 
    SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 1 
    WHERE code = 'AUDIT_TEST'
  `)
  
  // Verify audit trail
  const [audit] = await app.platformatic.db.query(`
    SELECT rt.code, rt.deleted_at, rt.deleted_by, u.username as deleted_by_username
    FROM report_types rt
    LEFT JOIN users u ON rt.deleted_by = u.id
    WHERE rt.code = 'AUDIT_TEST'
  `)
  
  t.ok(audit.deleted_at !== null, 'deletion timestamp recorded')
  t.equal(audit.deleted_by, 1, 'deleting user recorded')
  t.equal(audit.deleted_by_username, 'auditor', 'can join to get user details')
})

t.test('GDPR: soft delete allows data recovery within retention period', async (t) => {
  const app = await createTestServer(t)
  
  await app.platformatic.db.query(`
    INSERT INTO patients (patient_code, first_name, last_name, date_of_birth, ssn_hash) 
    VALUES ('GDPR001', 'John', 'Doe', '1980-01-01', 'hash123')
  `)
  
  // Patient requests deletion (GDPR right to be forgotten)
  await app.platformatic.db.query(`
    UPDATE patients SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 1 WHERE patient_code = 'GDPR001'
  `)
  
  // Within retention period, data can be recovered
  const [deleted] = await app.platformatic.db.query(`
    SELECT first_name, last_name, deleted_at FROM patients WHERE patient_code = 'GDPR001'
  `)
  
  t.ok(deleted.deleted_at !== null, 'patient marked as deleted')
  t.equal(deleted.first_name, 'John', 'data still accessible for recovery')
  
  // After retention period, hard delete would be performed by scheduled job
  // (not tested here, requires cron/scheduled task implementation)
})
