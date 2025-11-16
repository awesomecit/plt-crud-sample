# Healthcare Versioning System & Audit Trail

Sistema di versioning e audit trail per conformità **GDPR**, **HIPAA**, **FDA 21 CFR Part 11**, **ISO 13485**.

## Executive Summary

Il sistema garantisce:

- **Immutabilità**: Record originali mai modificati (append-only)
- **Tracciabilità completa**: Chi, cosa, quando, perché per ogni modifica
- **Non-ripudio**: Firma digitale + timestamp certificato
- **Retention policy**: Conformità legale 7-30 anni (settore healthcare)
- **Audit trail inviolabile**: Protezione contro manomissioni

## Architettura Versioning

### Modello dati

```
reports (master record)
│
├── current_version_id (FK) ──> report_versions.id (punta all'ultima versione)
├── last_modified_by (FK) ────> users.id
│
└── report_versions (audit history)
    ├── id (PK)
    ├── report_id (FK) ──> reports.id
    ├── version_number (incrementale: 1, 2, 3...)
    ├── is_current (BOOLEAN - solo una TRUE per report)
    ├── content (snapshot completo)
    ├── status (DRAFT, PENDING, FINAL, AMENDED, CORRECTED)
    ├── changed_by (FK) ──> users.id
    ├── change_reason (TEXT - obbligatorio per AMENDED/CORRECTED)
    ├── digital_signature (SHA-256 hash)
    ├── created_at (timestamp UTC)
    └── UNIQUE(report_id, version_number)
```

### Workflow lifecycle

```
DRAFT (v1) ──[sign]──> FINAL (v1) ──[amend]──> AMENDED (v2) ──[correct]──> CORRECTED (v3)
                            │                         │                          │
                            └─────────────────────────┴──────────────────────────┘
                                          (tutte immutabili)
```

**Regole immutabilità**:

1. Status `FINAL` → **mai UPDATE**, solo nuova versione con `AMENDED`
2. Emendamento richiede `change_reason` obbligatorio (FDA requirement)
3. Correzioni tecniche (`CORRECTED`) distinte da emendamenti clinici (`AMENDED`)
4. Ogni versione firmata digitalmente (SHA-256 di content + metadata)

## Normative Compliance

### HIPAA 164.308(a)(1)(ii)(D) - Audit Controls

**Requirement**: Track access and modifications to ePHI.

**Implementation**:

```sql
-- Audit log centralizzato
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name VARCHAR(255) NOT NULL,
  record_id INTEGER NOT NULL,
  operation VARCHAR(10) NOT NULL,        -- INSERT, UPDATE, DELETE, ACCESS
  user_id INTEGER NOT NULL,
  user_role VARCHAR(50),                 -- PHYSICIAN, NURSE, ADMIN, AUDITOR
  user_ip VARCHAR(45) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  changed_fields TEXT,                   -- JSON: {"field": {"old": X, "new": Y}}
  old_values TEXT,                       -- JSON snapshot before
  new_values TEXT,                       -- JSON snapshot after
  access_reason TEXT,                    -- Required for ACCESS operations
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64)                   -- SHA-256 hash per integrity
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);
```

**Obblighi HIPAA**:

- ✅ Log retention: **6 anni minimum**
- ✅ Tamper-proof: Checksum SHA-256 ogni entry
- ✅ Who accessed: `user_id`, `user_role`, `user_ip`
- ✅ What accessed: `table_name`, `record_id`, `operation`
- ✅ When accessed: `created_at` (UTC, precisione millisecondi)
- ✅ Why accessed: `access_reason` (obbligatorio per query pazienti)

### FDA 21 CFR Part 11 - Electronic Records

**Requirement**: Electronic signatures legally binding.

**Implementation**:

```sql
-- Digital signatures per versioni
ALTER TABLE report_versions ADD COLUMN digital_signature VARCHAR(64);
ALTER TABLE report_versions ADD COLUMN signature_algorithm VARCHAR(20) DEFAULT 'SHA-256';
ALTER TABLE report_versions ADD COLUMN signed_at DATETIME;
ALTER TABLE report_versions ADD COLUMN signed_by INTEGER REFERENCES users(id);

-- Constraint: FINAL status richiede firma
CREATE TRIGGER enforce_signature_on_final
BEFORE UPDATE OF status ON report_versions
WHEN NEW.status = 'FINAL' AND NEW.digital_signature IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FINAL status requires digital signature');
END;
```

**Calcolo firma digitale**:

