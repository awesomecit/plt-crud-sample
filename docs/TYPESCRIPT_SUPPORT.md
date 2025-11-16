# TypeScript Support

This project supports both **JavaScript** and **TypeScript** development.

## Quick Start

### For JavaScript Development

Continue using `.js` files as before. TypeScript configuration is optional.

```bash
# Run tests (JS only)
npm run test:js

# Develop as usual
npm run dev
```

### For TypeScript Development

Platformatic auto-generates types from database schema.

```bash
# Generate TypeScript types from DB
npm run types

# Type-check without compilation
npm run typecheck

# Run TypeScript tests
npm run test:ts

# Run all tests (JS + TS)
npm test
```

## Generated Types

After running `npm run types`, Platformatic generates:

```
types/
├── index.d.ts           # Main exports
├── attachment.d.ts      # Attachment entity
├── patient.d.ts         # Patient entity
├── practitioner.d.ts    # Practitioner entity
├── report.d.ts          # Report entity
├── reportVersion.d.ts   # ReportVersion entity
├── user.d.ts            # User entity
├── tag.d.ts             # Tag entity
├── reportTag.d.ts       # ReportTag junction
└── plt-env.d.ts         # Environment variables
```

## Using Types in Plugins

### JavaScript Plugin (existing)

```javascript
// plugins/soft-delete.js
module.exports = async function (app, opts) {
  const { entities } = app.platformatic;
  
  app.platformatic.addEntityHooks('report', {
    delete: async (originalDelete, opts) => {
      // Implementation
    }
  });
}
```

### TypeScript Plugin (new)

```typescript
// plugins/versioning.ts
import { FastifyPluginAsync } from 'fastify';
import { PlatformaticApp } from '@platformatic/db';
import { Report, ReportVersion } from '../types';

const versioningPlugin: FastifyPluginAsync = async (app) => {
  const platformatic = app as unknown as PlatformaticApp;
  
  platformatic.platformatic.addEntityHooks('report', {
    save: async (originalSave, opts) => {
      const result = await originalSave(opts) as Report;
      
      // Create version snapshot
      const version: Partial<ReportVersion> = {
        report_id: result.id,
        content: result.content,
        status: result.status,
        is_current: true
      };
      
      await platformatic.platformatic.entities.reportVersion.save({
        input: version
      });
      
      return result;
    }
  });
};

export default versioningPlugin;
```

## Type-Safe Test Example

```typescript
// test/versioning.test.ts
import { test } from 'tap';
import { buildDB } from './helper';
import { Report, ReportVersion } from '../types';

test('Auto-increment version_number on report update', async (t) => {
  const db = await buildDB(t);
  
  // Create report
  const report = await db.query(`
    INSERT INTO reports (title, content, status, report_type_id, patient_id, practitioner_id)
    VALUES ('Test', 'Content v1', 'DRAFT', 1, 1, 1)
    RETURNING *
  `) as Report[];
  
  // Verify version created
  const versions = await db.query(`
    SELECT * FROM report_versions WHERE report_id = ${report[0].id}
  `) as ReportVersion[];
  
  t.equal(versions.length, 1, 'Should create version 1');
  t.equal(versions[0].version_number, 1, 'Version number should be 1');
  t.equal(versions[0].is_current, true, 'Should mark as current');
});
```

## Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "allowJs": true,          // Allow .js files
    "checkJs": false,         // Don't type-check .js
    "outDir": "./dist",
    "types": ["node"],
    "typeRoots": ["./node_modules/@types", "./types"]
  },
  "include": ["**/*.ts", "**/*.js", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist", ".nyc_output"]
}
```

### Global Types

Custom type definitions in `global.d.ts`:

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      DATABASE_URL: string;
      // ...
    }
  }
}

export interface AuditLogEntry { /* ... */ }
export interface ReportVersion { /* ... */ }
```

## Migration Strategy

### Phase 1: Coexistence (CURRENT)

- ✅ JavaScript files continue working
- ✅ TypeScript support added (optional)
- ✅ Types auto-generated from schema
- ✅ Both can coexist in same project

### Phase 2: Gradual Migration (OPTIONAL)

Migrate files individually as needed:

1. **Plugins**: `plugins/*.js` → `plugins/*.ts`
2. **Tests**: `test/**/*.test.js` → `test/**/*.test.ts`
3. **Helpers**: `test/helper.js` → `test/helper.ts`

### Phase 3: Full TypeScript (FUTURE)

- All new code in TypeScript
- JavaScript deprecated but still functional
- Update package.json: `"type": "module"`

## Best Practices

### DO

✅ Run `npm run types` after migration changes  
✅ Use `npm run typecheck` before commits  
✅ Keep `allowJs: true` for gradual migration  
✅ Use generated types from `types/` directory  
✅ Add JSDoc to JavaScript for IDE hints

### DON'T

❌ Don't edit `types/**/*.d.ts` manually (auto-generated)  
❌ Don't mix CommonJS (`require`) with ESM (`import`)  
❌ Don't skip `npm run types` after schema changes  
❌ Don't commit `dist/` to git (build artifact)

## IDE Configuration

### VS Code

Add to `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### IntelliJ/WebStorm

TypeScript support enabled by default. Ensure:

- TypeScript version: Use project version (5.x)
- TypeScript Language Service: Enabled
- Compile on save: Disabled (use npm scripts)

## Troubleshooting

### Types not found after migration

```bash
# Regenerate types
npm run types

# Clear TypeScript cache
rm -rf dist/ *.tsbuildinfo
```

### Type errors in JavaScript files

Disable type-checking for JS:

```json
// tsconfig.json
{
  "compilerOptions": {
    "checkJs": false  // Don't check .js files
  }
}
```

### Module resolution errors

Ensure correct module system:

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## References

- **Platformatic Types**: <https://docs.platformatic.dev/docs/reference/db/introduction#typescript-support>
- **TypeScript Handbook**: <https://www.typescriptlang.org/docs/handbook/>
- **TAP TypeScript**: <https://node-tap.org/docs/using-with/typescript/>
