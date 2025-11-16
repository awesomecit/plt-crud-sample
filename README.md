# Healthcare Document Management System

Sistema di gestione referti medici con **compliance GDPR/HIPAA**, soft-delete obbligatorio, versioning automatico, audit trail completo.

## Panoramica

Sistema Platformatic DB per gestione documentale sanitaria con:

- **Reports**: Referti medici (laboratorio, radiologia, diagnosi) con firma digitale
- **Patients**: Anagrafe pazienti anonimizzata (privacy-first design)
- **Practitioners**: Professionisti sanitari certificati
- **Report Types**: Categorizzazione con politiche ritenzione legale
- **Versioning**: Snapshot automatico di ogni modifica (report_versions)
- **Tags**: Classificazione N-M (diabete, urgente, follow-up)
- **Attachments**: File allegati (PDF, DICOM) con checksum

### Features

✅ **Soft-Delete (GDPR/HIPAA)**: Mai eliminazione fisica dei dati clinici  
🔄 **Versioning automatico**: Report immutabili, emendamenti tracciati  
📋 **Audit Trail**: Tutte le modifiche loggano user, timestamp, IP  
🔒 **Security-First**: Crittografia SSN, firma digitale, timezone UTC  
🏷️ **Tagging N-M**: Classificazione flessibile (report → tags)  
📎 **Attachments**: File storage con mime-type, checksum SHA256

## Quick Start

```bash
# Installa dipendenze
npm install

# Applica migrazioni database
npx platformatic db migrations apply

# Genera TypeScript types (opzionale)
npm run types

# Avvia server development
npm run dev

# Popola database con dati di test
node seed.js
```

Server su http://127.0.0.1:3042

- **OpenAPI/Swagger UI**: http://127.0.0.1:3042/documentation
- **API Base URL**: http://127.0.0.1:3042/api

## Utilizzo Swagger/OpenAPI UI

### Accedere alla documentazione interattiva

1. **Avvia server**: `npm run dev`
2. **Apri browser**: http://127.0.0.1:3042/documentation
3. **Espandi entità**: Visualizza tutti gli endpoint generati

### Operazioni CRUD principali

#### **CREATE - Creare nuovo referto**

```http
POST /api/reports
Content-Type: application/json

{
  "report_number": "RPT-2024-001",
  "report_type_id": 1,
  "patient_id": 1,
  "practitioner_id": 1,
  "report_date": "2024-11-16",
  "title": "Esami ematochimici completi",
  "content": "Valori tutti nella norma. Glicemia: 90 mg/dL",
  "status": "FINAL",
  "digital_signature": "SHA256:abc123..."
}
```

**Response 201**:
```json
{
  "id": 1,
  "report_number": "RPT-2024-001",
  "created_at": "2024-11-16T10:30:00.000Z",
  ...
}
```

#### **READ - Leggere referti**

```http
GET /api/reports?limit=20&offset=0
```

**Filtri disponibili**:
```http
# Per paziente
GET /api/reports?where.patient_id.eq=1

# Per tipo referto
GET /api/reports?where.report_type_id.eq=2

# Per status
GET /api/reports?where.status.eq=FINAL

# Per range data
GET /api/reports?where.report_date.gte=2024-01-01&where.report_date.lte=2024-12-31

# Con relazioni incluse
GET /api/reports/1?fields=id,title,patient,practitioner
```

#### **UPDATE - Aggiornare referto**

```http
PUT /api/reports/1
Content-Type: application/json

{
  "status": "AMENDED",
  "content": "Correzione: Glicemia 95 mg/dL (non 90)"
}
```

**⚠️ Versioning automatico**: Ogni PUT crea snapshot in `report_versions`.

#### **DELETE - Soft-delete referto (GDPR-safe)**

```http
DELETE /api/reports/1
```

**Non elimina fisicamente**: imposta `deleted_at` timestamp. Il referto sparisce dalle query normali ma resta in DB.

### Operazioni avanzate (soft-delete plugin)

#### **Visualizzare referti eliminati**

```http
GET /api/reports/deleted
```

#### **Ripristinare referto eliminato**

```http
POST /api/reports/1/restore
```

#### **Eliminazione fisica (⚠️ DANGEROUS - solo admin)**

