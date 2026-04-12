# Track CMG — Setup & Configuration Guide

> **Document Version:** 2.0
> **Last Updated:** April 2026
> **Audience:** Developer setting up the project from scratch or onboarding a new
> Supabase project.

This guide covers the complete setup from a blank Supabase project to a fully
functional Track CMG deployment. Follow the steps in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Project Setup](#2-supabase-project-setup)
   - 2.1 [Create the Project](#21-create-the-project)
   - 2.2 [Run the Database Schema SQL](#22-run-the-database-schema-sql)
   - 2.3 [Enable Row-Level Security](#23-enable-row-level-security)
   - 2.4 [Create the Auth User](#24-create-the-auth-user)
3. [Configure `js/config.js`](#3-configure-jsconfigjs)
4. [Google Apps Script Setup](#4-google-apps-script-setup)
5. [Local Preview](#5-local-preview)
6. [Deployment (GitHub Pages)](#6-deployment-github-pages)
7. [First-Run Checklist](#7-first-run-checklist)
8. [Resetting the Database](#8-resetting-the-database)

---

## 1. Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| Modern browser | Chrome 90+, Firefox 88+, Safari 15+ | Running the app (uses `crypto.subtle`, ES modules, `Promise.allSettled`) |
| Git | Any | Version control |
| Node.js | Any (optional) | Local dev server via `npx serve .` |
| Supabase account | Free tier sufficient | Database |
| Google account | Any | GAS proxy for Yahoo Finance |

No npm packages, no bundler, no build step. The app runs directly from static files.

---

## 2. Supabase Project Setup

### 2.1 Create the Project

1. Log in to [supabase.com](https://supabase.com).
2. Click **New project**.
3. Choose a name (e.g. `track-cmg`), set a strong database password, select a region
   geographically close to you.
4. Wait for the project to provision (~1–2 minutes).
5. Go to **Project Settings → API** and note:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **Project API Key → `anon` / `public`** key

> ⚠️ **Never use the `service_role` key in frontend code.** It bypasses RLS and
> grants unrestricted database access. Only the `anon` key belongs in `config.js`.

### 2.2 Run the Database Schema SQL

Open **SQL Editor** in the Supabase dashboard and execute the following script in
full. It is safe to run multiple times (`CREATE TABLE IF NOT EXISTS`).

```sql
-- ============================================================
--  Track CMG — Database Schema
--  Run this entire script in Supabase SQL Editor.
--  Safe to re-run: uses IF NOT EXISTS.
-- ============================================================

-- ── holdings: open investment positions ─────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  ticker      text        NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings (user_id);

-- ── closed_trades: completed (sold) positions ───────────────
CREATE TABLE IF NOT EXISTS closed_trades (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  ticker      text        NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closed_trades_user ON closed_trades (user_id);

-- ── media: books, movies, series ────────────────────────────
-- Discriminated by the `type` column: 'book' | 'movie' | 'serie'
CREATE TABLE IF NOT EXISTS media (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('book', 'movie', 'serie')),
  payload     jsonb       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_user_type ON media (user_id, type);

-- ── gym: workout log entries ─────────────────────────────────
CREATE TABLE IF NOT EXISTS gym (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  log_date    date        NOT NULL,
  payload     jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gym_user_date ON gym (user_id, log_date);

-- ── history: portfolio value snapshots ───────────────────────
-- One row per (user_id, date). Used for the performance chart.
CREATE TABLE IF NOT EXISTS history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  snapped_at  date        NOT NULL,
  payload     jsonb       NOT NULL,
  UNIQUE (user_id, snapped_at)
);

CREATE INDEX IF NOT EXISTS idx_history_user_date ON history (user_id, snapped_at);

-- ── settings: per-user scalar configuration ──────────────────
-- One row per user. Cash balance and total invested capital.
CREATE TABLE IF NOT EXISTS settings (
  user_id        text        PRIMARY KEY,
  cash           numeric     NOT NULL DEFAULT 0,
  total_invested numeric     NOT NULL DEFAULT 0,
  updated_at     timestamptz
);
```

### 2.3 Enable Row-Level Security

Run this second script immediately after the schema script. RLS must be enabled
**before** the `anon` key is put into production.

```sql
-- ============================================================
--  Track CMG — Row-Level Security Policies
--  Single-user deployment using hardcoded 'default_user'.
--
--  FUTURE (Fase 7.3 multi-user):
--    Replace `user_id = 'default_user'`
--    with    `user_id = auth.uid()::text`
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE holdings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE media         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym           ENABLE ROW LEVEL SECURITY;
ALTER TABLE history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;

-- ── Policy: allow all operations for 'default_user' ─────────
-- The anon key used by the frontend can only read/write rows
-- where user_id matches this value.

CREATE POLICY "allow_default_user" ON holdings
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');

CREATE POLICY "allow_default_user" ON closed_trades
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');

CREATE POLICY "allow_default_user" ON media
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');

CREATE POLICY "allow_default_user" ON gym
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');

CREATE POLICY "allow_default_user" ON history
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');

CREATE POLICY "allow_default_user" ON settings
  FOR ALL
  USING      (user_id = 'default_user')
  WITH CHECK (user_id = 'default_user');
```

Verify in **Authentication → Policies** that all 6 tables show a green "RLS enabled"
badge and one active policy each.

---

## 3. Configure `js/config.js`

Open `js/config.js` and fill in the values obtained in step 2.1:

```js
// js/config.js

export const STORAGE_MODE = 'supabase'; // Do not change unless testing GAS fallback

// ── Supabase ──────────────────────────────────────────────────────────────
export const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...YOUR_ANON_KEY...';

// ── GAS Proxy (Yahoo Finance) ─────────────────────────────────────────────
// The deployed URL of your Google Apps Script Web App.
// Obtain this from: GAS Editor → Deploy → Manage deployments → Web App URL
export const PROXY_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// ── Static FX fallback (update periodically) ─────────────────────────────
// Used when the FX API is unreachable. Values are relative to EUR base.
export const TRADE_FX = { EUR: 1, USD: 0.8696, CAD: 0.6369, GBP: 1.1574 };

// ── Empty database defaults ───────────────────────────────────────────────
export const FALLBACK = {
  holdings: [], cash: 0, totalInvested: 0,
  closedTrades: [], history: [], gym: [],
  books: [], movies: [], series: []
};
```

> ⚠️ **Do not commit real `SUPABASE_ANON_KEY` values to a public repository if the
> Supabase project is not protected by proper RLS.** With RLS in place (as established
> in step 2.3), the anon key is safe to expose — but exposing it to a project without
> RLS would allow anyone to read and write all data.

---

## 4. Google Apps Script Setup

The GAS Web App serves as a **Yahoo Finance proxy** — it fetches real-time stock
prices server-side, bypassing browser CORS restrictions.

### Deploy a new GAS Web App

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Paste your GAS code (the `doGet(e)` handler that handles `?action=quote`).
3. Click **Deploy → New deployment**.
4. Select type: **Web app**.
5. Set **Execute as:** `Me`.
6. Set **Who has access:** `Anyone` (required for the browser to call it without OAuth).
7. Click **Deploy** and copy the **Web App URL**.
8. Paste the URL into `PROXY_URL` in `js/config.js`.

> ⚠️ **Every time you edit the GAS code, you must create a new deployment version**
> (or redeploy to the existing deployment). The URL stays the same across redeployments
> if you use the same deployment entry.

### Expected GAS `doGet` API contract

| Query Parameter | Value | Response |
|-----------------|-------|----------|
| `?action=quote&ticker=AAPL` | Stock ticker | JSON with `{ regularMarketPrice, ... }` |

---

## 5. Local Preview

No build step required. Serve the project root as a static site:

```bash
# Option A: Node.js (recommended)
npx serve .

# Option B: Python 3
python -m http.server 8080

# Option C: VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Open `http://localhost:3000` (or whatever port `serve` reports).

> ⚠️ **Do not open `index.html` directly as a `file://` URL.** ES modules are blocked
> by browsers when loaded from the `file://` protocol due to CORS restrictions.
> Always use a local HTTP server.

**Expected first-run console output (Supabase configured correctly):**

```
[Supabase] Connected. 0 holdings, 0 trades loaded.   ← empty DB, no error
Sync status: ok
```

**Expected first-run console output (Supabase not yet configured):**

```
[Supabase] URL o ANON_KEY no configuradas. Cargando datos locales.
Sync status: local
```

---

## 6. Deployment (GitHub Pages)

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `Deploy from a branch`, select `main` (or `develop` if you
   prefer to publish from there), root `/`.
4. GitHub Pages will serve the site at `https://YOUR_USERNAME.github.io/REPO_NAME/`.

No CI/CD pipeline is required. Every push to the selected branch triggers an
automatic deployment.

> **PWA:** The app includes a Service Worker (`sw.js`) and a Web App Manifest
> (`manifest.json`). After the first visit over HTTPS, users can install the app
> as a PWA from their browser's install prompt.

---

## 7. First-Run Checklist

After completing the setup, verify the following in the browser console and UI:

- [ ] Page loads without JS errors in the console
- [ ] The login overlay is shown on first visit
- [ ] Logging in with the credentials created in step 2.4 succeeds
- [ ] Sync status indicator shows `✓` (green) after login — not `!` (error) or `○` (local)
- [ ] Opening the browser DevTools → Network tab shows successful requests to
      `*.supabase.co` (status 200)
- [ ] Adding a holding and saving triggers a `pushDataToCloud()` with no errors
- [ ] Refreshing the page restores the session and reloads the same data
      (Supabase persistence confirmed)
- [ ] Quote prices load for at least one ticker (GAS proxy working)
- [ ] Logging out via the header button returns to the login overlay

---

## 8. Resetting the Database

To wipe all data and start fresh, run in the Supabase SQL Editor:

```sql
-- ⚠️ DESTRUCTIVE — irreversible. Run in Supabase SQL Editor.
-- Replace <your-user-id> with the UUID from Authentication → Users.
DELETE FROM holdings      WHERE user_id = '<your-user-id>';
DELETE FROM closed_trades WHERE user_id = '<your-user-id>';
DELETE FROM media         WHERE user_id = '<your-user-id>';
DELETE FROM gym           WHERE user_id = '<your-user-id>';
DELETE FROM history       WHERE user_id = '<your-user-id>';
DELETE FROM settings      WHERE user_id = '<your-user-id>';
```

After running this, refresh the app. It will boot into a clean empty state
(all `FALLBACK` defaults), which is equivalent to a first-run experience.

To also clear the browser-side cache:

```js
// Run in browser DevTools console
localStorage.clear();
sessionStorage.clear();
```
