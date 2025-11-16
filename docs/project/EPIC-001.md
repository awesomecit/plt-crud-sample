# EPIC-001: Soft Delete System (Healthcare Compliance)

**Status**: NOT_STARTED  
**Priority**: CRITICAL  
**Owner**: TBD  
**Target**: v0.1.0

## Goal

Implementare soft-delete **obbligatorio** per entità `report`, `report_type`, `practitioner`, `patient`: DELETE diventa UPDATE (`deleted_at = NOW()`), auto-filtro nei `find()`, API `/restore` e `/deleted` con audit completo.

**Compliance**: GDPR Article 17 (right to erasure con retention), HIPAA 164.308 (data retention requirements).

## Success Criteria

- [ ] Hook `delete` sostituisce DELETE con UPDATE (hard delete bloccato)
- [ ] Hook `find` filtra `deleted_at IS NULL` (salvo `includeDeleted=true`)
- [ ] Endpoint `POST /api/:entity/:id/restore` funzionante con audit log
- [ ] Endpoint `GET /api/:entity/deleted` funzionante (richiede autorizzazione admin)
- [ ] Test e2e con curl/TAP
- [ ] Migration aggiunge `deleted_at`, `deleted_by`
- [ ] **Audit trail**: ogni soft-delete registrato con user_id, timestamp, reason
- [ ] Documentation: compliance checklist aggiornata

## Stories

### STORY-001: Database Schema per Soft Delete
**Tasks**: TASK-001  
**Goal**: Aggiungere colonne `deleted_at`, `deleted_by` alle tabelle.

### STORY-002: Plugin Soft Delete Core
**Tasks**: TASK-002, TASK-003  
**Goal**: Hook `delete` e `find` per intercettare operazioni.

### STORY-003: API Restore & Deleted
**Tasks**: TASK-004, TASK-005  
**Goal**: Endpoint pubblici per gestire record eliminati.

---

## Technical Design

### Migration Schema
```sql
-- 001.do.sql
ALTER TABLE products ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE products ADD COLUMN deleted_by INTEGER;
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
```

### Plugin Hook Pattern
```javascript
app.platformatic.addEntityHooks('product', {
  delete: async (originalDelete, { where, ctx }) => {
    return entities.product.save({
      input: { ...where, deleted_at: new Date().toISOString() }
    })
  }
})
```

### API Contract
- `POST /api/product/:id/restore` → 200 {success, data} | 404
- `GET /api/product/deleted` → 200 [{...}]

## Dependencies
- Migration runner (Platformatic built-in)
- Fastify schema validation
- Test framework (TAP)

## Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Hook order conflicts | MEDIUM | HIGH | Document plugin load sequence |
| Performance su large dataset | HIGH | MEDIUM | Index deleted_at, archivio periodico |
| Race condition restore | LOW | MEDIUM | Optimistic locking (updated_at) |

## Rollback Plan
Migration `001.undo.sql` rimuove colonne, plugin disabilitabile via config.

## Acceptance Tests
```bash
curl -X DELETE /products/1        # → 200, deleted_at set
curl /products/1                  # → 404
curl /api/product/deleted         # → includes ID 1
curl -X POST /api/product/1/restore # → 200, deleted_at=null
curl /products/1                  # → 200
```
