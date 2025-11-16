# Implementation Roadmap - Healthcare Document Management

Ordine sequenziale di implementazione con dipendenze esplicite.

## Status Overview

| Phase | Epic | Status | Completion | Priority |
|-------|------|--------|------------|----------|
| ✅ Phase 1 | EPIC-001 Soft Delete | COMPLETED | 100% | CRITICAL |
| ⚡ Phase 2 | EPIC-002 Versioning | IN PROGRESS | 45% | HIGH |
| 🔵 Phase 3 | EPIC-003 Audit Log | PLANNED | 0% | HIGH |
| 🟢 Phase 4 | Production Hardening | PLANNED | 0% | MEDIUM |

---

## Phase 1: Soft Delete System ✅ COMPLETED

**Duration**: 2024-11-16  
**Deliverables**: 9/9 completed

### 1.1 Database Schema

- [x] Migration `20241116000001.do.sql`: deleted_at, deleted_by columns
- [x] Migration `20241116000001.undo.sql`: rollback script
- [x] Indexes on deleted_at for performance

### 1.2 Plugin Implementation

- [x] `plugins/soft-delete.js`: 180 lines
- [x] Hook `delete`: intercept DELETE → UPDATE deleted_at
- [x] Hook `find`: auto-filter WHERE deleted_at IS NULL
- [x] getCurrentUserId() helper for audit trail

### 1.3 API Endpoints

- [x] GET `/api/:entity/deleted` - list soft-deleted records
- [x] POST `/api/:entity/:id/restore` - restore deleted record
- [x] POST `/api/:entity/:id/hard-delete` - permanent delete (admin only)

### 1.4 Testing

- [x] `test/soft-delete.test.js`: 14 test cases
- [x] Test deleted_at timestamp setting
- [x] Test auto-filtering behavior
- [x] Test restore functionality
- [x] Test cascade soft-delete

### 1.5 Documentation

- [x] README.md: Swagger/OpenAPI usage guide
- [x] VERSIONING_AND_AUDIT.md: GDPR/HIPAA compliance

---

## Phase 2: Versioning & Revisions ⚡ IN PROGRESS (45%)

**Started**: 2024-11-16  
**Target Completion**: TBD  
**Blockers**: TypeScript migration (STEP 1)

### 2.1 Database Schema ✅ DONE

- [x] Migration `20241116120000.do.sql`: report_versions, users, tags, attachments
- [x] Migration `20241116120000.undo.sql`: rollback script
- [x] UNIQUE constraint (report_id, version_number)
- [x] FK reports.current_version_id → report_versions.id
- [x] Indexes for performance

### 2.2 TypeScript Support 🔄 STEP 1 (CURRENT)

**Dependencies**: None  
**Duration**: ~2 hours

- [ ] Install dependencies: `typescript`, `@types/node`, `tsx`
- [ ] Create `tsconfig.json` with Platformatic-compatible settings
- [ ] Generate types: `npx platformatic db types`
- [ ] Migrate `test/helper.js` → `test/helper.ts`
- [ ] Update test scripts in package.json
- [ ] Verify all tests pass with TypeScript

**Files to create**:

```
tsconfig.json
types/platformatic.d.ts (auto-generated)
global.d.ts (manual types)
```

**Configuration**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", ".nyc_output"]
}
```

### 2.3 Plugin Versioning 🔄 STEP 2

**Dependencies**: STEP 1 (TypeScript)  
**Duration**: ~4 hours

- [ ] Create `plugins/versioning.ts` (or .js if skip TS)
- [ ] Hook `save` on entity `report`:
  - Calculate next version_number (MAX + 1)
  - Create snapshot in report_versions
  - Update reports.current_version_id
  - Set is_current flags (FALSE old, TRUE new)
- [ ] Hook `delete`: save snapshot before soft-delete
- [ ] Register plugin in platformatic.json
- [ ] Add schema validation for plugin options

**Pseudo-code**:

```typescript
// plugins/versioning.ts
import { FastifyInstance } from 'fastify';

