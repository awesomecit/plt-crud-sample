# plt-crud-sample
Platformatic minimal crud esample

# Guida completa a Platformatic DB: configurazione, soft delete e revisioni

Platformatic DB è un server HTTP che genera automaticamente API REST e GraphQL dal tuo schema database, supportando PostgreSQL, MySQL, MariaDB e SQLite. Questa guida fornisce un progetto completo con soft delete, sistema di revisioni e relazioni.

## Setup iniziale e creazione del progetto

Platformatic DB permette di inizializzare rapidamente un progetto completo tramite wizard interattivo. Il comando principale crea la struttura del progetto, applica le migrazioni e avvia il server in pochi minuti.

**Comando di inizializzazione:**
```bash
# Creazione progetto con wizard interattivo
npm create platformatic@latest

# Opzioni da selezionare nel wizard:
# - Project type: Application
# - Service kind: @platformatic/db
# - Service name: products-api
# - Connection string: sqlite://./db.sqlite
# - Create migrations: Yes
# - Port: 3042
```

**Avvio del server:**
```bash
cd products-api
npm install
npx platformatic db start
```

Il wizard crea automaticamente la struttura del progetto con file di configurazione, cartella migrations e database SQLite. **La documentazione ufficiale indica che la versione più recente (3.x) utilizza Watt Application Server**, ma il setup standalone rimane supportato per progetti singoli.

### Struttura del progetto generato

```
products-api/
├── migrations/           # File SQL per schema database
│   ├── 001.do.sql       # Migrazione forward
│   └── 001.undo.sql     # Migrazione rollback
├── plugins/             # Plugin Fastify personalizzati
│   └── index.js
├── routes/              # Route API personalizzate
├── platformatic.json    # Configurazione principale
├── .env                 # Variabili d'ambiente
├── db.sqlite           # Database SQLite
└── package.json
```

I file di migrazione seguono la convenzione numerica (001, 002, 003) con estensioni `.do.sql` per applicare modifiche e `.undo.sql` per annullarle. **Platformatic utilizza Postgrator internamente** per gestire le versioni del database.

## Configurazione completa del progetto

### File platformatic.json

Il file di configurazione principale definisce server, database, migrazioni e plugin. Platformatic supporta placeholder con sintassi `{VARIABLE_NAME}` per variabili d'ambiente.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/db/3.20.0.json",
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}",
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "cors": {
      "origin": true
    }
  },
  "db": {
    "connectionString": "{DATABASE_URL}",
    "graphql": true,
    "openapi": {
      "enabled": true,
      "prefix": "/api",
      "info": {
        "title": "Products API",
        "description": "API per gestione prodotti con soft delete e revisioni"
      }
    },
    "autoTimestamp": {
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "poolSize": 10,
    "ignore": {
      "versions": true
    }
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": true,
    "table": "versions",
    "validateChecksums": true
  },
  "plugins": {
    "paths": [{
      "path": "./plugins",
      "encapsulate": false
    }]
  },
  "authorization": {
    "adminSecret": "{PLT_ADMIN_SECRET}",
    "jwt": {
      "secret": "{PLT_JWT_SECRET}"
    }
  }
}
```

### File .env

```env
PORT=3042
PLT_SERVER_HOSTNAME=127.0.0.1
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
PLT_ADMIN_SECRET=changeme-admin-secret
PLT_JWT_SECRET=changeme-jwt-secret
```

L'opzione **autoTimestamp** è fondamentale: aggiunge automaticamente i campi `created_at` e `updated_at` a tutte le tabelle, semplificando il tracking delle modifiche. L'opzione **ignore.versions** esclude la tabella delle migrazioni dalle API generate.

## Schema database con relazioni

Creiamo uno schema completo per un sistema di gestione prodotti con categorie, utenti, soft delete e sistema di revisioni. Ogni migrazione è numerata progressivamente.

### Migration 001: Tabella categorie

```sql
-- migrations/001.do.sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE INDEX idx_categories_deleted_at ON categories(deleted_at);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
```

```sql
-- migrations/001.undo.sql
DROP TABLE IF EXISTS categories;
```

### Migration 002: Tabella utenti

```sql
-- migrations/002.do.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_email ON users(email);
```

```sql
-- migrations/002.undo.sql
DROP TABLE IF EXISTS users;
```

### Migration 003: Tabella prodotti con relazioni

```sql
-- migrations/003.do.sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  stock_quantity INTEGER DEFAULT 0,
  category_id INTEGER,
  created_by INTEGER,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_products_sku ON products(sku);
