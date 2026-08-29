# Architecture

> Rewritten 2026-08 to describe the system that actually ships. Earlier
> versions of this document described a Supabase/PostgreSQL backend that was
> never implemented.

## Overview

Track CMG is a static single-page app (GitHub Pages) whose entire persistent
state is **one JSON document** stored in the owner's Google Drive through a
Google Apps Script (GAS) web app. There is no database, no third-party BaaS,
and no server owned by the app.

```
┌────────────────────────────── Browser ──────────────────────────────┐
│ index.html + ES modules (no build)                                  │
│                                                                     │
│  state.js   D = { holdings, cash, totalInvested, closedTrades,      │
│                   history, gym, books, movies, series, watchlist }  │
│  storage.js localStorage 'db_data' mirror + FALLBACK guards         │
│  auth.js    Google Identity Services → id_token → GAS session token │
│  cloud.js   getData / saveData against the GAS web app              │
│  importer.js JSON import (validate → diff → backup → apply → sync)  │
│  insights.js JSON export                                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                ┌──────────────▼───────────────┐
                │  Google Apps Script Web App  │
                │  · verifies id_token, hashed │
                │    email allowlist (Script   │
                │    Properties), session token│
                │  · getData / saveData → ONE  │
                │    JSON file in Drive        │
                │  · ?url= CORS proxy → Yahoo  │
                │    Finance (quotes, charts)  │
                └──────────────────────────────┘
```

## Data flow

1. **Boot** (`app.js init`): `loadData()` hydrates `D` from
   `localStorage['db_data']`; the UI renders immediately with local data.
2. **Auth**: `initAuth` restores the GAS session token from
   `localStorage['track_session']` or renders the Google Sign-In button.
3. **Post-auth** (`_postAuthInit`): `fetchDataFromCloud()` **must complete
   before** `refreshPortfolio()` starts. This ordering (plus the guards below)
   prevents a cold start from pushing an empty state over good cloud data.
4. **Quotes**: `portfolio.js` fetches Yahoo Finance v8 chart data per holding
   through the GAS proxy every 60 s, converts GBX→GBP, computes EUR values with
   live FX (Yahoo v7 pairs → exchangerate-api → open.er-api → static fallback).
5. **Daily snapshot**: on business days, `refreshPortfolio` appends
   `{date, totalInvested, totalValue}` to `D.history` and syncs.
6. **Benchmark** (`analytics.js`): SPY and EURUSD=X daily series (5y) via the
   proxy; the S&P line is **money-weighted** — it simulates buying SPY with the
   same contributions on the same dates as `D.history`, converting EUR→USD at
   each day's rate. Both lines plot `(value − invested) / invested`, rebased to
   the selected period.

## Data-loss guards

Hard-won lessons, encoded in three layers:

- `state.js isFallbackState()` — detects a freshly initialised (empty) `D`.
- `storage.js saveLocal()` — refuses to overwrite a populated
  `localStorage['db_data']` with an empty `D`.
- `cloud.js _saveToGAS()` / `saveAndSync()` — refuse to push an empty `D` to
  Drive; `_loadFromGAS()` refuses to apply an empty cloud payload over
  non-empty local data.
- `importer.js` — refuses to import a file with no portfolio data over a
  populated state, and always writes a pre-import backup (download +
  `localStorage['db_data_preimport_backup']`).

## History provenance

`history` before 2026-03-26 was reconstructed offline from real broker
statements (IBKR activity statements, Trading212 CSV, Degiro account statement,
XTB cash-operations export) plus daily closes (Yahoo, unadjusted) and daily ECB
FX. Contributions match real deposits; internal broker-to-broker transfers are
netted out. From 2026-03-26 onwards the points are live snapshots taken by the
app itself.

## Schema

See [data-dictionary.md](data-dictionary.md). The document is intentionally
denormalised: one JSON blob, one owner, one writer at a time.