```javascript
// Plugin: auto-firma al passaggio FINAL
function generateSignature(version) {
  const payload = {
    report_id: version.report_id,
    version_number: version.version_number,
    content: version.content,
    status: version.status,
    created_at: version.created_at,
    changed_by: version.changed_by
  };
  
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash;
}
```

**Verifica integrità**:

```javascript
// Endpoint audit: verifica manomissioni
app.get('/api/reports/:id/versions/:version/verify', async (req, reply) => {
  const { id, version } = req.params;
  
  const [record] = await db.query(sql`
    SELECT * FROM report_versions
    WHERE report_id = ${id} AND version_number = ${version}
  `);
  
  if (!record) {
    return reply.code(404).send({ error: 'Version not found' });
  }
  
  const expectedSignature = generateSignature(record);
  const isValid = record.digital_signature === expectedSignature;
  
  return {
    version_number: version,
    digital_signature: record.digital_signature,
    expected_signature: expectedSignature,
    is_valid: isValid,
    signed_by: record.signed_by,
    signed_at: record.signed_at,
    algorithm: record.signature_algorithm
  };
});
```

### GDPR Art. 5(1)(f) - Integrity and Confidentiality

**Requirement**: Ensure integrity of personal data.

**Implementation**:

```sql
-- Protezione contro eliminazione accidentale audit log
CREATE TRIGGER prevent_audit_log_deletion
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'Audit log entries cannot be deleted (GDPR Art. 5)');
END;

-- Solo archiviazione permessa (dopo retention period)
CREATE TABLE audit_log_archive (
  -- stessa struttura di audit_log
);

-- Procedura archiviazione (eseguire annualmente)
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < datetime('now', '-7 years');
```

**Diritto all'oblio (Art. 17) con retention**:

```javascript
// Soft-delete paziente MA mantiene audit trail
async function deletePatientGDPR(patientId, requestedBy) {
  // 1. Soft-delete paziente
  await db.query(sql`
    UPDATE patients
    SET deleted_at = CURRENT_TIMESTAMP,
        deleted_by = ${requestedBy},
        anonymized = TRUE,
        ssn_hash = NULL,  -- Cancella identificativi
        first_name = 'REDACTED',
        last_name = 'REDACTED'
    WHERE id = ${patientId}
  `);
  
  // 2. Mantieni audit trail (legal obligation)
  await db.query(sql`
    INSERT INTO audit_log (
      table_name, record_id, operation,
      user_id, access_reason
    ) VALUES (
      'patients', ${patientId}, 'GDPR_DELETE',
      ${requestedBy}, 'Right to erasure request'
    )
  `);
  
  // 3. Reports restano (clinical necessity) ma anonimizzati
  await db.query(sql`
    UPDATE reports
    SET patient_id = NULL,
        anonymized_patient_ref = ${patientId}  -- Reference interna
    WHERE patient_id = ${patientId}
  `);
}
```

### ISO 13485 - Medical Device Quality Management

**Requirement**: Document control and traceability.

**Implementation**:

```sql
-- Metadata versioning aggiuntivo
ALTER TABLE report_versions ADD COLUMN reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE report_versions ADD COLUMN reviewed_at DATETIME;
ALTER TABLE report_versions ADD COLUMN approval_status VARCHAR(20);  -- PENDING, APPROVED, REJECTED
ALTER TABLE report_versions ADD COLUMN regulatory_classification VARCHAR(50);  -- Class I/II/III

-- Workflow approvazioni (per dispositivi medici diagnostici)
CREATE TABLE version_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_version_id INTEGER NOT NULL REFERENCES report_versions(id),
  approver_id INTEGER NOT NULL REFERENCES users(id),
  approval_role VARCHAR(50) NOT NULL,  -- RADIOLOGIST, PATHOLOGIST, SUPERVISOR
  approval_status VARCHAR(20) NOT NULL,
  approval_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  comments TEXT,
  digital_signature VARCHAR(64)
);
```

## Security Best Practices

### 1. Separation of Duties (SoD)

```javascript
// Ruoli e permessi
const ROLES = {
  PHYSICIAN: {
    can: ['create_report', 'amend_report', 'view_own_reports'],
    cannot: ['delete_audit_log', 'modify_signatures']
  },
  NURSE: {
    can: ['create_report_draft', 'view_assigned_reports'],
    cannot: ['finalize_report', 'amend_final_report']
  },
  AUDITOR: {
    can: ['view_audit_log', 'export_audit_trail'],
    cannot: ['modify_reports', 'delete_records']
  },
  ADMIN: {
    can: ['manage_users', 'backup_database'],
    cannot: ['modify_audit_log', 'alter_signatures']
  }
};

// Middleware authorization
async function checkPermission(user, action, resource) {
  const role = ROLES[user.role];
  
  if (role.cannot.includes(action)) {
    throw new ForbiddenError(`Role ${user.role} cannot perform ${action}`);
  }
  
  if (!role.can.includes(action)) {
    // Log unauthorized attempt
    await auditLog({
      operation: 'UNAUTHORIZED_ACCESS',
      user_id: user.id,
      access_reason: `Attempted ${action} without permission`,
      severity: 'HIGH'
    });
    throw new ForbiddenError('Insufficient permissions');
  }
}
```