```

```sql
-- migrations/003.undo.sql
DROP TABLE IF EXISTS products;
```

**Platformatic rileva automaticamente le relazioni tramite foreign key** e le espone nelle API REST e GraphQL. La relazione prodotto→categoria diventa disponibile come endpoint nidificato.

### Migration 004: Tabella revisioni (audit history)

Il sistema di revisioni traccia ogni modifica ai prodotti in una tabella separata con versioning incrementale.

```sql
-- migrations/004.do.sql
CREATE TABLE products_revisions (
  revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10, 2),
  sku VARCHAR(100),
  stock_quantity INTEGER,
  category_id INTEGER,
  changed_by INTEGER,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  change_type VARCHAR(20) NOT NULL,
  change_summary TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_products_revisions_product_id ON products_revisions(product_id);
CREATE INDEX idx_products_revisions_changed_at ON products_revisions(changed_at);
CREATE INDEX idx_products_revisions_version ON products_revisions(product_id, version);
```

```sql
-- migrations/004.undo.sql
DROP TABLE IF EXISTS products_revisions;
```

### Migration 005: Tabella audit log universale

Per tracciare tutte le operazioni su tutte le entità, creiamo una tabella di audit centralizzata.

```sql
-- migrations/005.do.sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name VARCHAR(255) NOT NULL,
  record_id INTEGER NOT NULL,
  operation VARCHAR(10) NOT NULL,
  user_id INTEGER,
  user_ip VARCHAR(45),
  changed_fields TEXT,
  old_values TEXT,
  new_values TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(255)
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

```sql
-- migrations/005.undo.sql
DROP TABLE IF EXISTS audit_log;
```

### Applicazione delle migrazioni

```bash
# Applica tutte le migrazioni
npx platformatic db migrations apply

# Applica fino a una specifica versione
npx platformatic db migrations apply --to 003

# Crea nuova migrazione
npx platformatic db migrations create
```

Con `autoApply: true` nella configurazione, **le migrazioni vengono applicate automaticamente all'avvio del server**, semplificando il deployment.

## API CRUD generate automaticamente

Dopo aver applicato le migrazioni, Platformatic genera automaticamente API complete per ogni tabella con operazioni CRUD, filtering, pagination e gestione delle relazioni.

### Endpoint REST generati

Per la tabella `products`, Platformatic crea automaticamente:

```bash
# CREATE - Crea nuovo prodotto
curl -X POST http://localhost:3042/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop Dell XPS",
    "description": "Laptop professionale",
    "price": 1299.99,
    "sku": "DELL-XPS-001",
    "stock_quantity": 10,
    "category_id": 1,
    "created_by": 1
  }'

# READ - Ottieni tutti i prodotti con paginazione
curl "http://localhost:3042/products?limit=20&offset=0"

# READ - Ottieni prodotto singolo con categoria
curl "http://localhost:3042/products/1?fields=id,name,price,category"

# UPDATE - Aggiorna prodotto
curl -X PUT http://localhost:3042/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 1199.99, "stock_quantity": 8}'

# DELETE - Elimina prodotto (hard delete, verrà sovrascritto)
curl -X DELETE http://localhost:3042/products/1

# FILTERING - Query con condizioni
curl "http://localhost:3042/products?where.price.gt=500&where.price.lt=2000"
curl "http://localhost:3042/products?where.category_id.eq=1"
curl "http://localhost:3042/products?where.name.like=%laptop%"

# RELATIONSHIPS - Ottieni prodotti di una categoria
curl "http://localhost:3042/categories/1/products"
```

### API GraphQL generate

Platformatic genera automaticamente schema GraphQL con query e mutation complete:

```graphql
# Query con relazioni
query GetProducts {
  products(limit: 10, offset: 0) {
    id
    name
    price
    category {
      id
      name
      description
    }
    createdBy {
      username
      email
    }
  }
}

# Query con filtri
query FilteredProducts {
  products(where: { price: { gt: 500 } }) {
    id
    name
    price
  }
}

# Mutation per creare prodotto
mutation CreateProduct {
  saveProduct(input: {
    name: "MacBook Pro"
    price: 2499.99
    category_id: 1
    created_by: 1
  }) {
    id
    name
    price
  }
}

# Mutation per aggiornare
mutation UpdateProduct {
  saveProduct(input: {
    id: 1
    price: 2299.99
  }) {
    id
    price
  }
}
```

