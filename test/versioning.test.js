'use strict'

const { test } = require('tap')

/**
 * Versioning Plugin - Minimal Smoke Test
 * 
 * NOTE: Full integration tests require Platformatic server runtime.
 * This test validates plugin structure and TypeScript compilation only.
 * Manual validation via `npm start` + REST API calls required for:
 * - version_number auto-increment on UPDATE
 * - snapshot content completeness
 * - is_current flag management
 * - soft-delete hook integration
 */

test('Versioning Plugin - Smoke Test', async (t) => {
  // Test 1: Plugin file exists and is valid TypeScript
  await t.test('plugin file exists and compiles', async (t) => {
    const fs = require('fs')
    const path = require('path')
    
    const pluginPath = path.join(__dirname, '../plugins/versioning.ts')
    const exists = fs.existsSync(pluginPath)
    
    t.ok(exists, 'versioning.ts plugin file exists')
    
    if (exists) {
      const content = fs.readFileSync(pluginPath, 'utf8')
      
      // Verify key functions present
      t.match(content, /getNextVersionNumber/, 'has getNextVersionNumber function')
      t.match(content, /clearCurrentFlags/, 'has clearCurrentFlags function')
      t.match(content, /createVersionSnapshot/, 'has createVersionSnapshot function')
      t.match(content, /addHook.*save/, 'has save hook')
      t.match(content, /addHook.*delete/, 'has delete hook')
      
      // Verify TypeScript interfaces
      t.match(content, /interface ReportEntity/, 'has ReportEntity interface')
      t.match(content, /interface ReportVersionEntity/, 'has ReportVersionEntity interface')
    }
  })

  // Test 2: Plugin registered in platformatic.json
  await t.test('plugin registered in platformatic.json', async (t) => {
    const fs = require('fs')
    const path = require('path')
    
    const configPath = path.join(__dirname, '../platformatic.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    
    t.ok(config.plugins, 'platformatic.json has plugins section')
    t.ok(config.plugins.paths, 'platformatic.json has plugins.paths')
    
    const versioningPlugin = config.plugins.paths.find(p => 
      p.path && p.path.includes('versioning')
    )
    
    t.ok(versioningPlugin, 'versioning plugin registered in paths')
    t.equal(versioningPlugin.path, './plugins/versioning.ts', 'versioning plugin path correct')
  })

  // Test 3: Migration 002 has report_versions table
  await t.test('migration 002 creates report_versions table', async (t) => {
    const fs = require('fs')
    const path = require('path')
    
    const migrationPath = path.join(__dirname, '../migrations/20241116120000.do.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    t.match(sql, /CREATE TABLE report_versions/, 'creates report_versions table')
    t.match(sql, /version_number INTEGER/, 'has version_number column')
    t.match(sql, /is_current BOOLEAN/, 'has is_current flag')
    t.match(sql, /changed_by INTEGER/, 'has changed_by user FK')
    t.match(sql, /UNIQUE.*report_id.*version_number/, 'has UNIQUE constraint on report_id + version_number')
  })

  // Test 4: TypeScript compiles without errors
  await t.test('TypeScript compilation passes', async (t) => {
    const { execSync } = require('child_process')
    const path = require('path')
    
    try {
      execSync('npm run typecheck', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      })
      t.pass('TypeScript compilation successful')
    } catch (error) {
      t.fail(`TypeScript compilation failed: ${error.message}`)
    }
  })
})

/**
 * MANUAL VALIDATION CHECKLIST (after `npm start`):
 * 
 * 1. Create Report:
 *    POST /api/reports
 *    Body: { title, content, status, practitionerId, patientId, reportTypeId, reportDate }
 *    → Verify: GET /api/report-versions?where[reportId][eq]=<id> returns version_number=1
 * 
 * 2. Update Report:
 *    PUT /api/reports/<id>
 *    Body: { content: "Updated" }
 *    → Verify: GET /api/report-versions shows version_number=2, is_current=true for v2, false for v1
 * 
 * 3. Multiple Updates:
 *    PUT /api/reports/<id> 3 times
 *    → Verify: version_number increments correctly (1,2,3,4), only latest is_current=true
 * 
 * 4. Snapshot Content:
 *    → Verify: report_versions.content matches reports.content exactly
 * 
 * 5. Soft-Delete Integration:
 *    DELETE /api/reports/<id>
 *    → Verify: version snapshot created with changeReason="Snapshot before soft-delete"
 *    → Verify: reports.deleted_at set (soft-delete plugin works)
 * 
 * 6. Concurrent Updates:
 *    Fire 5 concurrent PUT requests
 *    → Verify: All version_numbers unique, no duplicates (race condition handled)
 */

