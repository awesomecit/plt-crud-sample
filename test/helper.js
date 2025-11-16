'use strict'

const { join } = require('path')
const { readFileSync } = require('fs')
const Database = require('better-sqlite3')

async function createTestServer(t) {
  const projectRoot = join(__dirname, '..')
  const migrationsDir = join(projectRoot, 'migrations')
  
  // Create in-memory SQLite database
  const db = new Database(':memory:')
  
  t.teardown(() => {
    db.close()
  })
  
  // Apply migrations manually
  const migrations = [
    '20241116000000.do.sql',
    '20241116000001.do.sql',
    '20241116120000.do.sql'
  ]
  
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration)
    const sql = readFileSync(migrationPath, 'utf8')
    db.exec(sql)
  }
  
  // Return app-like object with platformatic.db.query interface
  return {
    platformatic: {
      db: {
        query: (sql) => {
          // Handle SELECT queries (returns data)
          if (sql.trim().toUpperCase().startsWith('SELECT') || 
              sql.trim().toUpperCase().startsWith('PRAGMA')) {
            return db.prepare(sql).all()
          }
          // Handle INSERT/UPDATE/DELETE (no return data)
          db.prepare(sql).run()
          return []
        }
      }
    },
    close: async () => {
      db.close()
    }
  }
}

module.exports = { createTestServer }
