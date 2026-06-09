# Deep Diagnostic Report — Finance Platform ECS/Fargate HTTP 500s

> **Mode**: Read-Only Audit. No files were modified.
> **Scope**: All 5 microservices (`accounts`, `transactions`, `subscriptions`, `summary`, `gateway`) + Terraform infrastructure.

---

## Executive Summary

The HTTP 500 errors on state-changing calls are caused by **three compounding bugs**, not one. They interact to produce a system that boots and passes health checks but silently fails on every write. The primary killer is a **`drizzle-kit push` TTY deadlock** inside the ECS container; the secondary killers are a **misnamed filter key** that makes the deadlock inescapable even with the "fix" applied, and a **`pg.Pool` SSL mismatch** that causes every database write to fail independently of Drizzle.

---

## Bug #1 — CRITICAL: `drizzle-kit push` Deadlocks the Container on First Run

### The Exact Mechanism

The start script in every `package.json` is:

```json
"start": "npx drizzle-kit push --config=drizzle.config.js & node server.js"
```

The `&` operator in a POSIX shell sends `drizzle-kit push` to the **background**, then immediately starts `node server.js`. This is correct _intent_ — the goal is to pass the ECS health check while the schema push finishes.

**The problem is what `drizzle-kit push` does on the very first deployment against a brand-new, empty database:**

When `drizzle-kit push` connects to the `commerce` database and finds that the target PostgreSQL schema (e.g., `accounts_service`) **does not yet exist**, it must create it. Newer versions of `drizzle-kit` (≥ 0.28) are **interactive by default** — they prompt on stdout:

```
[⣷] Pulling schema from database...
[✓] Changes detected
? Do you want to apply these changes? › (y/N)
```

Inside an ECS Fargate container there is **no TTY** (`/dev/tty` is not allocated). The process is waiting for a `y\n` keystroke that will **never arrive**. The background job hangs indefinitely, holding an open connection/transaction to RDS. This is confirmed by the CloudWatch log excerpt you provided:

```
[⣷] Pulling schema from database...
```
— the spinner emoji is the last line. The push **never completed**.

### Evidence in Code

