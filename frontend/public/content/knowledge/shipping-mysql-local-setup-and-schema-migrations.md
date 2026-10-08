---
title: "Local MySQL Setup and Safe Schema Changes with Sequelize (and the 64-Index Limit)"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "shipping-mysql-local-setup-and-schema-migrations"
summary: "How to stand up a local MySQL database for a Node backend, the difference between sync() and real migrations, why sequelize.sync({ alter: true }) can fail on MySQL's 64-index limit, and the idempotent startup-patch pattern I used to add columns safely."
---

# Local MySQL Setup and Safe Schema Changes with Sequelize

## What and why

On a client project (a restaurant reservation marketplace with a Node/TypeScript + Sequelize backend), I needed a local MySQL database I could freely break, and later I needed to add columns to tables in a database that had been evolved by `sync({ alter: true })` for a long time. The second part produced one of the more instructive bugs I've hit: a column I added to one table never appeared because a *different* table had hit MySQL's 64-index limit.

## Part 1: A local MySQL database

### Install

```bash
# Ubuntu / Debian / WSL
sudo apt update && sudo apt install mysql-server
sudo systemctl enable --now mysql     # or: sudo service mysql start (WSL without systemd)

# macOS
brew install mysql && brew services start mysql
```

Optionally run `sudo mysql_secure_installation` to remove anonymous users and the test DB. Or skip installing entirely and run `mysql:8` / `mariadb` in Docker with a volume.

### Create a database and a dedicated user

Don't run your app as `root`. Create a scoped user:

```sql
CREATE DATABASE IF NOT EXISTS app_dev
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'choose-a-local-password';
GRANT ALL PRIVILEGES ON app_dev.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

Use `utf8mb4` (real UTF-8, including emoji) rather than MySQL's legacy `utf8`.

### Load a schema

Two common routes:

- **Schema-only dump**: generate one from a full dump (`mysqldump --no-data`) and load it with `mysql -u app_user -p < schema.sql`. I wrote a small script that stripped data out of a large dump to produce an "empty" schema file the whole team could use.
- **Let the ORM create tables** on startup with `sequelize.sync()`, then run the app's seeder for reference data (roles, lookup tables).

To pull a dump from a database that isn't publicly reachable, tunnel through a host inside the network:

```bash
ssh -i key.pem -L 3307:<private-db-host>:3306 user@<bastion-host>
mysqldump -h 127.0.0.1 -P 3307 -u <user> -p --single-transaction --routines --triggers <db> > dump.sql
```

`--single-transaction` gives a consistent snapshot of InnoDB tables without locking them.

### Point the backend at it

```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=app_dev
DATABASE_USERNAME=app_user
DATABASE_PASSWORD=choose-a-local-password
```

Then **restart the server**. Env vars are read once at process start.

### Common local errors

| Error | Fix |
|---|---|
| `Access denied for user` | Password in `.env` doesn't match; re-run `CREATE USER` / `GRANT` |
| `Unknown database` | Database not created or schema not loaded |
| `Can't connect to MySQL server` | Service not running (`systemctl status mysql`) |
| SSL / certificate error on localhost | The DB config forces SSL with a cloud CA cert; local MySQL usually has none. Make SSL conditional on the environment |
| Migrations hit the wrong server | The Sequelize CLI uses `config/config.json`, **not** your `.env`. Add a `local` block and run with `--env local` |

## Part 2: `sync()` vs migrations

Sequelize offers two ways to shape the schema, and mixing them up causes confusion:

| | `sequelize.sync()` | Sequelize CLI migrations |
|---|---|---|
| Source of truth | Model definitions in code | Versioned files in `migrations/` |
| Runs | On app startup | Manually / in CI (`npx sequelize-cli db:migrate`) |
| `sync()` (default) | `CREATE TABLE IF NOT EXISTS` only; never alters existing tables | |
| `sync({ alter: true })` | Diffs models vs the live DB and emits `ALTER TABLE` | |
| History / rollback | None | `db:migrate:undo` |

Important: **starting the server does not run migration files.** If you add a migration, you also update the model, and someone has to run the CLI.

`sync({ alter: true })` is convenient in development but has sharp edges in MySQL.

## Part 3: The ER_TOO_MANY_KEYS bug

### What happened

I added a nullable string column to a small table that records orders pushed to POS systems. Model edit, restart, `sync({ alter: true })` should handle it. Instead the logs showed:

```
SequelizeDatabaseError: Too many keys specified; max 64 keys allowed
SQL: ALTER TABLE restaurants CHANGE slug slug VARCHAR(255) UNIQUE;
```

Then later, at runtime:

```
Unknown column 'newColumn' in 'field list'
```

### Why

