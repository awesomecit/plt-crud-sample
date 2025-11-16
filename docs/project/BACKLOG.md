# Product Backlog — Healthcare Document Management System

## Vision

Implementare sistema gestionale documentale per refertazione medica enterprise-ready con Platformatic DB: soft-delete obbligatorio (GDPR/HIPAA), versioning automatico, audit trail completo.

## Priorità

### EPIC-001: Soft Delete System ✅ COMPLETED

**Goal**: Trasformare DELETE in UPDATE (deleted_at) per compliance GDPR/HIPAA, filtrare record eliminati, API restore con audit.  
**Value**: Compliance normativa, recupero dati accidentalmente eliminati, sicurezza legale.  
**Status**: COMPLETED  
**Completed**: 2024-11-16

**Deliverables**:
- ✅ Migration 001: deleted_at, deleted_by su tutte le entità
- ✅ Plugin soft-delete.js con hooks (DELETE → UPDATE)
- ✅ Auto-filtering (WHERE deleted_at IS NULL)
- ✅ API endpoints: /deleted, /restore, /hard-delete
- ✅ Test suite: 14 tests passing
- ✅ Documentazione: README + VERSIONING_AND_AUDIT.md

### EPIC-002: Versioning & Revisions ⚡ IN PROGRESS

**Goal**: Snapshot automatico ogni modifica referto in `report_versions`, API confronto/ripristino versioni, firma digitale.  
**Value**: Tracciabilità clinica, rollback modifiche, validità legale documenti.  
**Status**: IN_PROGRESS (70% complete)  
**Started**: 2024-11-16

**Deliverables**:
- ✅ Migration 002: report_versions table con version_number
- ✅ Schema users, tags, attachments, report_tags junction
- ✅ Test suite: 55 tests migration 002 passing
- ✅ Documentazione completa: VERSIONING_AND_AUDIT.md (GDPR/HIPAA/FDA)
- [ ] **NEXT**: Plugin versioning.js con hooks save/delete
- [ ] API endpoints: /versions, /versions/compare, /versions/restore
- [ ] Digital signature implementation (SHA-256)
- [ ] Certified timestamps (TSA integration)

### EPIC-003: Universal Audit Log 🔵 PLANNED

**Goal**: Tabella centralizzata audit_log con tracking CREATE/UPDATE/DELETE/ACCESS su tutte le entità sanitarie.  
**Value**: Forensics, compliance HIPAA (access tracking), analytics sicurezza.  
**Status**: PLANNED  
**Priority**: HIGH (post versioning plugin)

---

## Assumptions

- DB: SQLite (dev), PostgreSQL (prod) con encryption at rest
- Framework: Platformatic DB 3.x
- Testing: Node.js TAP, fixtures DB in-memory
- Migrazioni: numeriche (001.do/undo.sql), reversible
- Domain: Healthcare (referti medici, pazienti, medici)
- Compliance: GDPR (EU), HIPAA (USA) baseline requirements

## Risks

- **Compliance violation**: audit trail insufficiente → sanzioni GDPR/HIPAA
- Platformatic hooks API instabile (monitorare breaking changes)
- Performance audit_log con volumi elevati (10K+ reports/day)
- Retention policy conflicts (legal vs storage costs)
- Digital signature verification overhead

## Out of Scope (v1.0)

- Autenticazione SAML/OAuth (solo struttura base)
- Encryption campi sensibili (SSN, diagnosi)
- Digital signature PKI infrastructure
- Anonymization utilities (GDPR right to erasure)
- HL7/FHIR interoperability
- UI amministrazione refertazione

## Definition of Done (globale)

- [ ] Test coverage >80%
- [ ] Migration reversibile (undo.sql)
- [ ] Plugin con schema validation
- [ ] Documentazione API (OpenAPI)
- [ ] CHANGELOG.md aggiornato
- [ ] **Compliance review checklist** (GDPR/HIPAA)
- [ ] Audit log testato per tutti gli accessi
- [ ] Retention policy documentata