**Accesso alle interfacce:**
- OpenAPI/Swagger: http://localhost:3042/documentation
- GraphiQL: http://localhost:3042/graphiql

## Implementazione soft delete con hooks

**Platformatic non ha supporto nativo per soft delete**, ma fornisce un potente sistema di hooks per implementare questo pattern. Gli hooks intercettano le operazioni CRUD prima che vengano eseguite.

### Plugin soft delete completo

Creiamo un plugin che implementa soft delete per le entità specificate, sostituendo l'operazione DELETE con un UPDATE del campo `deleted_at`.

```javascript
// plugins/soft-delete.js
'use strict'

const SOFT_DELETE_ENTITIES = ['product', 'category', 'user']

module.exports = async function (app, opts) {
  const { entities } = app.platformatic

  // Applica hooks a tutte le entità configurate
  for (const entityName of SOFT_DELETE_ENTITIES) {
    app.platformatic.addEntityHooks(entityName, {
      
      // Sostituisce DELETE con soft delete
      delete: async (originalDelete, opts) => {
        const { where, ctx } = opts
        const entity = entities[entityName]
        
        app.log.info({ entityName, where }, 'Soft delete operation')
        
        // Invece di eliminare, aggiorna deleted_at
        const result = await entity.save({
          input: {
            ...where,
            deleted_at: new Date().toISOString(),
            deleted_by: ctx?.user?.id || null
          },
          ctx
        })
        
        return result
      },

      // Filtra automaticamente i record eliminati
      find: async (originalFind, opts) => {
        const includeDeleted = opts.includeDeleted || false
        
        if (!includeDeleted) {
          const modifiedWhere = {
            ...opts.where,
            deleted_at: { eq: null }
          }
          
          app.log.debug({ 
            entityName, 
            originalWhere: opts.where, 
            modifiedWhere 
          }, 'Filtering soft-deleted records')
          
          return await originalFind({
            ...opts,
            where: modifiedWhere
          })
        }
        
        return await originalFind(opts)
      }
    })
  }

  // Endpoint per ripristinare record eliminati
  app.post('/api/:entity/:id/restore', {
    schema: {
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          id: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const { entity, id } = request.params
    const entityObj = entities[entity]
    
    if (!entityObj) {
      return reply.code(404).send({ 
        error: 'Entity not found',
        availableEntities: Object.keys(entities)
      })
    }
    
    app.log.info({ entity, id }, 'Restoring soft-deleted record')
    
    const result = await entityObj.save({
      input: { 
        id, 
        deleted_at: null,
        deleted_by: null
      },
      ctx: request.platformaticContext
    })
    
    return { 
      success: true, 
      data: result,
      message: 'Record restored successfully'
    }
  })

  // Endpoint per ottenere record eliminati
  app.get('/api/:entity/deleted', async (request, reply) => {
    const { entity } = request.params
    const entityObj = entities[entity]
    
    if (!entityObj) {
      return reply.code(404).send({ error: 'Entity not found' })
    }
    
    // Query diretta per record eliminati
    const deleted = await entityObj.find({
      where: {
        deleted_at: { neq: null }
      },
      includeDeleted: true
    })
    
    return deleted
  })
}
```

### Configurazione nel platformatic.json

```json
{
  "plugins": {
    "paths": [{
      "path": "./plugins/soft-delete.js",
      "encapsulate": false
    }]
  }
}
```

**Il parametro `encapsulate: false` è fondamentale**: permette al plugin di accedere agli hooks delle entità dell'applicazione principale. Con questa configurazione, **ogni operazione DELETE diventa automaticamente un soft delete**.

### Test del soft delete

```bash
# Eliminazione soft (imposta deleted_at)
curl -X DELETE http://localhost:3042/products/1

# Il prodotto non appare più nelle query normali
curl http://localhost:3042/products/1
# Risposta: 404 Not Found

# Visualizza record eliminati
curl http://localhost:3042/api/product/deleted

# Ripristina record
curl -X POST http://localhost:3042/api/product/1/restore
```

## Sistema di revisioni e versioning

Il sistema di revisioni traccia ogni modifica ai prodotti creando snapshot nella tabella `products_revisions`. **Ogni save incrementa automaticamente il numero di versione**.

### Plugin versioning completo

