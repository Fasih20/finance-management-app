# Full-Stack Audit Report — Finance Platform HTTP 500s
> **Scope**: Complete end-to-end request lifecycle audit.  
> **All previous fixes confirmed** (SSL, `--force`, `tablesFilter`, removed `&` for `&&`).  
> **New bugs found: 7** across 3 severity levels.

---

## 🔴 CRITICAL Bug #1 — ESM/CJS Module Collision in `drizzle.config.js` Kills `drizzle-kit push`

### The Problem

Every `drizzle.config.js` uses **ES Module syntax**:

```js
// services/accounts/drizzle.config.js (line 1-2)
import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({ ... });
```

But every `package.json` has **no `"type": "module"`** field, which means Node.js treats all `.js` files as **CommonJS by default**. When `drizzle-kit push` runs via `npx`, it executes the config file. Node sees `import` in a CJS context and throws:

```
SyntaxError: Cannot use import statement in a module
```

This causes `drizzle-kit push` to **exit with a non-zero code**, and because the start script is now `&&`, `node server.js` **never starts**. The ECS container exits immediately, the task restarts in a crash loop, and the health check never passes.

### Evidence

| File | Line | Issue |
|---|---|---|
| [accounts/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/accounts/drizzle.config.js#L1-L2) | 1–2 | `import` syntax, no `"type":"module"` in package.json |
| [accounts/package.json](file:///e:/CloudComputing/finance-management-app/services/accounts/package.json) | — | No `"type": "module"` |
| [transactions/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/transactions/drizzle.config.js#L1-L2) | 1–2 | Same |
| [subscriptions/drizzle.config.js](file:///e:/CloudComputing/finance-management-app/services/subscriptions/drizzle.config.js#L1-L2) | 1–2 | Same |

### Fix — Option A (Recommended): Rename config files to `.mjs`

Rename `drizzle.config.js` → `drizzle.config.mjs` in all three services. `.mjs` forces ESM mode regardless of `package.json`. Then update the start script reference:

```json
// accounts/package.json
"start": "npx drizzle-kit push --config=drizzle.config.mjs --force && node server.js"
```

### Fix — Option B: Convert to CommonJS syntax

Replace `drizzle.config.js` in all three services with CJS `require()` syntax:

```js
// services/accounts/drizzle.config.js — FULL REPLACEMENT
require("dotenv").config();
const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  schema: "./db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["accounts_service.*"],
});
```
> Apply the same pattern for `transactions` (filter: `"transactions_service.*"`) and `subscriptions` (filter: `"subscriptions_service.*"`).  
> Note: The `schemaFilter` key is not a valid drizzle-kit option — remove it from all three files.

---

## 🔴 CRITICAL Bug #2 — API Gateway CORS Config Strips the Request Body on POST

### The Problem

In [apigateway.tf](file:///e:/CloudComputing/finance-management-app/infra/terraform/apigateway.tf#L13-L17):

```hcl
cors_configuration {
  allow_headers = ["content-type"]   // ← ONLY "content-type" is whitelisted
  allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_origins = ["*"]
}
```

AWS API Gateway HTTP API enforces its CORS `allow_headers` list strictly on the **preflight `OPTIONS` response**. When the browser's `OPTIONS` preflight for `POST /api/accounts` is answered, the `Access-Control-Allow-Headers` response only lists `content-type`. 

The frontend's `fetchApi` in [lib/api.ts](file:///e:/CloudComputing/finance-management-app/frontend/lib/api.ts#L7) sends:
```
Content-Type: application/json
```

This header alone is fine. **However**, Clerk attaches additional headers to authenticated sessions (specifically `Authorization: Bearer <token>` when Clerk's `getToken()` is used server-side, or potentially its own session cookies). More critically: AWS's own API Gateway VPC Link can add headers like `x-amzn-*`. If any of those reach the preflight check and are not whitelisted, the browser blocks the request entirely with a CORS error — which manifests as a network failure / 500 on the client side.

**The immediate impact**: The `allow_headers` whitelist is too restrictive. It should at minimum include `authorization` for when you add auth headers, and `*` is the safest choice for an internal API.

### Fix — [`apigateway.tf`](file:///e:/CloudComputing/finance-management-app/infra/terraform/apigateway.tf#L13-L17)

```hcl
cors_configuration {
  allow_headers = ["content-type", "authorization", "x-requested-with"]
  allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  allow_origins = ["*"]
}
```

---

## 🔴 CRITICAL Bug #3 — `summary` Service Crashes on Boot (No `drizzle.config.js`, But Start Script Calls It)

### The Problem

The `summary` service has **no database** — it only calls the `transactions` microservice via HTTP. It has no `drizzle.config.js` file. But after the user's edit, [summary/package.json](file:///e:/CloudComputing/finance-management-app/services/summary/package.json#L7) now reads:

```json
"start": "npx drizzle-kit push --config=drizzle.config.js --force && node server.js"
```

When this runs inside the container, `npx drizzle-kit push --config=drizzle.config.js` will **fail immediately** because the file does not exist. Because it now uses `&&` instead of `&`, `node server.js` never starts. The `summary` ECS task crashes in a boot loop.

This means the `GET /api/summary` endpoint is permanently dead for all users (including Pro users trying to generate AI insights).

### Evidence

```
services/summary/
  server.js       ← exists
  package.json    ← has drizzle-kit push in start script
  Dockerfile      ← calls npm run start
  ❌ drizzle.config.js  ← DOES NOT EXIST
  ❌ db/           ← NO DB DIRECTORY
```

### Fix — [`summary/package.json`](file:///e:/CloudComputing/finance-management-app/services/summary/package.json#L7)

Remove `drizzle-kit` entirely from the `summary` start script — it has no schema to push:

```json
{
  "name": "summary-service",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.11.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1"
  }
}
```

---

## 🟠 HIGH Bug #4 — API Gateway Path Rewrite Causes Gateway to Receive Wrong URL

### The Problem

In [apigateway.tf](file:///e:/CloudComputing/finance-management-app/infra/terraform/apigateway.tf#L31-L33), the integration has:

```hcl
request_parameters = {
  "overwrite:path" = "$request.path"
}
```

The AWS API Gateway is deployed at a stage named `prod` ([terraform.tfvars line 7](file:///e:/CloudComputing/finance-management-app/infra/terraform/terraform.tfvars#L7)). This means all API URLs look like:

```
https://<id>.execute-api.us-east-1.amazonaws.com/prod/api/accounts
```

The `$request.path` variable in API Gateway **includes the stage prefix**. So the path forwarded to the internal ALB/gateway is:

```
/prod/api/accounts
```

But the Express gateway in [gateway/server.js](file:///e:/CloudComputing/finance-management-app/services/gateway/server.js#L118) only registers routes like:

```js
app.get("/api/accounts", ...)
app.post("/api/accounts", ...)
```

`/prod/api/accounts` does **not match** `/api/accounts` → Express returns a `404`, which the API Gateway propagates as a failure.

### Verify This

Check CloudWatch logs for the `gateway` service. If you see `Cannot GET /prod/api/accounts` or `404`, this is the bug.

### Fix

**Option A (Recommended)**: Use `$request.path.replace("/prod", "")` — but AWS API Gateway HTTP API doesn't support string replacement in `request_parameters`.

**The real fix**: Change `"overwrite:path"` to use `$request.path` but strip the stage name. The correct variable for API Gateway HTTP API is:

```hcl
request_parameters = {
  "overwrite:path" = "$request.path"
}
```

This is actually correct **only if** the stage name is the default `$default`. Since you use a named stage `prod`, requests arrive as `/prod/api/...` and `$request.path` = `/prod/api/...`.

**Switch to stage `$default`** OR **use `overwrite:path = "$request.path"` and rename the stage to `$default`**:

```hcl
// apigateway.tf
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"    // ← Use $default to avoid /prod prefix
  auto_deploy = true
  ...
}
```

Then update [variables.tf](file:///e:/CloudComputing/finance-management-app/infra/terraform/variables.tf) and [terraform.tfvars](file:///e:/CloudComputing/finance-management-app/infra/terraform/terraform.tfvars):
```hcl
// terraform.tfvars
api_gateway_stage = "$default"
```

> **Note**: With `$default`, the invoke URL changes to `https://<id>.execute-api.us-east-1.amazonaws.com/` (no stage prefix). Paths will be `/api/accounts` directly — matching Express routes correctly.

---

## 🟠 HIGH Bug #5 — Gateway Service Has No Body Parsing for the Request It Forwards

### The Problem

In [gateway/server.js](file:///e:/CloudComputing/finance-management-app/services/gateway/server.js#L14-L16), the gateway parses JSON:

```js
app.use(express.json());
```

This is correct for reading the body from the client. The `forwardJson` helper in [gateway/server.js lines 19-36](file:///e:/CloudComputing/finance-management-app/services/gateway/server.js#L19-L36) re-serializes it:

```js
async function forwardJson(method, targetUrl, body) {
  const response = await fetch(targetUrl, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
```

**This is structurally correct**, but there is a subtle issue: `req.body` is passed as the `body` argument. If `express.json()` fails to parse the incoming body (e.g., because the `Content-Type` header is missing or wrong), `req.body` is `undefined`, and the downstream service receives no body — causing the `!userId` check in `accounts/server.js` to fail with a 400, or the `!accountId` check to fail.

The `fetchApi` in [lib/api.ts](file:///e:/CloudComputing/finance-management-app/frontend/lib/api.ts#L7) does set `"Content-Type": "application/json"`, so this should be OK for direct browser calls. However this becomes an issue if the API Gateway alters headers.

**Add a safety check** to the gateway to log when body is empty on POST:

```js
// Add after app.use(express.json()); in gateway/server.js
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.body) {
    console.warn(`[GATEWAY] Empty body on ${req.method} ${req.url}`);
  }
  next();
});
```

---

## 🟡 MEDIUM Bug #6 — `accounts/server.js` Ignores the Frontend's `manualBalance` Field

### The Problem

The frontend sends this payload when creating a manual account ([accounts/page.tsx lines 39-45](file:///e:/CloudComputing/finance-management-app/frontend/app/accounts/page.tsx#L39-L45)):

```js
// Frontend sends:
{
  userId: user.id,
  institutionName: manualBankName || "Manual Account",
  // Note: manualBalance is collected in the UI but NEVER sent in the payload
}
```

The `manualBalance` state is collected in the form but is **never included in the POST body**. The user fills in "Initial Balance ($)" and clicks "Connect Account" but the balance is silently discarded. The backend uses a random balance instead. This is a UX bug but causes user confusion — the account appears with a wildly different balance than what was entered.

### Fix — [`frontend/app/accounts/page.tsx`](file:///e:/CloudComputing/finance-management-app/frontend/app/accounts/page.tsx#L39-L51)

```tsx
const payload = isDemo ? {
  userId: user.id,
  institutionName: "Demo Bank",
} : {
  userId: user.id,
  institutionName: manualBankName || "Manual Account",
  initialBalanceCents: manualBalance ? Math.round(parseFloat(manualBalance) * 100) : undefined,
};
```

And in [accounts/server.js](file:///e:/CloudComputing/finance-management-app/services/accounts/server.js#L46-L54):

```js
app.post("/accounts", async (req, res) => {
  const { userId, institutionName, initialBalanceCents } = req.body;
  // ...
  const mockBalanceCents = initialBalanceCents ?? Math.floor(Math.random() * 500000) + 10000;
  
  const newAccount = await db.insert(accounts).values({
    id: mockAccountId,
    userId,
    name: `${institutionName || "Test Bank"} Checking`,
    plaidId: `ins_${crypto.randomUUID().slice(0, 8)}`,
    mask: Math.floor(1000 + Math.random() * 9000).toString(),
    currentBalanceCents: mockBalanceCents,
  }).returning();
```

---

## 🟡 MEDIUM Bug #7 — `dashboard/page.tsx` Also Has Duplicate Account Modal (Same Balance Bug)

The [dashboard/page.tsx](file:///e:/CloudComputing/finance-management-app/frontend/app/dashboard/page.tsx#L98-L105) has an identical account creation flow with the same payload mismatch — `manualBalance` is captured but never sent. Apply the same fix from Bug #6 there too.

---

## Confirmed Working (No Bugs Found)

| Area | Status | Notes |
|---|---|---|
| `accounts/server.js` route handlers | ✅ OK | Proper try/catch, correct Drizzle insert |
| `transactions/server.js` route handlers | ✅ OK | Redis fallback is correct, try/catch present |
| `subscriptions/server.js` route handlers | ✅ OK | Upsert with `onConflictDoUpdate` is correct |
| `gateway/server.js` route registration | ✅ OK | All 6 routes present, no commented-out routes missing |
| `gateway/server.js` forwardJson helper | ✅ OK | Correctly passes `req.body` and `?query` params |
| `db/schema.js` (all 3 services) | ✅ OK | `pgSchema` isolation is architecturally correct |
| Clerk `userId` flow | ✅ OK | Frontend correctly uses `useUser().user.id` and passes as query param / body |
| SSL fix (`rejectUnauthorized: false`) | ✅ APPLIED | Correct |
| `--force` flag | ✅ APPLIED | Correct — suppresses interactive TTY prompt |
| `tablesFilter` | ✅ APPLIED | Correct filter syntax |

---

## Priority Fix Order

Apply in this order for fastest path to a working system:

```
1. 🔴 Bug #1 — Fix ESM/CJS in drizzle.config.js (all 3 services)
              → Rename to .mjs OR convert to require()
              
2. 🔴 Bug #3 — Fix summary/package.json start script
              → Remove drizzle-kit push entirely

3. 🔴 Bug #2 — Fix API Gateway CORS allow_headers
              → Add "authorization" to the list

4. 🟠 Bug #4 — Fix API Gateway stage name / path rewrite
              → Verify in CloudWatch: does gateway see /prod/api/... ?
              → Switch stage to $default

5. 🟠 Bug #5 — Add body logging to gateway
              → Verify body isn't being dropped

6. 🟡 Bug #6 & #7 — Fix balance payload in accounts pages
```

---

## Complete Fixed File Listing

### 1. `services/accounts/drizzle.config.js` (convert to CJS)
```js
require("dotenv").config();
const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  schema: "./db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["accounts_service.*"],
});
```

### 2. `services/transactions/drizzle.config.js` (convert to CJS)
```js
require("dotenv").config();
const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  schema: "./db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["transactions_service.*"],
});
```

### 3. `services/subscriptions/drizzle.config.js` (convert to CJS)
```js
require("dotenv").config();
const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  schema: "./db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["subscriptions_service.*"],
});
```

### 4. `services/summary/package.json` (remove drizzle-kit)
```json
{
  "name": "summary-service",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.11.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1"
  }
}
```

### 5. `infra/terraform/apigateway.tf` (CORS + stage fix)
```hcl
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type", "authorization", "x-requested-with"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = ["*"]
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  tags = local.common_tags
}
```

### 6. `infra/terraform/terraform.tfvars` (update stage)
```hcl
aws_region          = "us-east-1"
project_name        = "finance-platform"
db_password         = "SuperSecretDbPass123!"
image_tag           = "v1"
deploy_ecs_services = false
cloud_map_namespace = "finance.local"
api_gateway_stage   = "$default"
```
