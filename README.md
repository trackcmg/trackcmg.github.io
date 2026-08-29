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
