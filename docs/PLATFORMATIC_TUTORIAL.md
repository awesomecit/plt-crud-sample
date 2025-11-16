# Guida Completa Platformatic DB

Platformatic DB è un server HTTP che genera automaticamente API REST e GraphQL dal tuo schema database, supportando PostgreSQL, MySQL, MariaDB e SQLite.

> **Nota**: Questo documento è un tutorial generico su Platformatic DB. Per la documentazione specifica del progetto healthcare, consulta il [README.md](../README.md) principale.

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

```text
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

[... resto del tutorial completo ...]

## Risorse aggiuntive

### Documentazione ufficiale

- **Docs**: <https://docs.platformatic.dev/>
- **Reference DB**: <https://docs.platformatic.dev/docs/reference/db/overview>
- **Examples**: <https://github.com/platformatic/examples>
- **Tutorial completo**: <https://docs.platformatic.dev/docs/guides/movie-quotes-app-tutorial>

### Community

- **Discord**: <https://discord.gg/platformatic>
- **GitHub**: <https://github.com/platformatic/platformatic>
- **Blog**: <https://blog.platformatic.dev>

Questa guida fornisce tutto il necessario per creare un'applicazione Platformatic DB completa con soft delete, sistema di revisioni e audit log. Il progetto è pronto per essere esteso con autenticazione JWT, autorizzazione basata su ruoli, e deployment in produzione con PostgreSQL e Docker.