### 2. Encrypted Audit Trail

```javascript
// Encryption at rest per dati sensibili in audit log
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.AUDIT_ENCRYPTION_KEY; // AES-256
const IV_LENGTH = 16;

function encryptAuditData(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    data: encrypted
  };
}

function decryptAuditData(encryptedObj) {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(encryptedObj.iv, 'hex')
  );
  
  let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// Uso nel plugin audit-trail
async function createAuditLog(entry) {
  const encrypted = encryptAuditData({
    old_values: entry.old_values,
    new_values: entry.new_values,
    changed_fields: entry.changed_fields
  });
  
  await db.query(sql`
    INSERT INTO audit_log (
      table_name, record_id, operation,
      user_id, encrypted_data_iv, encrypted_data
    ) VALUES (
      ${entry.table_name},
      ${entry.record_id},
      ${entry.operation},
      ${entry.user_id},
      ${encrypted.iv},
      ${encrypted.data}
    )
  `);
}
```

### 3. Tamper Detection

```javascript
// Chain of custody: ogni entry linka hash della precedente
CREATE TABLE audit_log_chain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_log_id INTEGER NOT NULL REFERENCES audit_log(id),
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

// Calcolo hash con chaining
function calculateChainHash(currentEntry, previousHash) {
  const payload = {
    id: currentEntry.id,
    table_name: currentEntry.table_name,
    operation: currentEntry.operation,
    created_at: currentEntry.created_at,
    previous_hash: previousHash || '0000000000000000'  // Genesis hash
  };
  
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// Verifica integrità intera catena
async function verifyAuditChain() {
  const entries = await db.query(sql`
    SELECT al.*, alc.previous_hash, alc.current_hash
    FROM audit_log al
    JOIN audit_log_chain alc ON al.id = alc.audit_log_id
    ORDER BY al.created_at ASC
  `);
  
  let previousHash = null;
  const violations = [];
  
  for (const entry of entries) {
    const expectedHash = calculateChainHash(entry, previousHash);
    
    if (entry.current_hash !== expectedHash) {
      violations.push({
        audit_log_id: entry.id,
        expected_hash: expectedHash,
        actual_hash: entry.current_hash,
        tampered: true
      });
    }
    
    previousHash = entry.current_hash;
  }
  
  return {
    total_entries: entries.length,
    violations: violations.length,
    integrity_valid: violations.length === 0,
    violations_details: violations
  };
}
```

### 4. Time-stamping Certificato

```javascript
// RFC 3161 Time-Stamp Protocol per non-ripudio
const axios = require('axios');

async function getCertifiedTimestamp(data) {
  // TSA (Time Stamping Authority) service
  const TSA_URL = process.env.TSA_SERVICE_URL;
  
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  
  const response = await axios.post(TSA_URL, {
    hash: hash,
    algorithm: 'SHA-256',
    policy: '1.2.3.4.5.6.7.8.1'  // TSA policy OID
  });
  
  return {
    timestamp: response.data.timestamp,
    tsa_signature: response.data.signature,
    tsa_certificate: response.data.certificate,
    serial_number: response.data.serial_number
  };
}

// Applicazione su versioni FINAL
app.post('/api/reports/:id/finalize', async (req, reply) => {
  const { id } = req.params;
  const { version_number } = req.body;
  
  // 1. Genera firma digitale
  const signature = generateSignature(version);
  
  // 2. Ottieni timestamp certificato
  const timestamp = await getCertifiedTimestamp(signature);
  
  // 3. Aggiorna versione
  await db.query(sql`
    UPDATE report_versions
    SET status = 'FINAL',
        digital_signature = ${signature},
        signed_at = ${timestamp.timestamp},
        signed_by = ${req.user.id},
        tsa_signature = ${timestamp.tsa_signature},
        tsa_serial = ${timestamp.serial_number}
    WHERE report_id = ${id} AND version_number = ${version_number}
  `);
  
  return { success: true, timestamp };
});
```

## Retention Policies

### Healthcare Legal Requirements