| File | Line | Evidence |
|---|---|---|
| [accounts/package.json](file:///e:/CloudComputing/finance-management-app/services/accounts/package.json#L7) | 7 | `"start": "npx drizzle-kit push ... & node server.js"` |
| [transactions/package.json](file:///e:/CloudComputing/finance-management-app/services/transactions/package.json#L7) | 7 | Identical pattern |
| [subscriptions/package.json](file:///e:/CloudComputing/finance-management-app/services/subscriptions/package.json#L7) | 7 | Identical pattern |

### What This Means Operationally

- `node server.js` starts, the `/health` endpoint responds `200 OK`.
- ECS marks the task as **healthy**. The service looks alive.
- The DB schemas (`accounts_service`, `transactions_service`, `subscriptions_service`) were **never created in PostgreSQL**.
- Every subsequent SQL query that targets a table inside those schemas will throw: `relation "accounts_service.accounts" does not exist`.
- The `catch` blocks in `server.js` log `DB Error:` and return `HTTP 500`.

---

## Bug #2 — HIGH: `schemaFilter` Is the Wrong Key — The Schema Guard Does Nothing

### The Exact Mechanism

Each `drizzle.config.js` uses the key `schemaFilter`:

```js
// accounts/drizzle.config.js (line 11)
schemaFilter: ["accounts_service"] // <--- The magic fix
```

**This key does not exist in the Drizzle Kit configuration schema for `drizzle-kit push`.**

The correct key is **`tablesFilter`** (a glob pattern to restrict which tables are touched) or, when using `pgSchema`, Drizzle Kit is supposed to automatically scope to that schema. In practice, the `schemaFilter` key is silently **ignored** by `drizzle-kit` — it is not a documented, valid config option.

### Evidence in Code

| File | Line | Evidence |
|---|---|---|
| [accounts/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/accounts/drizzle.config.js#L11) | 11 | `schemaFilter: ["accounts_service"]` |
| [transactions/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/transactions/drizzle.config.js#L11) | 11 | `schemaFilter: ["transactions_service"]` |
| [subscriptions/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/subscriptions/drizzle.config.js#L11) | 11 | `schemaFilter: ["subscriptions_service"]` |

### Impact

Even if the TTY deadlock were somehow bypassed (e.g., by adding `--accept-warnings` / `--force` flags or by using an older drizzle-kit version), the `schemaFilter` key being unknown means:
1. `drizzle-kit` sees **all schemas** in the database.
2. On the second service to start, it detects the tables of the _first_ service as "unknown tables not in my schema file."
3. It prompts: `? Do you want to drop these tables?` — again waiting for TTY input that never comes.

The comment `// <--- The magic fix` in all three files indicates this was added as a workaround, but it is not a real fix.

---

## Bug #3 — HIGH: `db/index.js` Creates a `pg.Pool` Without SSL, Contradicting the `DATABASE_URL`

### The Exact Mechanism

The `DATABASE_URL` injected by Terraform into ECS containers is ([ecs.tf line 2](file:///e:/CloudComputing/finance-management-app/infra/terraform/ecs.tf#L2)):

```hcl
local.database_url = "postgresql://...@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require"
```

The `?sslmode=require` parameter is appended. This is correct — AWS RDS requires SSL.

However, every `db/index.js` constructs the `pg.Pool` like this:

```js
// accounts/db/index.js (line 5-7)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/commerce",
});
```

**The `node-postgres` (`pg`) library's `Pool` constructor does NOT automatically parse `sslmode=require` from the connection string and enable SSL.** The `sslmode` parameter in a connection string is a `libpq` convention; `node-postgres` requires it to be explicitly set via:

```js
ssl: { rejectUnauthorized: false }  // or with a CA cert
```

Without this, the `pg` Pool attempts a **plain TCP connection** to RDS port 5432. RDS with `rds.force_ssl=1` (the AWS default for `postgres` engine) **rejects this connection** or downgrades it but Drizzle will have connection-level errors on writes.

### Evidence in Code

| File | Line | Evidence |
|---|---|---|
| [accounts/db/index.js](file:///e:/CloudComputing/finance-management-app/services/accounts/db/index.js#L5-L7) | 5–7 | `Pool({ connectionString: ... })` — no `ssl` key |
| [transactions/db/index.js](file:///e:/CloudComputing/finance-management-app/services/transactions/db/index.js#L5-L7) | 5–7 | Identical |
| [subscriptions/db/index.js](file:///e:/CloudComputing/finance-management-app/services/subscriptions/db/index.js#L5-L7) | 5–7 | Identical |
| [ecs.tf](file:///e:/CloudComputing/finance-management-app/infra/terraform/ecs.tf#L2) | 2 | `DATABASE_URL` ends in `?sslmode=require` |

> **Note on the health check log:** CloudWatch logs show "database connection is successful" because the `Pool` is lazily initialized — the `new Pool()` call itself never throws. The first actual query on a write is when the SSL rejection happens.

---

## Bug #4 — MEDIUM: `DB_SCHEMA` Environment Variable Is Injected but Never Consumed

### The Exact Mechanism

Terraform injects a `DB_SCHEMA` environment variable into each service container:

```hcl
// ecs.tf lines 69-71
{ name = "DB_SCHEMA", value = "accounts_service" }
```

However, no file in any service reads `process.env.DB_SCHEMA`. The schema is hardcoded inside [accounts/db/schema.js](file:///e:/CloudComputing/finance-management-app/services/accounts/db/schema.js#L17):

```js
const mySchema = pgSchema("accounts_service"); // hardcoded string
```

This is not a breaking bug (the hardcoded value matches), but it indicates an architectural inconsistency: Terraform believes the schema name is configurable per-environment but the application doesn't honor it. A future environment mismatch would be invisible.

---

## Schema Ownership Map

A complete audit of table-to-service ownership based on `db/schema.js` files:

| PostgreSQL Schema | Table | Service | Schema File |
|---|---|---|---|
| `accounts_service` | `accounts` | `accounts` | [schema.js](file:///e:/CloudComputing/finance-management-app/services/accounts/db/schema.js#L19) |
| `transactions_service` | `transactions` | `transactions` | [schema.js](file:///e:/CloudComputing/finance-management-app/services/transactions/db/schema.js#L18) |
| `subscriptions_service` | `subscriptions` | `subscriptions` | [schema.js](file:///e:/CloudComputing/finance-management-app/services/subscriptions/db/schema.js#L16) |

**The schema isolation design is architecturally correct.** Each service uses `pgSchema(...)` to fence its tables into a dedicated PostgreSQL schema. There is zero table name collision between services. The design would work perfectly if the three bugs above were fixed.

The `summary` and `gateway` services have **no database connection** — they are correct as pure HTTP orchestrators.

---

## Error Propagation Chain (End-to-End)

```
Container starts
  │
  ├─► npx drizzle-kit push (background job)
  │     └─► Connects to RDS, finds empty DB
  │           └─► Prints "[⣷] Pulling schema..." 
  │                 └─► Waits for TTY input → ∞ HANG
  │                       └─► PostgreSQL schema is NEVER created
  │
  └─► node server.js (foreground)
        └─► /health → 200 OK (ECS marks task Healthy ✓)
        │
        └─► POST /accounts (first write)
              └─► db.insert(accounts).values(...) 
                    └─► pg.Pool opens TCP connection
                          └─► RDS rejects plain TCP (SSL required) ← Bug #3
                          OR (if SSL somehow passes)
                          └─► Query targets "accounts_service"."accounts"
                                └─► Schema doesn't exist ← Bug #1
                                      └─► PostgreSQL: relation does not exist
                                            └─► catch(error) → res.status(500) ✓
```

---

## Remediation Checklist (Read-Only — Not Applied)

The following changes would fix all four bugs. **These are recommendations only; no files have been modified.**

### Fix Bug #1 & #2: Replace `drizzle-kit push` with a non-interactive, schema-aware call

In each `package.json`, change the start script from:
```json
"start": "npx drizzle-kit push --config=drizzle.config.js & node server.js"
```
To:
```json
"start": "npx drizzle-kit push --config=drizzle.config.js --force && node server.js"
```

> - `--force` (or `--accept-warnings` depending on drizzle-kit version) suppresses the TTY prompt.
> - Change `&` (background) to `&&` (sequential) so `node server.js` only starts **after** the schema push succeeds. Health check timing must be accounted for in ECS `startPeriod`.

### Fix Bug #2: Use the correct filter key in `drizzle.config.js`

The `schemaFilter` key should be removed. With `pgSchema()` used in the schema file, `drizzle-kit` will automatically scope to the correct PostgreSQL schema when the schema file itself uses `pgSchema`. Alternatively, for belt-and-suspenders, use `tablesFilter` with a wildcard:
```js
tablesFilter: ["accounts_service.*"]
```

### Fix Bug #3: Add explicit SSL to `db/index.js`

```js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for AWS RDS
});
```

### Fix Bug #4 (Minor): Consume `DB_SCHEMA` from environment

```js
// db/schema.js
const mySchema = pgSchema(process.env.DB_SCHEMA || "accounts_service");
```

---

## Infrastructure Observations (No Bugs, Notable Design Notes)

- **`deploy_ecs_services = false`** in [terraform.tfvars](file:///e:/CloudComputing/finance-management-app/infra/terraform/terraform.tfvars#L5): ECS desired count is `0` in Terraform. Services must be deployed with `desired_count=1` separately (likely via GitHub Actions). This is intentional and correct.
- **Security groups are well-formed**: `services_self_ingress` correctly allows all inter-service TCP, and `rds_from_services` opens port 5432 only from the services SG. No networking bug found.
- **Redis fallback in `transactions/server.js`** ([line 30-32](file:///e:/CloudComputing/finance-management-app/services/transactions/server.js#L30-L32)): Redis connection failure is properly caught and falls back to in-memory cache. This is resilient.
- **`summary/server.js`** has no DB connection — it only calls `transactions-service` internally. No schema or SSL issue applies here.
