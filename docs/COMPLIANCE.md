# Healthcare Compliance Notes

## GDPR (General Data Protection Regulation)

### Relevant Articles

**Article 17 - Right to erasure ('right to be forgotten')**
- Patients can request deletion of personal data
- **Implementation**: Soft-delete + anonymization after retention period
- **Exceptions**: Legal/medical retention requirements override immediate deletion

**Article 5 - Principles**
- Data minimization, accuracy, storage limitation
- **Implementation**: Automated archival/deletion after retention_years

**Article 32 - Security of processing**
- Encryption, pseudonymization, access controls
- **Implementation**: Audit log, deleted_by tracking, role-based access

### Implementation Checklist

- [ ] Soft-delete infrastructure (TASK-001) ✅
- [ ] Anonymization utilities for expired records
- [ ] Consent management (patient data usage)
- [ ] Data export API (GDPR Article 20 - portability)
- [ ] Audit trail for all access (who/when/what)

---

## HIPAA (Health Insurance Portability and Accountability Act)

### Security Rule Requirements

**164.308 - Administrative Safeguards**
- (a)(1)(ii)(D): Information system activity review
- **Implementation**: Audit log with access tracking

**164.312 - Technical Safeguards**
- (a)(1): Access control (unique user identification)
- (d): Person or entity authentication
- **Implementation**: practitioner_id, deleted_by tracking

### Privacy Rule Requirements

**164.530 - Administrative Requirements**
- (j): Retention of records (6 years minimum)
- **Implementation**: report_types.retention_years, automated archival

**164.524 - Access of Individuals to PHI**
- Patients must access their own records
- **Implementation**: API filtering by patient_id

### Implementation Checklist

- [ ] Audit trail for all PHI access
- [ ] Minimum 6-year retention policy
- [ ] Access controls (practitioner-level permissions)
- [ ] Encryption at rest (PostgreSQL production)
- [ ] Business Associate Agreements (BAA) for vendors

---

## Retention Policy

### Default Rules

| Entity | Retention Years | Legal Basis |
|--------|-----------------|-------------|
| Reports (general) | 10 | HIPAA baseline |
| Reports (minors) | 10 + age_of_majority | State laws vary |
| Audit logs | 6 | HIPAA 164.530(j) |
| Practitioner records | Indefinite | Licensing tracking |

### Automated Archival Strategy

```sql
-- Scheduled job (yearly)
INSERT INTO reports_archive 
SELECT * FROM reports 
WHERE deleted_at IS NOT NULL 
  AND deleted_at < datetime('now', '-10 years');

-- Anonymize archived data
UPDATE reports_archive 
SET patient_id = NULL, 
    ssn_hash = NULL
WHERE ...;
```

---

## Security Recommendations

### Production Deployment

- [ ] PostgreSQL with encryption at rest (pgcrypto)
- [ ] TLS/SSL for API endpoints
- [ ] Hashed SSN storage (never plaintext)
- [ ] Digital signature verification for signed reports
- [ ] Rate limiting on audit log queries
- [ ] Automated backup with encryption
- [ ] Incident response plan

### Access Control Matrix

| Role | Reports (R/W/D) | Patients (R/W/D) | Audit Log |
|------|-----------------|------------------|-----------|
| Practitioner | Own/Own/Soft | Own patients/W/- | Read own |
| Admin | All/All/Soft | All/All/Soft | Full |
| Patient | Own/View/-/- | Own/View/- | - |
| Auditor | All/Read/- | Read/-/- | Full |

---

## Disaster Recovery

### Backup Strategy

- **RPO (Recovery Point Objective)**: 1 hour (hourly DB snapshots)
- **RTO (Recovery Time Objective)**: 4 hours (critical systems)
- **Backup retention**: 90 days (encrypted off-site)

### Testing

- [ ] Quarterly backup restore drill
- [ ] Annual disaster recovery simulation
- [ ] Migration rollback procedures documented

---

## References

- GDPR Official Text: https://gdpr-info.eu/
- HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