```javascript
// plugins/versioning.js
'use strict'

const VERSIONED_ENTITIES = ['product']

module.exports = async function (app, opts) {
  const { sql, db, entities } = app.platformatic

  for (const entityName of VERSIONED_ENTITIES) {
    app.platformatic.addEntityHooks(entityName, {
      
      // Hook su INSERT e UPDATE
      save: async (originalSave, opts) => {
        const { input, ctx } = opts
        const isUpdate = !!input.id
        
        // Salva il record principale
        const result = await originalSave(opts)
        
        app.log.info({ 
          entityName, 
          id: result.id, 
          isUpdate 
        }, 'Creating revision')
        
        // Calcola prossimo numero di versione
        const versionResult = await db.query(sql`
          SELECT COALESCE(MAX(version), 0) + 1 as next_version
          FROM ${sql(entityName + 's_revisions')}
          WHERE product_id = ${result.id}
        `)
        const nextVersion = versionResult[0].next_version
        
        // Crea record di revisione
        await db.query(sql`
          INSERT INTO products_revisions (
            product_id, version, name, description, price,
            sku, stock_quantity, category_id,
            changed_by, change_type, change_summary
          ) VALUES (
            ${result.id},
            ${nextVersion},
            ${result.name},
            ${result.description},
            ${result.price},
            ${result.sku},
            ${result.stock_quantity},
            ${result.category_id},
            ${ctx?.user?.id || null},
            ${isUpdate ? 'UPDATE' : 'INSERT'},
            ${input.change_summary || null}
          )
        `)
        
        return result
      },

      // Hook su DELETE (salva snapshot prima dell'eliminazione)
      delete: async (originalDelete, opts) => {
        const { where, ctx } = opts
        const entity = entities[entityName]
        
        // Recupera record prima di eliminarlo
        const records = await entity.find({ where, includeDeleted: true })
        
        // Esegui delete (o soft delete se attivo)
        const result = await originalDelete(opts)
        
        // Crea revisione per ogni record eliminato
        for (const record of records) {
          const versionResult = await db.query(sql`
            SELECT COALESCE(MAX(version), 0) + 1 as next_version
            FROM products_revisions
            WHERE product_id = ${record.id}
          `)
          const nextVersion = versionResult[0].next_version
          
          await db.query(sql`
            INSERT INTO products_revisions (
              product_id, version, name, description, price,
              sku, stock_quantity, category_id,
              changed_by, change_type, change_summary
            ) VALUES (
              ${record.id},
              ${nextVersion},
              ${record.name},
              ${record.description},
              ${record.price},
              ${record.sku},
              ${record.stock_quantity},
              ${record.category_id},
              ${ctx?.user?.id || null},
              'DELETE',
              'Record deleted'
            )
          `)
        }
        
        return result
      }
    })
  }

  // API endpoint: storico revisioni
  app.get('/api/:entity/:id/revisions', {
    schema: {
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          id: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const { entity, id } = request.params
    
    const revisions = await db.query(sql`
      SELECT 
        revision_id,
        version,
        name,
        description,
        price,
        sku,
        stock_quantity,
        category_id,
        changed_by,
        changed_at,
        change_type,
        change_summary
      FROM ${sql(entity + 's_revisions')}
      WHERE product_id = ${id}
      ORDER BY version DESC
    `)
    
    return revisions
  })

  // API endpoint: confronta versioni
  app.get('/api/:entity/:id/revisions/compare', {
    schema: {
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          id: { type: 'integer' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'integer' },
          to: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const { entity, id } = request.params
    const { from, to } = request.query
    
    const [fromVersion, toVersion] = await db.query(sql`
      SELECT * FROM ${sql(entity + 's_revisions')}
      WHERE product_id = ${id} 
        AND version IN (${from}, ${to})
      ORDER BY version
    `)
    
    if (!fromVersion || !toVersion) {
      return reply.code(404).send({ error: 'Version not found' })
    }
    
    // Calcola differenze
    const changes = {}
    const fields = ['name', 'description', 'price', 'sku', 'stock_quantity', 'category_id']
    
    for (const field of fields) {
      if (fromVersion[field] !== toVersion[field]) {
        changes[field] = {
          from: fromVersion[field],
          to: toVersion[field]
        }
      }
    }
    
    return {
      from: { version: from, data: fromVersion },
      to: { version: to, data: toVersion },
      changes
    }
  })

  // API endpoint: ripristina versione specifica
  app.post('/api/:entity/:id/revisions/:version/restore', {
    schema: {
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          id: { type: 'integer' },
          version: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const { entity, id, version } = request.params
    const entityObj = entities[entity]
    
    // Recupera versione storica
    const [historicalRecord] = await db.query(sql`
      SELECT 
        name, description, price, sku,
        stock_quantity, category_id
      FROM ${sql(entity + 's_revisions')}
      WHERE product_id = ${id} AND version = ${version}
    `)
    
    if (!historicalRecord) {
      return reply.code(404).send({ error: 'Version not found' })
    }
    
    // Ripristina la versione
    const restored = await entityObj.save({
      input: {
        id,
        ...historicalRecord,
        change_summary: `Restored from version ${version}`
      },
      ctx: request.platformaticContext
    })
    
    return {
      success: true,
      restoredVersion: version,
      currentData: restored
    }
  })
}
```

