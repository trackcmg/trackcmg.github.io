# Track CMG — System Architecture

> **Document Version:** 3.0 (Phase 7.3 — Supabase Auth + Lighthouse Sprint)
> **Last Updated:** April 2026
> **Status:** Authoritative Source of Truth
> **Branch:** `develop`

This document supersedes all prior architecture notes. If any other document in this
repository contradicts the information here, this file takes precedence.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Module Dependency Graph](#3-module-dependency-graph)
4. [Data Flow Logic](#4-data-flow-logic)
   - 4.1 [Hybrid Storage Strategy](#41-hybrid-storage-strategy)
   - 4.2 [Load Sequence on App Start](#42-load-sequence-on-app-start)
   - 4.3 [Proxy Pattern — Yahoo Finance via GAS](#43-proxy-pattern--yahoo-finance-via-gas)
5. [Data Integrity Protocols](#5-data-integrity-protocols)
   - 5.1 [Wipe & Insert Policy](#51-wipe--insert-policy)
6. [Database Schema](#6-database-schema)
   - 6.1 [JSONB Payload Strategy](#61-jsonb-payload-strategy)
   - 6.2 [Table Reference](#62-table-reference)
   - 6.3 [Row-Level Security](#63-row-level-security)
7. [Configuration Reference](#7-configuration-reference)
8. [Application State Model](#8-application-state-model)
9. [Authentication Model](#9-authentication-model) — Supabase Auth (email + password)
10. [Offline & Error Handling](#10-offline--error-handling)

---

## 1. Application Overview

**Track CMG** is a personal financial dashboard for tracking investment portfolios,
closed trades, dividends, and personal habit metrics (gym, books, movies, series).

It is a **fully serverless, zero-backend** application:

- **No dedicated server.** Static files (`HTML`, `CSS`, vanilla `ES6 Modules`) are
  served by GitHub Pages. Zero build step, zero transpilation.
- **No secrets in the frontend.** The Supabase `ANON_KEY` is public by design and is
  protected exclusively by **Row-Level Security (RLS)** policies enforced on the
  Supabase server. No private key, no OAuth secret, no API token is stored in code.
- **Two external services:**
  - **Supabase** — PostgreSQL + PostgREST REST API. Primary and authoritative storage.
  - **Google Apps Script (GAS)** — CORS proxy to fetch real-time stock prices from
    Yahoo Finance. Also serves as the legacy storage backend (pre-Phase 7, deprecated).

---

## 2. System Architecture Diagram

```mermaid
graph TD
    Browser["🖥️ User Browser\nVanilla JS ES6 Modules\nChart.js · Supabase JS SDK (CDN)"]

    subgraph Supabase ["☁️ Supabase (Primary Backend)"]
        SB_API["PostgREST REST API"]
        SB_DB["PostgreSQL\n(RLS Enforced)"]
        SB_API --> SB_DB
    end

    subgraph GAS ["⚙️ Google Apps Script (Proxy Only)"]
        GAS_PROXY["doGet() Handler"]
        GAS_YAHOO["Yahoo Finance\nUrlFetchApp"]
        GAS_LEGACY["Google Sheets\n(Deprecated — Migration Source)"]
        GAS_PROXY -->|"?action=quote"| GAS_YAHOO
        %% GAS_LEGACY removed — migration completed
    end

    Browser -->|"Supabase JS SDK\nSELECT · DELETE · INSERT · UPSERT"| SB_API
    Browser -->|"fetch() — CORS-free\n?action=quote&ticker=AAPL"| GAS_PROXY
    GAS_YAHOO -->|"JSON price data"| GAS_PROXY
    GAS_PROXY -->|"JSON response"| Browser
    SB_API -->|"JSON rows"| Browser

    style Supabase fill:#0d1f0d,stroke:#22df8a,color:#e0e0ff
    style GAS fill:#0d0d1f,stroke:#5533ff,color:#e0e0ff
    style Browser fill:#111120,stroke:#8888aa,color:#e0e0ff
```

### Component Responsibilities

| Component | Role | Technology |
|-----------|------|------------|
| User Browser | Render UI, execute business logic, manage all state | Vanilla JS ES6 Modules, Chart.js |
| Supabase | Persistent CRUD storage | PostgreSQL + PostgREST |
| Google Apps Script | CORS proxy for Yahoo Finance (live stock quotes only) | Google Apps Script `doGet()` |
| GitHub Pages | Static file hosting | Git + GitHub Pages |

---

## 3. Module Dependency Graph

```mermaid
graph LR
    app["app.js\n(Entry Point)"]
    config["config.js\n(Constants)"]
    state["state.js\n(Live Mutable State)"]
    cloud["cloud.js\n(Backend Router)"]
    storage["storage.js\n(localStorage + D hydration)"]
    auth["auth.js\n(Session Management)"]
    analytics["analytics.js\n(Charts & Analytics Tab)"]
    portfolio["portfolio.js\n(FX · Valuations · Price Fetch)"]
    utils["utils.js\n(Formatters · Toast)"]
    modals["modals.js\n(CRUD Forms)"]

    app --> cloud
    app --> storage
    app --> auth
    app --> analytics
    app --> portfolio
    app --> modals
    cloud --> config
    cloud --> storage
    cloud --> utils
    analytics --> config
    analytics --> portfolio
    analytics --> utils
    analytics --> state
    auth --> state
    auth --> utils
    storage --> config
    storage --> state
    portfolio --> state
    portfolio --> config
    modals --> state
    modals --> cloud
```

**Critical design constraint:** `state.js` exports **live bindings** (`export let`).
Any module that imports `_authed`, `_token`, or `_pendingAction` always reads the
current value — not a snapshot from import time. All mutations must go through the
provided setter functions (`setAuthed`, `setToken`, `setPendingAction`).

---

## 4. Data Flow Logic

### 4.1 Hybrid Storage Strategy

The application operates under a **dual-backend model** controlled by a single
constant in `js/config.js`:

```js
export const STORAGE_MODE = 'supabase'; // 'supabase' | 'gas'
```

The public router in `cloud.js` dispatches all I/O through this flag:

```
fetchDataFromCloud()
  ├─ STORAGE_MODE === 'supabase'  →  _loadFromSupabase()  [DEFAULT]
  └─ STORAGE_MODE === 'gas'       →  _loadFromGAS()

pushDataToCloud()
  ├─ STORAGE_MODE === 'supabase'  →  _saveToSupabase()    [DEFAULT]
  └─ STORAGE_MODE === 'gas'       →  _saveToGAS()
```

**Why Supabase is the primary backend:**

| Criterion | Supabase | GAS / Google Sheets (legacy) |
|-----------|----------|------------------------------|
| Read latency | ~100–300 ms (direct SDK) | ~800–2 000 ms (cold start) |
| Write reliability | Transactional, ACID | Sheets can conflict on concurrent writes |
| CORS | Native (SDK handles it) | Required a proxy layer |
| Scalability | PostgreSQL, no practical row limit | Google Sheets 5M cell limit |
| Cost | Free tier covers personal use | Free but latency penalises UX |
| Data ownership | Exportable PostgreSQL | Locked to Google ecosystem |

**GAS mode is maintained** for emergency fallback and to support the one-time
migration workflow. It is **not** the production default.

> ⚠️ **Warning:** Setting `STORAGE_MODE = 'gas'` in production will revert to the
> legacy backend. All data written since the Supabase migration will be invisible
> until the mode is restored.

### 4.2 Load Sequence on App Start

The app is fully **auth-gated**: all data loading happens after Supabase confirms a
authenticated session. Unauthenticated visitors only see the login overlay.

```
app.init()
 └─ supabase.auth.onAuthStateChange(event, session)
      ├─ 'SIGNED_IN'  → _handleLogin(user)
      │                   └─ _postAuthInit()
      │                        ├─ loadData()
      │                        │    ├─ loadLocal()         ← sync hydration from localStorage
      │                        │    └─ fetchDataFromCloud() ← 6 parallel Supabase SELECTs
      │                        │         ├─ loadDataFromObj(obj, merge=true)
      │                        │         ├─ saveLocal()    ← write merged state to localStorage
      │                        │         └─ updateSyncStatus('ok' | 'err' | 'local')
      │                        └─ renderAll()             ← paint UI (7 deferred tasks)
      │
      └─ 'SIGNED_OUT' → _handleLogout() → show login overlay, clear edit controls
```

> **Empty database is not an error.** If Supabase returns zero rows across all tables
> (first-run state), `_loadFromSupabase()` calls `loadDataFromObj(FALLBACK, true)`
> and returns `true`. The app starts in a clean, empty state — not an error state.

### 4.3 Proxy Pattern — Yahoo Finance via GAS

Yahoo Finance has no CORS-compliant public API. Direct `fetch()` from the browser
is blocked by the browser's same-origin policy.

**Solution:** All price/quote requests route through the GAS Web App, which runs
server-side and is exempt from browser CORS restrictions.

```
Browser                        GAS Web App                    Yahoo Finance
  │                                 │                               │
  │─── fetch(PROXY_URL +            │                               │
  │          ?action=quote          │                               │
  │          &ticker=AAPL) ────────►│                               │
  │                                 │── UrlFetchApp.fetch(          │
  │                                 │     query1.finance.yahoo.com) │
  │                                 │◄── JSON price data ───────────│
  │◄── JSON (CORS-free) ────────────│                               │
```

`PROXY_URL` in `config.js` holds the deployed GAS Web App URL. It is used exclusively
for live stock quote requests (`?action=quote`).

---

## 5. Data Integrity Protocols

### 5.1 Wipe & Insert Policy

Every `_saveToSupabase()` call follows a **Wipe & Insert** strategy for array-type
data:

```
Phase 1 — DELETE
  DELETE FROM holdings      WHERE user_id = <authenticated_uid>
  DELETE FROM closed_trades WHERE user_id = <authenticated_uid>
  DELETE FROM media         WHERE user_id = <authenticated_uid>
  DELETE FROM gym           WHERE user_id = <authenticated_uid>

Phase 2 — INSERT
  INSERT INTO holdings      (new rows from D.holdings)
  INSERT INTO closed_trades (new rows from D.closedTrades)
  INSERT INTO media         (new rows from D.books + D.movies + D.series)
  INSERT INTO gym           (new rows from D.gym)

Phase 3 — UPSERT (merge, not replace)
  UPSERT INTO history  ON CONFLICT (user_id, snapped_at) DO UPDATE
  UPSERT INTO settings ON CONFLICT (user_id) DO UPDATE
```

> ⚠️ **Data Loss Risk:** Phase 1 deletions are irreversible within the operation.
> If Phase 2 inserts fail mid-batch, the database will be in a partially wiped state.
> All operations are batched in a single `Promise.all()`. If any operation rejects,
> the error is caught and the user is alerted — but there is no automatic rollback.
> Always export a backup from the Supabase dashboard before executing the migration.

**Why Wipe & Insert instead of individual UPSERTs?**

- A holding's primary business key (`ticker`) can change (stock splits, renames).
  Upsert keyed on `ticker` would leave orphan rows.
- The in-memory `D` array represents the **full canonical state**. Partial diffing
  would require complex change-set logic for negligible gain in a single-user app.
- `history` and `settings` use UPSERT because their keys are stable and append-safe.

---

## 6. Database Schema

### 6.1 JSONB Payload Strategy

All domain objects are stored in a **`payload JSONB`** column. Only fields that
require server-side filtering or ordering are promoted to dedicated scalar columns
(`user_id`, `ticker`, `type`, `log_date`, `snapped_at`).

**Rationale:**
- The data model evolves frequently; new fields added to holdings or trades require
  no schema migration.
- JSONB is fully indexable and queryable in PostgreSQL when needed.
- Single-user personal app — the cost of flexible schema outweighs strict typing.

**Trade-off:** No database-level enforcement of payload field presence or type.
Data integrity is the responsibility of the JavaScript application layer (`storage.js`).

### 6.2 Table Reference

#### `holdings` — Open Investment Positions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Row identifier |
| `user_id` | `text` | NOT NULL | Authenticated user UUID (`auth.uid()`) |
| `ticker` | `text` | NOT NULL | Stock ticker (e.g. `'AAPL'`). Promoted for indexing |
| `payload` | `jsonb` | NOT NULL | Full holding object |
| `created_at` | `timestamptz` | default `now()` | Auto-set by Supabase |

Representative `payload` shape:
```json
{
  "ticker": "AAPL",
  "shares": 10,
  "entryPrice": 150.00,
  "currency": "USD",
  "sector": "Technology",
  "dividends": 12.50
}
```

---

#### `closed_trades` — Completed Positions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | Row identifier |
| `user_id` | `text` | NOT NULL | Owner identifier |
| `ticker` | `text` | NOT NULL | Stock ticker |
| `payload` | `jsonb` | NOT NULL | Full closed trade object |
| `created_at` | `timestamptz` | default `now()` | Auto-set |

Representative `payload` shape:
```json
{
  "ticker": "MSFT",
  "totalShares": 5,
  "avgBuy": 280.00,
  "sellPrice": 320.00,
  "currency": "USD",
  "realizedPnl": 200.00,
  "dividends": 8.00
}
```

---

#### `media` — Books, Movies, Series

Single table with a `type` discriminator column.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | Row identifier |
| `user_id` | `text` | NOT NULL | Owner identifier |
| `type` | `text` | NOT NULL | `'book'`, `'movie'`, or `'serie'` |
| `payload` | `jsonb` | NOT NULL | Full media object |
| `created_at` | `timestamptz` | default `now()` | Auto-set |

---

#### `gym` — Workout Log

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | Row identifier |
| `user_id` | `text` | NOT NULL | Owner identifier |
| `log_date` | `date` | NOT NULL | Workout date. Promoted for range queries |
| `payload` | `jsonb` | NOT NULL | Full workout log entry |

---

#### `history` — Portfolio Value Snapshots

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | Row identifier |
| `user_id` | `text` | NOT NULL | Owner identifier |
| `snapped_at` | `date` | NOT NULL | Snapshot date |
| `payload` | `jsonb` | NOT NULL | `{ date, totalInvested, totalValue }` |

**Unique constraint:** `UNIQUE (user_id, snapped_at)` — enables safe UPSERT.

Rows are read ordered by `snapped_at ASC` and used to render the performance chart.

---

#### `settings` — Per-User Scalar Configuration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | `text` | PK | Owner identifier |
| `cash` | `numeric` | NOT NULL, default `0` | Current cash balance (EUR) |
| `total_invested` | `numeric` | NOT NULL, default `0` | Total capital deployed (EUR) |
| `updated_at` | `timestamptz` | | Last write timestamp |

Single row per user. UPSERTed on every save. Never deleted.

---

### 6.3 Row-Level Security

All tables enforce RLS. Policies for the current single-user deployment:

```sql
-- Enable RLS
ALTER TABLE holdings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE media         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym           ENABLE ROW LEVEL SECURITY;
ALTER TABLE history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;

-- Allow all operations for the authenticated user (Phase 7.3+)
CREATE POLICY "allow_owner" ON holdings
  FOR ALL
  USING      (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Repeat for every table (see docs/SETUP.md for the full SQL script)
```

The authenticated user's UID is obtained from
`supabase.auth.onAuthStateChange((_e, session) => session?.user?.id)`
and used as `user_id` in all INSERT and DELETE operations in `cloud.js`.

---

## 7. Configuration Reference

All constants are defined in `js/config.js` as plain ES module exports.
There is **no build step**, **no `.env` file**, **no environment variables**.

| Constant | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `STORAGE_MODE` | `'supabase' \| 'gas'` | Active backend router | `'supabase'` |
| `SUPABASE_URL` | `string` | Supabase project URL | `'https://xxxxx.supabase.co'` |
| `SUPABASE_ANON_KEY` | `string` | Supabase public anon key | `'eyJhbGci...'` |
| `PROXY_URL` | `string` | Deployed GAS Web App URL | `'https://script.google.com/...'` |
| `TRADE_FX` | `object` | Static FX fallback rates (EUR base) | `{ EUR:1, USD:0.8696, ... }` |
| `FALLBACK` | `object` | Default empty data on first run | `{ holdings:[], cash:0, ... }` |

> ⚠️ **Security Note:** `SUPABASE_ANON_KEY` is intentionally public. It grants **only**
> what Supabase RLS policies explicitly permit. Never confuse it with the
> **service role key**, which bypasses RLS and must never appear in frontend code.

---

## 8. Application State Model

All mutable runtime state is centralised in `js/state.js` and exported as live
bindings. No component stores its own separate copy of domain data.

```
state.js
├── D                — Main data object (hydrated from Supabase or localStorage)
│   ├── holdings[]
│   ├── closedTrades[]
│   ├── cash
│   ├── totalInvested
│   ├── history[]
│   ├── gym[]
│   ├── books[]
│   ├── movies[]
│   └── series[]
└── _authed          — boolean: Supabase session is active (user is logged in)
```

`D` is the canonical in-memory representation of the database. All renders read from
`D`. Mutations to `D` should call `saveAndSync()` (saves locally and pushes to cloud)
or at minimum `saveLocal()` (localStorage only, no cloud push).

---

## 9. Authentication Model

Track CMG implements **Supabase Auth** (email + password) as its authentication gate.
No data is loaded or rendered until a valid session is established.

### Flow

1. On load, `app.init()` registers a listener:
   `supabase.auth.onAuthStateChange(event, session)`.
2. If Supabase restores a valid session from storage (e.g. returning user), the
   `SIGNED_IN` event fires immediately — no login prompt shown.
3. Otherwise, the login overlay is shown. The user submits email + password.
4. `supabase.auth.signInWithPassword({ email, password })` is called.
5. On success, `SIGNED_IN` fires → `_handleLogin(user)` → `_postAuthInit()` →
   data loads and the UI renders.
6. On logout (`btnLogout` click → `supabase.auth.signOut()`), `SIGNED_OUT` fires →
   `_handleLogout()` → login overlay shown, all edit controls hidden.

### Security Model

| Layer | Mechanism |
|-------|-----------|
| **Auth gate** | Supabase Auth; no render before `SIGNED_IN` |
| **Transport** | HTTPS (GitHub Pages + Supabase API) |
| **Storage-level isolation** | RLS `auth.uid()::text = user_id`; anon key can only access the authenticated user's rows |
| **No service key** | `SUPABASE_ANON_KEY` in `config.js` is the public key; the service role key is never used in frontend code |

The `ANON_KEY` is intentionally public and safe to commit. Its access surface is
exactly what RLS policies allow — nothing more.

---

## 10. Offline & Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Supabase unreachable on load | `fetchDataFromCloud()` returns `false`; app loads from `localStorage`; sync indicator → `'err'` |
| Supabase returns empty tables | Valid first-run state; `D` hydrated from `FALLBACK`; returns `true` |
| `_saveToSupabase()` write fails | `toast('Sync failed', 'err')` shown; `localStorage` copy remains intact |
| GAS proxy unreachable (price fetch) | Quote fields show `N/A`; no crash; chart renders with cached prices |
| `window.supabase` CDN not yet loaded | `_getSupabase()` throws a clear error; caught by calling function; graceful fallback |
| `SUPABASE_URL` or `ANON_KEY` not set | `_loadFromSupabase` / `_saveToSupabase` short-circuit immediately; status → `'local'` |
| Login fails (wrong credentials) | `supabase.auth.signInWithPassword()` returns error; toast shown; login overlay remains |
| Session expired | `onAuthStateChange` fires `SIGNED_OUT`; user redirected to login overlay |