| Tipo Documento | Retention Period | Normativa | Note |
|----------------|------------------|-----------|------|
| Referti diagnostici | 10 anni | DL 196/2003 (IT) | Dalla data referto |
| Cartelle cliniche | 30 anni | Art. 22 Codice Deontologico | Paziente adulto |
| Dati pediatrici | Fino a 18 anni + 10 | GDPR Art. 8 | Minori |
| Imaging medicale | 10 anni | Linee guida SIRM | DICOM files |
| Audit log accessi | 6 anni | HIPAA 164.312 | Tutti gli accessi |
| Consensi informati | Illimitato | Raccomandazioni FNOMCeO | Prova legale |

### Implementazione automatica

```sql
-- Tabella retention policies
CREATE TABLE retention_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name VARCHAR(255) NOT NULL,
  retention_years INTEGER NOT NULL,
  regulatory_basis VARCHAR(255),
  archive_after_years INTEGER,
  auto_delete BOOLEAN DEFAULT FALSE  -- FALSE per healthcare (mai auto-delete)
);

INSERT INTO retention_policies (table_name, retention_years, regulatory_basis, archive_after_years)
VALUES
  ('reports', 10, 'DL 196/2003 Art. 22', 7),
  ('report_versions', 10, 'DL 196/2003 Art. 22', 7),
  ('audit_log', 6, 'HIPAA 164.312', 3),
  ('patients', 30, 'Codice Deontologico Art. 22', 10);

-- Stored procedure archiviazione (manuale, mai automatica)
CREATE PROCEDURE archive_old_records(table_name VARCHAR(255))
BEGIN
  DECLARE retention_years INT;
  DECLARE archive_after INT;
  
  SELECT retention_years, archive_after_years
  INTO retention_years, archive_after
  FROM retention_policies
  WHERE table_name = table_name;
  
  -- Sposta in tabella archivio (non elimina MAI)
  INSERT INTO ${table_name}_archive
  SELECT * FROM ${table_name}
  WHERE created_at < datetime('now', '-' || archive_after || ' years')
    AND archived_at IS NULL;
  
  -- Marca come archiviato
  UPDATE ${table_name}
  SET archived_at = CURRENT_TIMESTAMP
  WHERE created_at < datetime('now', '-' || archive_after || ' years');
END;
```

## Monitoring & Alerting

### Real-time Anomaly Detection

```javascript
// Pattern anomali da monitorare
const ANOMALY_PATTERNS = {
  BULK_ACCESS: {
    threshold: 50,  // >50 record in 5 minuti
    window_minutes: 5,
    severity: 'HIGH',
    action: 'BLOCK_USER'
  },
  AFTER_HOURS_ACCESS: {
    allowed_hours: '08:00-20:00',
    severity: 'MEDIUM',
    action: 'LOG_AND_NOTIFY'
  },
  REPEATED_FAILED_ACCESS: {
    threshold: 5,
    window_minutes: 10,
    severity: 'CRITICAL',
    action: 'LOCK_ACCOUNT'
  },
  UNAUTHORIZED_DELETION_ATTEMPT: {
    severity: 'CRITICAL',
    action: 'IMMEDIATE_ALERT'
  }
};

// Hook audit log per detection
app.platformatic.addEntityHooks('audit_log', {
  save: async (originalSave, opts) => {
    const result = await originalSave(opts);
    
    // Analisi real-time
    const anomalies = await detectAnomalies(result);
    
    if (anomalies.length > 0) {
      await triggerAlerts(anomalies);
    }
    
    return result;
  }
});

async function detectAnomalies(auditEntry) {
  const anomalies = [];
  
  // Check bulk access
  const recentAccess = await db.query(sql`
    SELECT COUNT(*) as count
    FROM audit_log
    WHERE user_id = ${auditEntry.user_id}
      AND operation = 'ACCESS'
      AND created_at > datetime('now', '-5 minutes')
  `);
  
  if (recentAccess[0].count > ANOMALY_PATTERNS.BULK_ACCESS.threshold) {
    anomalies.push({
      type: 'BULK_ACCESS',
      user_id: auditEntry.user_id,
      count: recentAccess[0].count,
      severity: ANOMALY_PATTERNS.BULK_ACCESS.severity
    });
  }
  
  // Check after-hours
  const currentHour = new Date().getHours();
  if (currentHour < 8 || currentHour > 20) {
    anomalies.push({
      type: 'AFTER_HOURS_ACCESS',
      user_id: auditEntry.user_id,
      hour: currentHour,
      severity: ANOMALY_PATTERNS.AFTER_HOURS_ACCESS.severity
    });
  }
  
  return anomalies;
}

async function triggerAlerts(anomalies) {
  for (const anomaly of anomalies) {
    // 1. Log security event
    await db.query(sql`
      INSERT INTO security_events (
        event_type, user_id, severity, details, created_at
      ) VALUES (
        ${anomaly.type},
        ${anomaly.user_id},
        ${anomaly.severity},
        ${JSON.stringify(anomaly)},
        CURRENT_TIMESTAMP
      )
    `);
    
    // 2. Notify security team
    await sendSecurityAlert({
      subject: `Security Anomaly: ${anomaly.type}`,
      severity: anomaly.severity,
      user_id: anomaly.user_id,
      details: anomaly
    });
    
    // 3. Take action if critical
    if (anomaly.severity === 'CRITICAL') {
      await lockUserAccount(anomaly.user_id);
    }
  }
}
```

