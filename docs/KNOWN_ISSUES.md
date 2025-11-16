# Known Issues

## 🔴 CRITICAL: Platformatic 3.x Hook API Compatibility

**Status**: BLOCKED  
**Priority**: HIGH  
**Created**: 2024-11-16

### Problem

Plugins `soft-delete.js` and `versioning.ts` use `entity.addHook()` API which **does not exist in Platformatic 3.x**.

```javascript
// ❌ BROKEN in Platformatic 3.x
const entity = app.platformatic.entities.report
entity.addHook('save', async function(original, args) { ... })
```

**Error**:
```
TypeError: entity.addHook is not a function
    at softDeletePlugin (/plugins/soft-delete.js:47:12)
```

### Root Cause

Platformatic 3.x introduced breaking changes to entity hook system:
- v2.x: `entity.addHook('save', fn)` worked on entity objects
- v3.x: Hook API changed (method removed or moved to different namespace)

### Impact

- ✅ **Tests pass**: Smoke tests validate plugin structure, TypeScript compilation
- ✅ **TypeScript compiles**: No type errors
- ❌ **Runtime fails**: Server crashes on startup when loading plugins
- ❌ **Versioning disabled**: Auto-version snapshots not working
- ❌ **Soft-delete disabled**: Soft-delete hooks not active

### Affected Files

1. `plugins/soft-delete.js` - Lines 47, 61 (`entity.addHook`)
2. `plugins/versioning.ts` - Lines 156, 188 (`reportsEntity.addHook`)

### Investigation Needed

1. **Search Platformatic 3.x docs** for entity hook API
   - Check: https://docs.platformatic.dev/
   - GitHub: https://github.com/platformatic/platformatic/releases (v3.x changelog)
   - Examples: Search for "hooks" in Platformatic v3 repo

2. **Possible alternatives**:
   - Fastify hooks: `app.addHook('onRequest', ...)` on routes
   - Decorators: `app.decorate()` for custom logic
   - Entity interceptors: Check if v3 has different method (e.g., `entity.intercept()`)
   - SQL triggers: Fallback to database-level triggers for versioning/soft-delete

3. **Workarounds**:
   - Option A: Use Fastify route hooks (`preHandler`, `onSend`)
   - Option B: Override REST API routes manually
   - Option C: Downgrade to Platformatic 2.x (breaking change)

### Temporary Status

**Plugins committed but DISABLED at runtime**. Code is ready, just needs API adaptation.

### Next Steps

1. Research Platformatic 3.x hook documentation
2. Find working example of entity lifecycle hooks in v3
3. Refactor `addHook` calls to v3 API
4. Test runtime behavior
5. Update CHANGELOG with fix

### Workaround for Testing

To test other features without plugins, temporarily comment out in `platformatic.json`:

```json
{
  "plugins": {
    "paths": [
      // { "path": "./plugins/soft-delete.js" },
      // { "path": "./plugins/versioning.ts" }
    ]
  }
}
```

---

**References**:
- Platformatic v2 docs (working): https://docs.platformatic.dev/v2
- Platformatic v3 migration guide: TBD
- GitHub issue: TBD (create if not resolved)