```http
POST /api/reports/1/hard-delete
```

### Gestione versioni

#### **Visualizzare storico revisioni**

```http
GET /api/reports/1/versions
```

**Response**:
```json
[
  {
    "version_number": 2,
    "is_current": true,
    "content": "Correzione: Glicemia 95 mg/dL",
    "changed_by": 1,
    "created_at": "2024-11-16T15:00:00.000Z"
  },
  {
    "version_number": 1,
    "is_current": false,
    "content": "Valori tutti nella norma. Glicemia: 90 mg/dL",
    "changed_by": 1,
    "created_at": "2024-11-16T10:30:00.000Z"
  }
]
```

### Relazioni N-M: Tags

#### **Creare tag**

```http
POST /api/tags
Content-Type: application/json

{
  "name": "URGENT",
  "color": "#FF0000",
  "description": "Richiede attenzione immediata"
}
```

#### **Associare tag a referto**

```http
POST /api/report_tags
Content-Type: application/json

{
  "report_id": 1,
  "tag_id": 3
}
```

#### **Query referti per tag**

```http
GET /api/report_tags?where.tag_id.eq=3
```

### Attachments

#### **Aggiungere allegato**

```http
POST /api/attachments
Content-Type: application/json

{
  "report_id": 1,
  "filename": "radiografia_torace.dcm",
  "mime_type": "application/dicom",
  "storage_path": "/storage/reports/2024/11/radiografia_torace.dcm",
  "file_size": 2048576,
  "checksum": "sha256:abc123def456..."
}
```

#### **Elencare allegati di un referto**

```http
GET /api/attachments?where.report_id.eq=1
```

## Struttura Database

### Relazioni chiave

```
users (1) ──┬──> (N) reports [created_by]
            └──> (N) reports [last_modified_by]

practitioners (1) ──> (N) reports
patients (1) ──> (N) reports
report_types (1) ──> (N) reports

reports (1) ──> (N) report_versions
reports (1) ──> (1) report_versions [current_version_id]
reports (1) ──> (N) attachments

reports (N) <──> (N) tags [via report_tags junction]
```

### Campi soft-delete e audit

Tutte le entità principali hanno:
- `created_at`: Timestamp creazione (UTC)
- `updated_at`: Timestamp ultima modifica (UTC)
- `deleted_at`: NULL se attivo, timestamp se eliminato
- `created_by`: FK users (chi ha creato)
- `deleted_by`: FK users (chi ha eliminato)

Versioni traccia:
- `changed_by`: FK users (autore modifica)
- `version_number`: Incrementale (1, 2, 3...)
- `is_current`: Boolean (TRUE solo per ultima versione)

## Testing

```bash
# Test suite completa (92 test)
npm test

# Test specifico
npx tap test/migrations/002.test.js --reporter=spec

# Verifica migrazioni
npx platformatic db migrations apply
```

**Test coverage**:
- ✅ Schema validation (55 tests)
- ✅ Soft-delete behavior (14 tests)
- ✅ Migration integrity (23 tests)

## Documentazione aggiuntiva

- **Implementation Roadmap**: [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) - Ordine sequenziale step
- **TypeScript Support**: [docs/TYPESCRIPT_SUPPORT.md](docs/TYPESCRIPT_SUPPORT.md) - Guida TypeScript (opzionale)
- **Versioning & Audit Trail**: [docs/VERSIONING_AND_AUDIT.md](docs/VERSIONING_AND_AUDIT.md) - Compliance GDPR/HIPAA/FDA
- **Timezone Management**: [docs/TIMEZONE_MANAGEMENT.md](docs/TIMEZONE_MANAGEMENT.md)
- **Project Structure**: [docs/project/](docs/project/) (EPIC, STORY, TASK)
- **Platformatic Tutorial**: [docs/PLATFORMATIC_TUTORIAL.md](docs/PLATFORMATIC_TUTORIAL.md)

## Deployment Production

⚠️ **Reference implementation** - Production richiede:
- PostgreSQL con encryption at rest
- TLS/SSL endpoints (HTTPS)
- Autenticazione JWT con RBAC
- Backup automatizzati (point-in-time recovery)
- WAF e rate limiting
- Legal/compliance review (GDPR Art. 32)

## License

MIT