- **MySQL caps indexes at 64 per table** (InnoDB). Error code 1069, `ER_TOO_MANY_KEYS`.
- When `alter: true` re-declares a column marked `unique: true`, it can emit `CHANGE ... UNIQUE`, which **creates another unique index each time** instead of recognizing the existing one. Over months of restarts, a heavily used table had accumulated duplicate indexes (`slug`, `slug_2`, `slug_3`...) until it hit the ceiling.
- The failure on that one table **aborted the whole sync pass**, so my unrelated table never got its new column.
- There was already a try/catch that retried with `sync({ alter: false })`, so the app booted. But `alter: false` only creates missing tables. It never adds columns to existing ones. The model referenced a column the database didn't have, and inserts failed.

You can see the problem directly:

```sql
SELECT COUNT(*) FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurants';

SHOW INDEX FROM restaurants;   -- look for slug_2, slug_3, ... duplicates
```

The long-term remediation is dropping the duplicate indexes and fixing the model so it doesn't regenerate them, but that touches a production table and needs care. I needed a safe way to ship columns now.

### The fix: idempotent startup patches

Each new column gets a tiny function that runs a raw `ALTER TABLE` on every boot and treats "already done" as success:

```typescript
import type { Sequelize } from "sequelize";

const ER_DUP_FIELDNAME = 1060;   // column already exists
const ER_NO_SUCH_TABLE = 1146;   // table not created yet

export async function ensureColumn(
  sequelize: Sequelize, table: string, column: string, definition: string
): Promise<void> {
  try {
    await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[DB] Applied patch: ${table}.${column}`);
  } catch (err: any) {
    const errno = err?.parent?.errno ?? err?.original?.errno;
    if (errno === ER_DUP_FIELDNAME) return;      // already applied: no-op
    if (errno === ER_NO_SUCH_TABLE) {            // will exist after next sync
      console.warn(`[DB] ${table} missing; patch deferred`);
      return;
    }
    throw err;                                   // anything else is a real problem
  }
}
```

Startup order matters. Patches run **after** sync so the tables exist:

```typescript
try {
  await sequelize.sync({ alter: true });
} catch (err) {
  if (isTooManyKeys(err)) {
    console.warn("[DB] alter sync hit ER_TOO_MANY_KEYS; falling back to create-only");
    await sequelize.sync({ alter: false });
  } else throw err;
}

// Explicitly create tables that cyclic foreign keys can cause sync to skip
await PosConnection.sync();
await PosOrder.sync();

// Idempotent column patches: print once on first boot, silent afterward
await ensureColumn(sequelize, "pos_orders", "posCustomerId", "VARCHAR(255) NULL");
await ensureColumn(sequelize, "pos_connections", "locationTimezone", "VARCHAR(64) NULL");

await seed();
```

The same idea works for drops (catch error 1091, `ER_CANT_DROP_FIELD_OR_KEY`). I used it to remove a large JSON blob column after moving that data to object storage.

### Why this instead of "proper" migrations

- The project didn't yet have migration tooling wired into deploys. Building it for one column was disproportionate.
- The patch is **idempotent and fast**. After the first boot it's a no-op.
- It runs on **every environment automatically** (local dumps, staging, prod) with no out-of-band SQL step.

It's a bridge, not a destination. My rule: the third time you write one of these, build the migration pipeline.

| Change | Approach |
|---|---|
| New column on a table with index headroom (local dev) | Model edit + `sync({ alter: true })` |
| New column on a table at/near the index limit | Model edit **and** an idempotent `ensureColumn` patch |
| New index, data backfill, or rename | A real versioned migration. Silent failure risk is too high otherwise |

### Handy MySQL error codes

| errno | Name | Meaning |
|---|---|---|
| 1060 | `ER_DUP_FIELDNAME` | Column already exists |
| 1061 | `ER_DUP_KEYNAME` | Index name already exists |
| 1069 | `ER_TOO_MANY_KEYS` | Table hit the 64-index limit |
| 1091 | `ER_CANT_DROP_FIELD_OR_KEY` | Column/index to drop doesn't exist |
| 1146 | `ER_NO_SUCH_TABLE` | Table doesn't exist |
| 1215 | `ER_CANNOT_ADD_FOREIGN` | FK can't be added (missing parent, type mismatch, cycle) |

## Gotchas and lessons

- A failure in **one table** during `sync({ alter: true })` can silently block changes to **every other table**. Read the startup logs.
- `unique: true` + repeated `alter: true` runs can leak duplicate indexes. Audit with `SHOW INDEX`.
- `sync({ alter: false })` never modifies existing tables.
- Circular foreign keys can make sync create tables in the wrong order; sync those models explicitly.
- Keep migration CLI config and app `.env` pointing at the same database, or you'll migrate the wrong server.

## Key takeaways

- Create a dedicated DB user with `utf8mb4`, and restart the app after editing `.env`.
- `sync()` is for convenience; migrations are for history and safety. Know which one your app runs at boot.
- MySQL allows 64 indexes per table, and `alter: true` can quietly consume them.
- Idempotent, error-code-aware `ALTER TABLE` patches at startup are a safe stopgap for adding columns.
