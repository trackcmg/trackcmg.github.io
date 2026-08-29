# Setup

> Rewritten 2026-08. Earlier versions described a Supabase setup that was never
> implemented — the real backend is Google Apps Script + Drive.

## 1. Fork & host

1. Fork the repository, enable GitHub Pages (`main` branch, root `/`).
2. The site is a static SPA — no build, no CI needed.

## 2. Google OAuth client (Sign-In)

1. GCP Console → *APIs & Services → Credentials* → **OAuth 2.0 Client ID**
   (Web application).
2. Add your Pages origin (and `http://localhost:8080` for dev) to *Authorized
   JavaScript origins*.
3. Put the client id in `js/config.js` → `GOOGLE_CLIENT_ID`.

## 3. Apps Script backend

Create a Google Apps Script project and deploy it as a **Web App** (execute as
you, accessible to anyone with the link). It must implement:

- `doGet` with `action=getData` / `action=validate` (session token) and a
  `?url=` passthrough that proxies Yahoo Finance requests (CORS).
- `doPost` with `{session_token, data}` → writes the JSON document to Drive.
- Google id_token verification + an allowlist of **hashed** emails stored in
  *Script Properties* — never in the repo.
- Session tokens per device with expiry.

The full auth design is documented in [gas-auth-v2.md](gas-auth-v2.md) and
[auth-flow.md](auth-flow.md).

Put the deployment URL in `js/config.js` → `PROXY_URL` (one URL serves both
storage and quote-proxy roles).

## 4. First run

1. Serve locally (`python -m http.server 8080`) or open the Pages URL.
2. Sign in with an allowlisted Google account.
3. Add holdings, or restore a backup with the **import** button (header, next
   to export) — it validates the JSON, shows a diff and backs up the current
   state before applying.

## 5. Shipping changes

Bump `CACHE_VERSION` in `sw.js` with every JS/CSS change — the Service Worker
is cache-first for static assets and will otherwise keep serving the previous
bundle to installed clients.