export default async function versioningPlugin(app: FastifyInstance) {
  app.platformatic.addEntityHooks('report', {
    save: async (originalSave, opts) => {
      const isUpdate = !!opts.input.id;
      
      // 1. Save main record
      const result = await originalSave(opts);
      
      // 2. Calculate next version
      const [{ next_version }] = await app.platformatic.db.query(sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM report_versions WHERE report_id = ${result.id}
      `);
      
      // 3. Create version snapshot
      await app.platformatic.entities.reportVersion.save({
        input: {
          report_id: result.id,
          version_number: next_version,
          content: result.content,
          status: result.status,
          is_current: true,
          changed_by: opts.ctx?.user?.id
        }
      });
      
      // 4. Update current_version_id
      await app.platformatic.entities.report.save({
        input: {
          id: result.id,
          current_version_id: versionId
        }
      });
      
      return result;
    }
  });
}
```

### 2.4 API Endpoints 🔄 STEP 3

**Dependencies**: STEP 2 (Plugin versioning)  
**Duration**: ~2 hours

- [ ] GET `/api/reports/:id/versions` - list all versions
- [ ] GET `/api/reports/:id/versions/compare?from=1&to=2` - diff versions
- [ ] POST `/api/reports/:id/versions/:version/restore` - rollback to version

**OpenAPI schema validation** for each endpoint.

### 2.5 Testing Versioning 🔄 STEP 4

**Dependencies**: STEP 2, STEP 3  
**Duration**: ~3 hours

- [ ] Create `test/versioning.test.ts`
- [ ] Test auto-increment version_number
- [ ] Test is_current flag management
- [ ] Test snapshot content completeness
- [ ] Test API /versions returns history
- [ ] Test API /compare calculates diff correctly
- [ ] Test API /restore rollback works
- [ ] Test integration with soft-delete plugin

**Target**: ~30 test cases

### 2.6 Digital Signatures 🔄 STEP 5

**Dependencies**: STEP 2 (Plugin versioning)  
**Duration**: ~2 hours

- [ ] Add signature calculation function (SHA-256)
- [ ] Trigger on status = 'FINAL'
- [ ] Store signature + algorithm + timestamp
- [ ] API endpoint `/verify` for signature validation

### 2.7 Documentation Update 🔄 STEP 6

**Dependencies**: All STEP 2-5 completed  
**Duration**: ~1 hour

- [ ] Update README.md with versioning examples
- [ ] Update VERSIONING_AND_AUDIT.md with implementation details
- [ ] Generate TypeScript API docs (if using TS)
- [ ] Update CHANGELOG.md

---

## Phase 3: Universal Audit Log 🔵 PLANNED

**Dependencies**: Phase 2 completed  
**Target Start**: After EPIC-002 100% complete

### 3.1 Database Schema

- [ ] Migration `20241116140000.do.sql`: audit_log table
- [ ] Fields: table_name, record_id, operation, user_id, user_ip, changed_fields, old_values, new_values, checksum
- [ ] Indexes: (table_name, record_id), user_id, created_at

### 3.2 Plugin Audit Trail

- [ ] Create `plugins/audit-trail.ts`
- [ ] Hook all entities: users, reports, patients, practitioners, report_types
- [ ] Track operations: INSERT, UPDATE, DELETE, ACCESS
- [ ] Calculate changed_fields diff
- [ ] Store old_values + new_values JSON

### 3.3 Encryption & Security

- [ ] Encrypt sensitive audit data (AES-256)
- [ ] Hash chaining for tamper detection
- [ ] Prevent audit_log deletion (trigger)

### 3.4 API Endpoints

- [ ] GET `/api/audit-log?table_name=reports&record_id=123`
- [ ] GET `/api/audit-log/export?from=2024-01-01&to=2024-12-31&format=csv`
- [ ] GET `/api/reports/:id/audit` - audit trail for specific record

### 3.5 Testing

- [ ] Create `test/audit-trail.test.ts`
- [ ] Test INSERT tracking
- [ ] Test UPDATE diff calculation
- [ ] Test DELETE preservation
- [ ] Test encryption/decryption
- [ ] Test tamper detection

### 3.6 Monitoring

- [ ] Anomaly detection (bulk access, after-hours)
- [ ] Real-time alerting
- [ ] Security events table

---

## Phase 4: Production Hardening 🟢 PLANNED

**Dependencies**: Phase 1-3 completed  
**Target**: Pre-production deployment

### 4.1 Database Migration

- [ ] PostgreSQL migration (from SQLite)
- [ ] Update migrations for PostgreSQL syntax
- [ ] Connection pooling optimization
- [ ] Encryption at rest configuration

### 4.2 Security

- [ ] JWT authentication implementation
- [ ] Role-based access control (RBAC)
- [ ] Rate limiting
- [ ] CORS hardening
- [ ] Security headers

### 4.3 Infrastructure

- [ ] Docker containerization
- [ ] docker-compose.yml (app + postgres)
- [ ] Environment variables validation
- [ ] Health checks
- [ ] Graceful shutdown

### 4.4 Monitoring & Logging

- [ ] Structured logging (pino)
- [ ] Metrics collection (Prometheus)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (APM)

### 4.5 Backup & Recovery

- [ ] Automated backups (pg_dump)
- [ ] Point-in-time recovery setup
- [ ] Disaster recovery documentation
- [ ] Backup restore testing

### 4.6 Compliance

- [ ] GDPR compliance checklist
- [ ] HIPAA compliance checklist
- [ ] Penetration testing
- [ ] Security audit
- [ ] Legal review

---

## Critical Path Analysis

### Minimum Viable Product (MVP)

**Required for v1.0**:

1. ✅ EPIC-001: Soft Delete (DONE)
2. ⚡ EPIC-002: Versioning (STEPS 1-4 mandatory)
3. 🔵 EPIC-003: Audit Log (STEPS 3.1-3.4 mandatory)

**Optional for v1.0** (can defer to v1.1):

- Digital signatures (EPIC-002 STEP 5)
- Certified timestamps
- Anomaly detection
- Advanced monitoring

### Sequential Dependencies

```
EPIC-001 (DONE)
    ↓
EPIC-002 STEP 1 (TypeScript) ← CURRENT BLOCKER
    ↓
EPIC-002 STEP 2 (Plugin versioning)
    ↓
EPIC-002 STEP 3 (API endpoints)
    ↓
EPIC-002 STEP 4 (Testing)
    ↓
EPIC-002 STEP 5 (Signatures - optional)
    ↓
EPIC-003 (Audit Log)
    ↓
Phase 4 (Production)
```

### Estimated Timeline

| Phase | Duration | Effort (hours) |
|-------|----------|----------------|
| EPIC-002 STEP 1 (TS) | 1 day | 2h |
| EPIC-002 STEP 2-4 | 2-3 days | 9h |
| EPIC-002 STEP 5-6 | 1 day | 3h |
| EPIC-003 | 3-4 days | 12h |
| Phase 4 | 1-2 weeks | 40h |
| **TOTAL MVP** | **2-3 weeks** | **66h** |

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript migration breaks tests | HIGH | Incremental migration, keep .js fallback |
| Platformatic hooks API changes | MEDIUM | Pin version 3.20.0, monitor changelog |
| Performance degradation (versioning) | MEDIUM | Indexes on version_number, pagination |
| Audit log storage explosion | HIGH | Retention policies, archiving strategy |

### Compliance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing audit trail | CRITICAL | Comprehensive testing, monitoring |
| Data breach | CRITICAL | Encryption, access controls, penetration testing |
| GDPR violation | HIGH | Legal review, compliance checklist |

---

## Next Actions

### Immediate (Today)

1. **TypeScript Setup** (STEP 2.2)
   - Install dependencies
   - Configure tsconfig.json
   - Generate Platformatic types
   - Verify tests pass

2. **Documentation Update**
   - Update BACKLOG.md with accurate %
   - Create this IMPLEMENTATION_ROADMAP.md
   - Update README.md with TypeScript info

### Short-term (This Week)

3. **Plugin Versioning** (STEP 2.3)
4. **API Endpoints** (STEP 2.4)
5. **Testing** (STEP 2.5)

### Medium-term (Next Week)

6. **Digital Signatures** (STEP 2.6)
7. **EPIC-003 Start** (Audit Log migration)

---

## Success Criteria

### EPIC-002 Complete When:

- [ ] All 6 steps implemented and tested
- [ ] 100% test coverage for versioning logic
- [ ] API endpoints documented in Swagger
- [ ] No breaking changes to existing soft-delete
- [ ] Performance benchmarks met (<100ms version creation)

### Project v1.0 Complete When:

- [ ] All EPICs 1-3 at 100%
- [ ] Test coverage >80%
- [ ] All compliance checklists verified
- [ ] Production deployment successful
- [ ] No critical security vulnerabilities

---

## References

- **BACKLOG.md**: Product vision and EPIC definitions
- **VERSIONING_AND_AUDIT.md**: Compliance requirements
- **TIMEZONE_MANAGEMENT.md**: Data handling standards
- **Platformatic Docs**: <https://docs.platformatic.dev/>