### Test del sistema revisioni

```bash
# Crea prodotto (versione 1)
curl -X POST http://localhost:3042/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 15",
    "price": 999.99,
    "category_id": 2,
    "created_by": 1,
    "change_summary": "Creazione iniziale"
  }'

# Aggiorna prezzo (versione 2)
curl -X PUT http://localhost:3042/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 899.99,
    "change_summary": "Sconto promozionale"
  }'

# Visualizza storico revisioni
curl http://localhost:3042/api/product/1/revisions

# Confronta versioni
curl "http://localhost:3042/api/product/1/revisions/compare?from=1&to=2"

# Ripristina versione precedente
curl -X POST http://localhost:3042/api/product/1/revisions/1/restore
```

## Audit log universale

Per tracciare tutte le operazioni su tutte le entità, implementiamo un sistema di audit centralizzato che registra ogni CREATE, UPDATE e DELETE.

### Plugin audit trail

```javascript
// plugins/audit-trail.js
'use strict'

const AUDITED_ENTITIES = ['user', 'product', 'category']

function getChangedFields(oldData, newData) {
  const changed = {}
  for (const key in newData) {
    if (oldData && oldData[key] !== newData[key]) {
      changed[key] = {
        old: oldData[key],
        new: newData[key]
      }
    }
  }
  return Object.keys(changed).length > 0 ? changed : null
}

module.exports = async function (app, opts) {
  const { sql, db, entities } = app.platformatic

  async function createAuditLog(tableName, operation, recordId, oldValues, newValues, ctx) {
    const changedFields = operation === 'UPDATE' 
      ? getChangedFields(oldValues, newValues)
      : null

    await db.query(sql`
      INSERT INTO audit_log (
        table_name, record_id, operation,
        user_id, user_ip, changed_fields,
        old_values, new_values, session_id
      ) VALUES (
        ${tableName},
        ${recordId},
        ${operation},
        ${ctx?.user?.id || null},
        ${ctx?.request?.ip || null},
        ${changedFields ? JSON.stringify(changedFields) : null},
        ${oldValues ? JSON.stringify(oldValues) : null},
        ${newValues ? JSON.stringify(newValues) : null},
        ${ctx?.sessionId || null}
      )
    `)
    
    app.log.info({ 
      tableName, 
      operation, 
      recordId 
    }, 'Audit log created')
  }

  // Applica hooks a tutte le entità auditate
  for (const entityName of AUDITED_ENTITIES) {
    app.platformatic.addEntityHooks(entityName, {
      
      save: async (originalSave, opts) => {
        const { input, ctx } = opts
        const entity = entities[entityName]
        const isUpdate = !!input.id

        let oldValues = null
        if (isUpdate) {
          // Recupera valori correnti prima dell'update
          const [current] = await entity.find({
            where: { id: { eq: input.id } },
            includeDeleted: true
          })
          oldValues = current
        }

        // Esegui save
        const result = await originalSave(opts)

        // Crea audit log
        await createAuditLog(
          entityName,
          isUpdate ? 'UPDATE' : 'INSERT',
          result.id,
          oldValues,
          result,
          ctx
        )

        return result
      },

      delete: async (originalDelete, opts) => {
        const { where, ctx } = opts
        const entity = entities[entityName]

        // Recupera record prima della cancellazione
        const records = await entity.find({ 
          where,
          includeDeleted: true 
        })

        // Esegui delete
        const result = await originalDelete(opts)

        // Crea audit log per ogni record eliminato
        for (const record of records) {
          await createAuditLog(
            entityName,
            'DELETE',
            record.id,
            record,
            null,
            ctx
          )
        }

        return result
      }
    })
  }

  // API: query audit logs
  app.get('/api/audit-log', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          table_name: { type: 'string' },
          record_id: { type: 'integer' },
          user_id: { type: 'integer' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          limit: { type: 'integer', default: 100 }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      table_name, 
      record_id, 
      user_id, 
      from, 
      to, 
      limit = 100 
    } = request.query
    
    let query = `SELECT * FROM audit_log WHERE 1=1`
    const params = []
    
    if (table_name) {
      query += ` AND table_name = ?`
      params.push(table_name)
    }
    if (record_id) {
      query += ` AND record_id = ?`
      params.push(record_id)
    }
    if (user_id) {
      query += ` AND user_id = ?`
      params.push(user_id)
    }
    if (from) {
      query += ` AND created_at >= ?`
      params.push(from)
    }
    if (to) {
      query += ` AND created_at <= ?`
      params.push(to)
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)
    
    const logs = await db.query(sql([query], ...params))
    return logs
  })

  // API: audit trail di un record specifico
  app.get('/api/:entity/:id/audit', async (request, reply) => {
    const { entity, id } = request.params
    
    const logs = await db.query(sql`
      SELECT 
        id, operation, user_id, user_ip,
        changed_fields, old_values, new_values,
        created_at
      FROM audit_log
      WHERE table_name = ${entity} AND record_id = ${id}
      ORDER BY created_at DESC
    `)
    
    return logs.map(log => ({
      ...log,
      changed_fields: log.changed_fields ? JSON.parse(log.changed_fields) : null,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }))
  })
}
```