## API Endpoints Audit

### Query audit trail

```http
GET /api/audit-log?table_name=reports&record_id=123
GET /api/audit-log?user_id=5&from=2024-01-01&to=2024-12-31
GET /api/audit-log?operation=DELETE&severity=HIGH
```

### Export per compliance

```javascript
app.get('/api/audit-log/export', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        from: { type: 'string', format: 'date' },
        to: { type: 'string', format: 'date' },
        format: { type: 'string', enum: ['json', 'csv', 'pdf'] }
      },
      required: ['from', 'to']
    }
  }
}, async (req, reply) => {
  const { from, to, format = 'json' } = req.query;
  
  // Solo AUDITOR role
  if (req.user.role !== 'AUDITOR' && req.user.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Insufficient permissions' });
  }
  
  const logs = await db.query(sql`
    SELECT
      al.*,
      u.username,
      u.email
    FROM audit_log al
    JOIN users u ON al.user_id = u.id
    WHERE al.created_at BETWEEN ${from} AND ${to}
    ORDER BY al.created_at DESC
  `);
  
  // Log export action (compliance requirement)
  await createAuditLog({
    table_name: 'audit_log',
    operation: 'EXPORT',
    user_id: req.user.id,
    access_reason: `Audit export from ${from} to ${to}`,
    record_count: logs.length
  });
  
  if (format === 'csv') {
    const csv = convertToCSV(logs);
    reply.type('text/csv');
    return csv;
  }
  
  if (format === 'pdf') {
    const pdf = await generateAuditReportPDF(logs);
    reply.type('application/pdf');
    return pdf;
  }
  
  return logs;
});
```

## Checklist Implementazione

### Phase 1: Foundation (CURRENT)

- [x] Schema report_versions con version_number
- [x] Constraint UNIQUE(report_id, version_number)
- [x] Campi created_by, changed_by, deleted_by
- [x] Schema audit_log base
- [ ] Triggers auto-increment version_number
- [ ] Plugin versioning con hooks save/delete

### Phase 2: Compliance

- [ ] Digital signatures (SHA-256)
- [ ] Trigger enforce_signature_on_final
- [ ] Certified timestamps (TSA integration)
- [ ] Encryption audit trail (AES-256)
- [ ] Tamper detection (hash chaining)
- [ ] GDPR anonymization procedures

### Phase 3: Security

- [ ] Role-based access control (RBAC)
- [ ] Separation of duties enforcement
- [ ] Anomaly detection real-time
- [ ] Security events table + alerting
- [ ] Audit log export (CSV, PDF)
- [ ] Retention policies automation

### Phase 4: Production Hardening

- [ ] PostgreSQL migration (da SQLite)
- [ ] Database encryption at rest
- [ ] TLS/SSL enforcement
- [ ] Backup automatizzati + test restore
- [ ] Disaster recovery plan
- [ ] Penetration testing
- [ ] SOC 2 Type II audit preparation

## References

### Normative

- **GDPR** (EU 2016/679): <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- **HIPAA** (45 CFR Part 164): <https://www.hhs.gov/hipaa/for-professionals/security/index.html>
- **FDA 21 CFR Part 11**: <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application>
- **ISO 13485:2016**: Medical devices - Quality management systems
- **DL 196/2003** (IT): Codice Privacy italiano

### Standards

- **RFC 3161**: Time-Stamp Protocol (TSP)
- **NIST SP 800-53**: Security and Privacy Controls
- **OWASP Top 10**: Web Application Security Risks
- **HL7 FHIR**: Healthcare interoperability standard

### Best Practices

- **OWASP Audit Logging Cheat Sheet**: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- **CIS Benchmarks**: <https://www.cisecurity.org/cis-benchmarks/>
- **SANS Security Policy Templates**: <https://www.sans.org/information-security-policy/>
