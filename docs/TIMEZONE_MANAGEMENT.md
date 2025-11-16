# Timezone Management Strategy

**Project**: Healthcare Document Management System  
**Standard**: ISO 8601 with UTC Storage  
**Last Updated**: 2025-11-16

---

## 1. Core Principle: UTC Everywhere

> **All timestamps MUST be stored in UTC in the database.**

### Rationale (HIPAA/GDPR Compliance)

1. **Audit Trail Integrity**: Legal requirement for healthcare records
2. **Multi-timezone Operations**: Hospitals may have distributed systems
3. **Daylight Saving Time**: Avoid ambiguity (2:30 AM can occur twice in autumn)
4. **Interoperability**: API consumers in different timezones

---

## 2. Database Layer

### SQLite Implementation

```sql
-- ALWAYS use DATETIME with explicit UTC
created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- SQLite uses UTC by default
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
deleted_at DATETIME
signed_at DATETIME
```

**Verification:**
```sql
SELECT datetime('now');          -- Returns: 2025-11-16 16:30:45 (UTC)
SELECT datetime('now', 'utc');   -- Explicit UTC
```

### PostgreSQL Implementation (Production)

```sql
-- Use TIMESTAMP WITH TIME ZONE (stores UTC, displays in session timezone)
created_at TIMESTAMPTZ DEFAULT NOW()

-- Or explicitly store as UTC
created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
```

**Migration Note**: When migrating SQLite → PostgreSQL, verify timestamps are interpreted as UTC.

---

## 3. Application Layer

### JavaScript/Node.js

```javascript
// ✅ CORRECT: Create timestamps in UTC
const now = new Date().toISOString()  // "2025-11-16T16:30:45.123Z"

// ✅ CORRECT: Store in DB
await db.query(`
  INSERT INTO reports (signed_at, ...) 
  VALUES (?, ...)
`, [new Date().toISOString()])

// ❌ WRONG: Never store local timezone
const wrong = new Date().toString()  // "Sat Nov 16 2025 17:30:45 GMT+0100"
```

### API Responses (REST)

```json
{
  "id": 1,
  "createdAt": "2025-11-16T16:30:45.000Z",  // ISO 8601 UTC
  "signedAt": "2025-11-16T14:30:00.000Z"
}
```

**Contract**: All API timestamp fields end with `Z` (Zulu time = UTC).

---

## 4. Frontend/Client Layer

### Display Strategy

```javascript
// Client RECEIVES UTC, CONVERTS to user's local timezone for display
const utcTimestamp = "2025-11-16T16:30:45.000Z"

// Option 1: Browser's Intl API
const formatter = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Rome'  // User preference
})
formatter.format(new Date(utcTimestamp))  // "16 nov 2025, 17:30"

// Option 2: Libraries (date-fns-tz, Luxon, Day.js)
import { formatInTimeZone } from 'date-fns-tz'
formatInTimeZone(
  new Date(utcTimestamp), 
  'Europe/Rome', 
  'dd/MM/yyyy HH:mm zzz'
)  // "16/11/2025 17:30 CET"
```

### User Preferences

Store user timezone in `users` table:
```sql
ALTER TABLE users ADD COLUMN timezone VARCHAR(100) DEFAULT 'UTC';

-- Examples:
-- 'Europe/Rome'  (IANA timezone database)
-- 'America/New_York'
-- 'Asia/Tokyo'
```

---

## 5. Healthcare-Specific Considerations

### Report Signing Timestamp

**Regulatory Requirement**: Digital signatures must include exact UTC timestamp.

```sql
-- reports table
signed_at DATETIME  -- UTC when practitioner signed
signature_hash VARCHAR(128)  -- HMAC-SHA256 includes timestamp

-- Verification
SELECT 
  report_number,
  signed_at,
  datetime(signed_at, 'localtime') as signed_at_local  -- For display only
FROM reports;
```

### Appointment Scheduling (Future Feature)

```sql
-- appointments table
appointment_datetime DATETIME  -- UTC
timezone VARCHAR(100)  -- Patient's timezone at booking

-- Display: "2025-11-20 09:00 (Europe/Rome)"
```

---

## 6. Testing Strategy

### Test Cases

```javascript
// test/timezone.test.js
t.test('Timestamps stored as UTC', async (t) => {
  const app = await createTestServer(t)
  
  // Insert with explicit UTC
  await app.platformatic.db.query(`
    INSERT INTO reports (..., signed_at) 
    VALUES (..., '2025-11-16T14:30:00.000Z')
  `)
  
  const [report] = await app.platformatic.db.query(`
    SELECT signed_at FROM reports WHERE id = 1
  `)
  
  t.ok(report.signed_at.endsWith('Z') || report.signed_at.includes('UTC'), 
    'Timestamp stored as UTC')
})
```

### Clock Skew Testing

```javascript
// Mock different server timezones
process.env.TZ = 'America/New_York'
const timestamp1 = new Date().toISOString()

process.env.TZ = 'Asia/Tokyo'
const timestamp2 = new Date().toISOString()

// Both should produce UTC timestamps
t.ok(timestamp1.endsWith('Z') && timestamp2.endsWith('Z'))
```

---

## 7. Migration Checklist

### When Changing Timezone Handling

- [ ] Database schema review (DATETIME → TIMESTAMPTZ)
- [ ] Update all `INSERT` statements to use `.toISOString()`
- [ ] API contract verification (all timestamps end with `Z`)
- [ ] Frontend timezone conversion implementation
- [ ] Test coverage for DST transitions
- [ ] Documentation update (OpenAPI schema)
- [ ] Audit log verification (old vs new format)

---

## 8. Common Pitfalls to Avoid

### ❌ Anti-Patterns

```javascript
// NEVER: Store local timezone in DB
new Date().toLocaleString()  // "16/11/2025, 17:30:45"

// NEVER: Use timestamp without timezone indicator
'2025-11-16 17:30:45'  // Ambiguous!

// NEVER: Convert to local before storage
const local = new Date()
local.setHours(local.getHours() + 1)  // Manual offset → WRONG
```

### ✅ Correct Patterns

```javascript
// ALWAYS: ISO 8601 with Z suffix
new Date().toISOString()  // "2025-11-16T16:30:45.123Z"

// ALWAYS: Parse UTC timestamps
new Date('2025-11-16T16:30:45.000Z')

// ALWAYS: Display with timezone info
`Signed at ${timestamp} (${userTimezone})`
```

---

## 9. OpenAPI Specification

```yaml
components:
  schemas:
    Report:
      properties:
        createdAt:
          type: string
          format: date-time
          example: "2025-11-16T16:30:45.000Z"
          description: "Creation timestamp in UTC (ISO 8601)"
        signedAt:
          type: string
          format: date-time
          nullable: true
          example: "2025-11-16T14:30:00.000Z"
          description: "Digital signature timestamp in UTC"
```

---

## 10. Monitoring & Observability

### Log Format

```javascript
// Structured logging with UTC timestamps
logger.info({
  timestamp: new Date().toISOString(),  // UTC
  event: 'report_signed',
  reportId: 123,
  userId: 5,
  timezone: req.user.timezone  // User's preference for context
})
```

### Alerting

```bash
# Check for timezone inconsistencies
SELECT COUNT(*) FROM reports 
WHERE signed_at NOT LIKE '%Z' AND signed_at IS NOT NULL;

# Should return 0
```

---

## References

- [ISO 8601 Standard](https://www.iso.org/iso-8601-date-and-time-format.html)
- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [HIPAA Timestamp Requirements](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [MDN Date.prototype.toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