### Configurazione plugins multipli

```json
{
  "plugins": {
    "paths": [
      {
        "path": "./plugins/soft-delete.js",
        "encapsulate": false
      },
      {
        "path": "./plugins/versioning.js",
        "encapsulate": false
      },
      {
        "path": "./plugins/audit-trail.js",
        "encapsulate": false
      }
    ]
  }
}
```

**L'ordine dei plugin è importante**: vengono eseguiti nell'ordine di registrazione. In questo caso, audit-trail viene eseguito per ultimo e registra tutte le operazioni, incluse quelle modificate dai plugin precedenti.

## Best practices e ottimizzazioni

### Indicizzazione strategica

Gli indici migliorano drasticamente le performance delle query, specialmente su colonne usate in WHERE, JOIN e ORDER BY.

```sql
-- Indici su foreign keys (essenziali per JOIN)
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_created_by ON products(created_by);

-- Indici su campi di ricerca frequenti
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);

-- Indici composti per query comuni
CREATE INDEX idx_products_category_active 
ON products(category_id, deleted_at);

-- Indici su colonne di audit per query temporali
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_table_record 
ON audit_log(table_name, record_id);
```

### Gestione connection pool

Per applicazioni in produzione con PostgreSQL o MySQL, configurare correttamente il pool di connessioni:

```json
{
  "db": {
    "connectionString": "{DATABASE_URL}",
    "poolSize": 20,
    "idleTimeoutMilliseconds": 30000,
    "queueTimeoutMilliseconds": 60000,
    "acquireLockTimeoutMilliseconds": 60000
  }
}
```

**Il poolSize ottimale dipende dal carico**: per server con 2-4 CPU, 10-20 connessioni sono sufficienti. Aumentare eccessivamente peggiora le performance.

### Archivio dati storici

Per mantenere performance ottimali, archiviare periodicamente i vecchi audit log:

```sql
-- Crea tabella di archivio
CREATE TABLE audit_log_archive AS 
SELECT * FROM audit_log WHERE 1=0;

-- Script di archiviazione (esegui periodicamente)
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < datetime('now', '-1 year');

DELETE FROM audit_log
WHERE created_at < datetime('now', '-1 year');

-- Vacuum per recuperare spazio (SQLite)
VACUUM;
```

Oppure usa partizioni temporali con PostgreSQL:

```sql
-- Partizionamento per mese (PostgreSQL 10+)
CREATE TABLE audit_log (
  id SERIAL,
  created_at TIMESTAMP NOT NULL,
  -- altri campi
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_log_2024_02 PARTITION OF audit_log
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Validazione con JSON Schema

Aggiungere validazione agli endpoint personalizzati migliora robustezza e documentazione:

```javascript
app.post('/api/products/:id/restore', {
  schema: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { 
          type: 'integer',
          minimum: 1 
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' }
        }
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  // handler
})
```

Lo schema viene automaticamente incluso nella documentazione OpenAPI.

### Sicurezza: authorization rules

Configurare regole di autorizzazione per limitare l'accesso agli endpoint:

```json
{
  "authorization": {
    "jwt": {
      "secret": "{PLT_JWT_SECRET}"
    },
    "roleKey": "X-PLATFORMATIC-ROLE",
    "anonymousRole": "anonymous",
    "rules": [
      {
        "role": "user",
        "entity": "product",
        "find": true,
        "save": false,
        "delete": false
      },
      {
        "role": "admin",
        "entity": "product",
        "find": true,
        "save": true,
        "delete": true
      },
      {
        "role": "user",
        "entity": "product",
        "find": {
          "checks": {
            "created_by": "X-PLATFORMATIC-USER-ID"
          }
        }
      },
      {
        "role": "anonymous",
        "entity": "audit_log",
        "find": false,
        "save": false,
        "delete": false
      }
    ]
  }
}
```

**Le regole si applicano automaticamente** alle API generate. La chiave `checks` limita l'accesso solo ai record che soddisfano le condizioni (es. l'utente può vedere solo i suoi prodotti).

### Logging strutturato

Configurare livelli di log appropriati per development e production:

```json
{
  "server": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}",
      "transport": {
        "target": "pino-pretty",
        "options": {
          "translateTime": "HH:MM:ss Z",
          "ignore": "pid,hostname"
        }
      }
    }
  }
}
```

```env
# Development
PLT_SERVER_LOGGER_LEVEL=debug

# Production
PLT_SERVER_LOGGER_LEVEL=warn
```

## Comandi CLI completi

### Gestione progetto

```bash
# Crea nuovo progetto
npm create platformatic@latest

# Naviga nella directory
cd products-api

# Installa dipendenze
npm install

# Avvia in development mode
npm run dev

# Avvia in production
npm start
```

### Migrazioni

```bash
# Crea nuova migrazione
npx platformatic db migrations create

# Applica tutte le migrazioni
npx platformatic db migrations apply

# Applica fino a versione specifica
npx platformatic db migrations apply --to 003

# Rollback all'ultima versione
npx platformatic db migrations apply --to 004
```

### Generazione codice

```bash
# Genera TypeScript types da schema database
npx platformatic db types

# Genera schema OpenAPI (JSON)
npx platformatic db schema openapi > openapi.json

# Genera schema GraphQL
npx platformatic db schema graphql > schema.graphql
```

### Seeding database

Crea file di seed per popolare il database con dati di test:

```javascript
// seed.js
'use strict'

module.exports = async function ({ entities, db, sql }) {
  // Crea categorie
  const electronicsCategory = await entities.category.save({
    input: { 
      name: 'Elettronica',
      description: 'Prodotti elettronici e tecnologici'
    }
  })

  const clothingCategory = await entities.category.save({
    input: {
      name: 'Abbigliamento',
      description: 'Vestiti e accessori'
    }
  })

  // Crea utenti
  const adminUser = await entities.user.save({
    input: {
      username: 'admin',
      email: 'admin@example.com',
      display_name: 'Amministratore'
    }
  })

  // Crea prodotti
  await entities.product.save({
    input: {
      name: 'Laptop Dell XPS 15',
      description: 'Laptop professionale con display 4K',
      price: 1799.99,
      sku: 'DELL-XPS-15',
      stock_quantity: 5,
      category_id: electronicsCategory.id,
      created_by: adminUser.id
    }
  })

  await entities.product.save({
    input: {
      name: 'iPhone 15 Pro',
      description: 'Smartphone Apple ultima generazione',
      price: 1299.99,
      sku: 'IPHONE-15-PRO',
      stock_quantity: 12,
      category_id: electronicsCategory.id,
      created_by: adminUser.id
    }
  })

  // Query SQL diretta per operazioni complesse
  await db.query(sql`
    INSERT INTO products (name, description, price, sku, category_id, created_by)
    VALUES 
      ('MacBook Pro M3', 'Laptop Apple professionale', 2499.99, 'MBP-M3', ${electronicsCategory.id}, ${adminUser.id}),
      ('Samsung Galaxy S24', 'Smartphone Android premium', 999.99, 'SAMSUNG-S24', ${electronicsCategory.id}, ${adminUser.id})
  `)
}
```

**Esecuzione seed:**
```bash
npx platformatic db seed seed.js
```

## Struttura finale del progetto

```
products-api/
├── migrations/
│   ├── 001.do.sql              # Tabella categories
│   ├── 001.undo.sql
│   ├── 002.do.sql              # Tabella users
│   ├── 002.undo.sql
│   ├── 003.do.sql              # Tabella products
│   ├── 003.undo.sql
│   ├── 004.do.sql              # Tabella products_revisions
│   ├── 004.undo.sql
│   ├── 005.do.sql              # Tabella audit_log
│   └── 005.undo.sql
├── plugins/
│   ├── index.js                # Plugin principale
│   ├── soft-delete.js          # Soft delete implementation
│   ├── versioning.js           # Sistema revisioni
│   └── audit-trail.js          # Audit log universale
├── routes/
│   └── custom.js               # Route personalizzate opzionali
├── platformatic.json           # Configurazione principale
├── .env                        # Variabili d'ambiente
├── seed.js                     # Dati di test
├── db.sqlite                   # Database SQLite
├── package.json
└── README.md
```

## Test delle funzionalità

### Scenario completo di test

```bash
# 1. Crea categoria
CATEGORY_ID=$(curl -s -X POST http://localhost:3042/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Elettronica", "description": "Prodotti tech"}' \
  | jq -r '.id')

