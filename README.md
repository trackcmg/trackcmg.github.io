# Track CMG — Personal Financial Dashboard

A fully serverless personal dashboard for tracking investment portfolios, closed
trades, dividends, gym workouts, and media (books, movies, series). Built with **Vanilla JS ES6 Modules**, **Supabase** (PostgreSQL + RLS), and **Google Apps Script**
as a CORS proxy for real-time Yahoo Finance stock prices.

Deployed as a static site on **GitHub Pages**. No build step. No npm. No framework.

---

## Features

| Category | Details |
|----------|---------|
| **Portfolio** | Holdings tracker with live prices (Yahoo Finance via GAS proxy), FX conversion, sector breakdown, dividend yield |
| **Closed Trades** | Realized P&L, average cost, dividend income per position |
| **Analytics** | Portfolio vs S&P 500 (SPY) benchmark, sector doughnut, currency exposure bar chart, dividend heatmap |
| **Compound Calculator** | Capital + monthly contributions + annual rate → projected value chart |
| **Gym Log** | Monthly workout calendar with set/rep tracking |
| **Media** | Read books, watched movies, viewed series — all in one place |
| **Dark Theme** | Cyberpunk palette; respects `prefers-color-scheme`; manual toggle |
| **PWA** | Installable; Service Worker with cache-first (assets) + network-first (API) |
| **Auth** | Supabase Auth (email + password) — full data gate, no render before login |
| **RLS** | Row-Level Security: `auth.uid()::text = user_id` enforced at DB level |
| **Offline** | Falls back to `localStorage` when Supabase is unreachable |
| **Lighthouse** | 100 / 100 across Performance, Accessibility, Best Practices, SEO |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS ES6 Modules · HTML5 · CSS3 (custom properties) |
| Charts | [Chart.js 4.4.1](https://www.chartjs.org/) (CDN) |
| Auth + DB | [Supabase](https://supabase.com) (PostgreSQL + PostgREST + Auth) |
| Stock Prices | Yahoo Finance via [Google Apps Script](https://script.google.com) proxy |
| Hosting | GitHub Pages (static, zero CI/CD required) |
| PWA | `manifest.json` + `sw.js` |

---

## Quick Start

Follow [docs/SETUP.md](docs/SETUP.md) for the full setup guide. The short version:

1. **Fork** this repository and enable GitHub Pages (`main` branch, root `/`).
2. Create a new **Supabase** project, run the schema SQL, enable RLS, and create a
   user in **Authentication → Users**.
3. Deploy a **Google Apps Script** Web App with a `doGet(e)` handler for
   `?action=quote&ticker=TICKER`.
4. Update **`js/config.js`** with your Supabase URL, anon key, and GAS proxy URL.
5. Push to `main` and visit your GitHub Pages URL.

> **Security note:** The `SUPABASE_ANON_KEY` is the public anon key — it is safe to
> commit when RLS is correctly enabled. Never use the `service_role` key in frontend
> code.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/SETUP.md](docs/SETUP.md) | Complete setup guide (Supabase SQL, RLS, GAS, GitHub Pages) |
| [docs/architecture.md](docs/architecture.md) | System architecture, data flow, auth model, DB schema |
| [docs/data-dictionary.md](docs/data-dictionary.md) | JSONB payload field reference for each table |
| [docs/performance-metrics.md](docs/performance-metrics.md) | ROI, dividend yield, benchmark calculation methodology |
| [docs/sw-cache-strategy.md](docs/sw-cache-strategy.md) | Service Worker cache strategy diagram |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Local Development

No build step required:

```bash
# Node.js (recommended)
npx serve .

# Python 3
python -m http.server 8080
```

Open `http://localhost:3000`. Do **not** open `index.html` as a `file://` URL —
ES modules are blocked by browsers under the `file://` protocol.

---

## Project Structure

```
logrero.github.io/
├── index.html          # Single-page app shell
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (cache-first / network-first)
├── css/
│   └── styles.css      # All styles — CSS custom properties, dark theme
├── js/
│   ├── app.js          # Entry point: auth gate, renderAll, tab routing
│   ├── config.js       # Constants: Supabase URL/key, GAS proxy URL, FX rates
│   ├── state.js        # Live mutable state (D, _authed)
│   ├── cloud.js        # Supabase CRUD + GAS proxy fetch
│   ├── storage.js      # localStorage hydration / serialisation
│   ├── portfolio.js    # Holdings, FX strip, price fetcher
│   ├── analytics.js    # Charts, SPY benchmark, dividend heatmap
│   ├── calculator.js   # Compound interest calculator
│   ├── trades.js       # Closed trades tab
│   ├── gym.js          # Gym log tab
│   ├── media.js        # Books / movies / series tabs
│   ├── modals.js       # CRUD form overlays
│   ├── auth.js         # Supabase Auth helpers
│   └── utils.js        # Formatters, toast notifications
├── icons/              # PWA icons + UI logo
├── docs/               # Architecture, setup, and reference documentation
└── data.json           # Static seed / reference data
```

---

## License

Personal project. Not intended for redistribution or commercial use.
