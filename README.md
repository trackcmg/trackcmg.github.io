# Track CMG — Personal Financial Dashboard

![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES6_Modules-f7df1e?logo=javascript&logoColor=black)
![Google Apps Script](https://img.shields.io/badge/Backend-Google_Apps_Script_%2B_Drive-4285f4?logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)
![No build step](https://img.shields.io/badge/build-none-success)

> One private dashboard for everything you compound: money, muscle and media.

A serverless personal dashboard for tracking an investment portfolio, closed
trades, dividends, gym workouts and media (books, movies, series). Built with
**Vanilla JS ES6 Modules**, **Google Sign-In**, and a **Google Apps Script**
web app that persists a single JSON document in Drive and proxies Yahoo
Finance for live quotes.

Deployed as a static site on **GitHub Pages**. No build step. No npm. No framework.

## Why it exists

Portfolio trackers want your broker credentials. Habit apps want a subscription.
Track CMG wants neither: a single static page you own end-to-end, where live
quotes, realized P&L, a money-weighted S&P 500 benchmark, your gym progress and
the books you read this year all live behind one Google sign-in — and keep
working offline.

---

## Features

JPY is supported in portfolio positions, closed trades and the watchlist.
Live FX converts yen to EUR; cached rates are retained when services fail,
with an approximate emergency fallback of EUR 0.006 per JPY.

The **Games** tab tracks platform, developer, release year, year played,
Metacritic (0–100), personal rating (0–10), hours, status and notes. All fields
except title are optional. Ratings are entered manually. Games are included
in cloud saves and JSON backups; older backups without `games` preserve the
current games list. An explicit `games: []` clears it on confirmed import.

Browser regression checks: install Playwright and an Edge browser, then run
`node tests/games-jpy.cjs`. The test uses synthetic data and blocks external
requests, including cloud writes.

### Visual media library

Books, films, series and games have lazy-loaded cover cards and a read-only
detail sheet (full original opinion and metadata). Taste Profile remains
available in a collapsible panel. Both languages, both themes and mobile
two-column shelves are supported.

Free public sources: [Open Library Search/Covers](https://openlibrary.org/developers/api),
[Wikipedia PageImages](https://www.mediawiki.org/wiki/Extension:PageImages#API),
and [TVmaze](https://www.tvmaze.com/api) (attributed CC BY-SA). No account or
API key is required. Cover copyright remains with the respective owners;
each detail sheet links to the source record. Only title/author/release-year
queries go to providers, never ratings, opinions, financial data or tokens.

Requests are serialized per provider (Open Library: 1.1s; Wikipedia: 300ms;
TVmaze: 500ms), timed out after 9s, and only run for the open shelf. Matching checks title,
year and book author; ambiguous results stay blank. Local metadata cache:
500 entries maximum, successful matches 30 days, no-match results 1 day.
Provider outages do not block rendering or Drive synchronization. A failed
provider does not prevent fallback searches. Metadata for the rest of the open
shelf is warmed in the background; this pauses when hidden or with data saver.
Images have a separate, bounded 240-thumbnail service-worker cache which
survives deployments. Only successful CORS image responses are saved (opaque
responses are deliberately excluded because of their inflated storage cost).

In **Edit**, search/select another cover, choose **Automatic** to retry or
**No cover** to disable lookup. Save commits the choice; Cancel changes
nothing. Optional per-item `artwork` metadata (`provider`, `url`, `sourceUrl`,
`title`, `year`, optional `alias`/`creator`) is preserved in cloud JSON and
validated on import. `artwork: false` disables it; an absent field enables
automatic lookup. Old JSON files require no migration. Once an automatic image
actually loads, its metadata is saved locally and in the private Drive JSON
(`automatic: true`, `lookupKey`). Cloud writes are batched, deferred while editing
or syncing, and require the authenticated cloud load to have finished. Original
opinions, ratings, financial data and manual cover choices are not changed.

Offline model checks: `node tests/artwork.cjs`, `node tests/artwork-cache.cjs`,
`node tests/artwork-store.cjs`. Optional read-only API smoke
test: `node tests/artwork-network.cjs`. Start `node tests/library-preview.cjs`
for browser QA at `http://127.0.0.1:51571/` with synthetic data and a cloud
double; it cannot write to Drive. Browser interactions are performed with
the development environment's supported browser tools.

| Category | Details |
|----------|---------|
| **Portfolio** | Holdings with live prices (Yahoo Finance via GAS proxy), FX conversion, 52-week range, P/E & yield tags, per-holding detail accordion |
| **History** | Daily snapshots of invested vs portfolio value since January 2025 (back-filled from real broker statements: IBKR, Trading212, Degiro, XTB) |
| **Closed Trades** | Realized P&L with buy/sell dates, average cost, dividends per position |
| **Analytics** | Portfolio vs S&P 500 **money-weighted** benchmark (SPY bought with the same contributions on the same dates, EUR→USD at the daily rate), sector doughnut, currency exposure, risk metrics (CAGR, volatility, max drawdown, win rate, profit factor), monthly returns heatmap, underwater drawdown chart, Road to €1M |
| **Backup** | One-click JSON **export** — and JSON **import** with schema validation, a diff preview and an automatic pre-import backup |
| **Compound Calculator** | Capital + monthly contributions + annual rate → projected value chart |
| **Gym Log** | Weight & body-fat tracking with progress stats (30-day delta, lean mass) |
| **Media** | Books, movies and series with a Taste Profile: rating histograms, top authors/directors/platforms, favourite decades |
| **Theme** | Cyberpunk dark palette + light mode; manual toggle |
| **PWA** | Installable; Service Worker with cache-first (assets) + network-first (API) |
| **Auth** | Google Sign-In (Google Identity Services) + server-side allowlist and session tokens in the GAS backend |
| **Offline** | `localStorage` mirror of the cloud document; guards against overwriting good data with an empty state |

---

## Architecture (the real one)

```
Browser (static SPA, GitHub Pages)
  ├─ Google Sign-In → id_token
  ├─ localStorage: db_data (mirror), track_session (session token)
  └─ fetch → Google Apps Script Web App
       ├─ validates token + email allowlist (hashed, in Script Properties)
       ├─ getData / saveData → ONE JSON document in Drive
       └─ ?url= → CORS proxy for Yahoo Finance quotes
```

There is **no database and no third-party backend**: the entire state is one
JSON document in the owner's Drive, mirrored to `localStorage` for offline use.
Details in [docs/architecture.md](docs/architecture.md) and
[docs/gas-auth-v2.md](docs/gas-auth-v2.md).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/SETUP.md](docs/SETUP.md) | Setup guide (GCP OAuth client, Apps Script, GitHub Pages) |
| [docs/architecture.md](docs/architecture.md) | System architecture, data flow, auth model, data schema |
| [docs/auth-flow.md](docs/auth-flow.md) | Sign-in flow |
| [docs/gas-auth-v2.md](docs/gas-auth-v2.md) | GAS session-token auth design |
| [docs/data-dictionary.md](docs/data-dictionary.md) | Field reference for the JSON document |
| [docs/performance-metrics.md](docs/performance-metrics.md) | ROI, dividend yield, benchmark methodology |
| [docs/sw-cache-strategy.md](docs/sw-cache-strategy.md) | Service Worker cache strategy |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Local Development

No build step required:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Do **not** open `index.html` as a `file://` URL —
ES modules are blocked under the `file://` protocol. Bump `CACHE_VERSION` in
`sw.js` whenever you ship JS/CSS changes, or the Service Worker will keep
serving the old bundle.

---

## Project Structure

```
trackcmg.github.io/
├── index.html          # Single-page app shell
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (cache-first / network-first)
├── css/styles.css      # All styles — CSS custom properties, dark + light theme
├── js/
│   ├── app.js          # Entry point: auth gate, renderAll, tab routing
│   ├── config.js       # Constants: Google client id, GAS URL, FX fallbacks
│   ├── state.js        # Live mutable state (D, _authed) + fallback guard
│   ├── cloud.js        # GAS load/save with empty-payload guards
│   ├── storage.js      # localStorage hydration / serialisation / history merge
│   ├── importer.js     # JSON import: validation, diff preview, backup, apply
│   ├── portfolio.js    # Holdings, prices, history chart, monthly table
│   ├── analytics.js    # Sector/currency charts + money-weighted SPY benchmark
│   ├── insights.js     # Risk grid, heatmap, drawdown, milestones, export
│   ├── calculator.js   # Compound interest calculator
│   ├── trades.js       # Closed trades tab
│   ├── gym.js          # Gym log tab
│   ├── media.js        # Books / movies / series tabs
│   ├── watchlist.js    # Watchlist tab
│   ├── modals.js       # CRUD form overlays
│   ├── auth.js         # Google Sign-In + GAS session helpers
│   └── utils.js        # Formatters, toasts, chart plugins
├── icons/              # PWA icons + UI logo
└── docs/               # Architecture, setup, and reference documentation
```

---

## License

Personal project. Not intended for redistribution or commercial use.