# 2. Crea utente
USER_ID=$(curl -s -X POST http://localhost:3042/users \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com"}' \
  | jq -r '.id')

# 3. Crea prodotto (versione 1)
PRODUCT_ID=$(curl -s -X POST http://localhost:3042/products \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Product\",
    \"price\": 99.99,
    \"sku\": \"TEST-001\",
    \"stock_quantity\": 10,
    \"category_id\": $CATEGORY_ID,
    \"created_by\": $USER_ID,
    \"change_summary\": \"Creazione iniziale\"
  }" | jq -r '.id')

# 4. Aggiorna prodotto (versione 2)
curl -X PUT http://localhost:3042/products/$PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"price": 89.99, "change_summary": "Prezzo scontato"}'

# 5. Visualizza revisioni
curl http://localhost:3042/api/product/$PRODUCT_ID/revisions | jq

# 6. Visualizza audit log
curl http://localhost:3042/api/product/$PRODUCT_ID/audit | jq

# 7. Soft delete
curl -X DELETE http://localhost:3042/products/$PRODUCT_ID

# 8. Verifica che non appaia più
curl http://localhost:3042/products/$PRODUCT_ID
# Risposta: 404

# 9. Visualizza prodotti eliminati
curl http://localhost:3042/api/product/deleted | jq

# 10. Ripristina prodotto
curl -X POST http://localhost:3042/api/product/$PRODUCT_ID/restore

# 11. Verifica ripristino
curl http://localhost:3042/products/$PRODUCT_ID | jq

# 12. Confronta versioni
curl "http://localhost:3042/api/product/$PRODUCT_ID/revisions/compare?from=1&to=2" | jq

# 13. Ripristina versione precedente
curl -X POST http://localhost:3042/api/product/$PRODUCT_ID/revisions/1/restore
```

## Deployment in produzione

### Configurazione PostgreSQL

Per production, sostituire SQLite con PostgreSQL:

```env
DATABASE_URL=postgres://user:password@localhost:5432/products_db
```

Modificare le migrazioni per PostgreSQL:

```sql
-- migrations/001.do.sql (PostgreSQL)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  deleted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_deleted_at ON categories(deleted_at);
```

### Docker setup

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3042

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: products_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD}@postgres:5432/products_db
      PORT: 3042
      PLT_SERVER_LOGGER_LEVEL: info
    ports:
      - "3042:3042"

volumes:
  postgres_data:
```

### Variabili d'ambiente production

```env
NODE_ENV=production
DATABASE_URL=postgres://user:password@db-host:5432/products_db
PORT=3042
PLT_SERVER_HOSTNAME=0.0.0.0
PLT_SERVER_LOGGER_LEVEL=warn
PLT_ADMIN_SECRET=your-strong-admin-secret-here
PLT_JWT_SECRET=your-strong-jwt-secret-here
```

**Mai committare `.env` in Git**: aggiungi sempre `.env` al `.gitignore`.

## Risorse aggiuntive

### Documentazione ufficiale
- **Docs**: https://docs.platformatic.dev/
- **Reference DB**: https://docs.platformatic.dev/docs/reference/db/overview
- **Examples**: https://github.com/platformatic/examples
- **Tutorial completo**: https://docs.platformatic.dev/docs/guides/movie-quotes-app-tutorial

### Community
- **Discord**: https://discord.gg/platformatic
- **GitHub**: https://github.com/platformatic/platformatic
- **Blog**: https://blog.platformatic.dev

Questa guida fornisce tutto il necessario per creare un'applicazione Platformatic DB completa con soft delete, sistema di revisioni e audit log. Il progetto è pronto per essere esteso con autenticazione JWT, autorizzazione basata su ruoli, e deployment in produzione con PostgreSQL e Docker.
