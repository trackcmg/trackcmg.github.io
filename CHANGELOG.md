# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0] — 2026-04-XX — Fase 7.3 + Lighthouse Sprint

### Added
- **Supabase Auth gate** (`supabase.auth.signInWithPassword`): the app no longer
  renders any data until a valid Supabase session is established.
  - `supabase.auth.onAuthStateChange` drives `_handleLogin` / `_handleLogout`
  - `btnLogout` header button → `supabase.auth.signOut()`
  - Login overlay shown on `SIGNED_OUT`; hidden on `SIGNED_IN`

### Changed
- **RLS policies** updated from `user_id = 'default_user'` to
  `user_id = auth.uid()::text` on all 6 tables (`holdings`, `closed_trades`,
  `media`, `gym`, `history`, `settings`).
- **SPY benchmark** anchored to `viewStart` (`_nearestSpy(viewStart)`) instead of
  hardcoded `2024-01-01` — benchmark % is now relative to the selected time window.
- **Portfolio base** for benchmark uses `totalValue` at `viewStart`, not
  `totalInvested`.
- `renderAll()` fragmented: `renderPortfolio()` runs synchronously; 7 remaining
  modules deferred with `setTimeout(fn, 0)` to break long tasks (TBT reduction).
- **Google Fonts** loaded asynchronously (preload + `media="print"` + `onload`
  pattern) — eliminates render-blocking font CSS.
- Scripts moved to end of `<body>` with `defer`.
- `main` element: `min-height:100vh; contain:content`.
- `.ch-s` / `.ch-l`: `contain:layout style` (CLS → 0).
- `.cg`, `.hero`, `.sg`: explicit `min-height` values to pre-allocate layout space.
- CSS custom properties `--ff-sans` / `--ff-mono` with system-font fallback stacks.
- `--text-dim` / `--text-muted` raised to `#a0a0b8` (WCAG AA contrast).
- Login card: `min-height:520px` to prevent CLS during auth state transitions.
- **Lighthouse 100/100 achieved** across Performance, Accessibility, Best Practices,
  and SEO (mobile and desktop).
- Logo replaced: `icon-192/512.png` → `icons/logo-ui.webp` in `<img>` header
  (manifest icons unchanged).
- Added `preconnect` hints for Supabase CDN and Cloudflare CDNs.
- `<main role="main">` landmark added.
- All content headings standardised to `<h2>` (removed `<h3>` in main sections).
- `<meta name="description">` added for SEO.
- `lang="es"` on `<html>`.

### Removed
- **Migration Bridge**: `_showMigrationModal()`, `_sha256hex()`, triple-click
  listener, and `Ctrl+Shift+M` handler removed from `app.js` after successful
  GAS → Supabase migration.
- `migrateFromGAS()` export removed from `cloud.js`.
- `claimLegacyData()` removed — no legacy fallback for `default_user`.
- `btnAuth` → replaced with `btnLogout` throughout HTML and all JS modules.
- Legacy `restoreSession()` / `sessionStorage` token flow removed from `app.js`.

---

## [1.0.0] — 2026-04-11 — Fase 5: Analítica Pro y Refinamiento Final

### Added
- **Pestaña Analytics**: nueva vista con 4 secciones:
  - Tarjetas de resumen: Total Return, Dividend Yield, Positions, Closed Trades
  - Gráfico de distribución sectorial (Doughnut) — soporta propiedad `sector` por holding
  - Gráfico de exposición por divisa en EUR (Bar)
  - Benchmark: Portfolio vs S&P 500/SPY (retorno acumulado % — requiere proxy GAS activo)
- **Heatmap de dividendos**: cuadrícula 12 meses con dividendos reales (meses pasados) y proyectados (meses futuros), intensidad de color Cyberpunk (verde=cobrado, azul=estimado)
- **Calculadora de interés compuesto** (`js/calculator.js`): capital inicial + aportación mensual + tasa anual + años → valor final, ganancias, gráfico proyectado
- **Sistema de temas Claro/Oscuro**:
  - Responde automáticamente a `prefers-color-scheme`
  - Toggle manual (`☽/☀`) en el header guarda preferencia en `localStorage`
  - Override forzado con clases `html.theme-light` / `html.theme-dark`
- `docs/performance-metrics.md`: metodología de cálculo de ROI, dividend yield, retorno mensual y benchmark
- `js/analytics.js`: módulo nuevo con `renderAnalytics`, `renderBenchmark`, `renderDividendHeatmap`
- `js/calculator.js`: módulo nuevo con `renderCalculator` y `runCalc`

### Changed
- `index.html`: Chart.js cargado con `defer` (elimina render-blocking — mejora LCP)
- `index.html`: botón toggle de tema añadido en header; nueva tab "Analytics"
- `css/styles.css`: `.ch-s` y `.ch-l` con `contain:layout` para eliminar CLS (layout shift → 0)
- `css/styles.css`: variables tema light en `@media prefers-color-scheme:light` y `html.theme-light`
- `css/styles.css`: estilos `.div-heatmap`, `.calc-wrap`, `.calc-result` para las nuevas vistas
- `js/app.js`: importa y conecta `analytics.js` y `calculator.js`; benchmark carga lazy al entrar en la tab

---

## [Unreleased]

## [1.3.0-alpha] — 2026-04-11 — Fase 3: PWA y Experiencia de Usuario

### Added
- `manifest.json`: Web App Manifest — nombre, colores, orientación, iconos (placeholders)
- `sw.js`: Service Worker con Cache-First (assets) + Network-First (GAS API) y precarga del App Shell
- `docs/sw-cache-strategy.md`: diagrama de estrategia de caché del SW
- PWA meta tags en `index.html`: `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`
- Registro del Service Worker en `index.html` (evento `load`, silencioso en error)
- **Skeleton Loaders**: animación shimmer en tarjetas de portfolio y FX strip mientras la API responde
- `css/styles.css`: clases `.skeleton`, `.stock-skeleton`, `.fx-skeleton`, `@keyframes shimmer`

### Changed
- `js/portfolio.js`: `rSkeletons()` se activa cuando no hay precios en caché; `rFx()` muestra skeleton en lugar de `--` durante la carga

### Removed
- `index.html`: bloque `<!-- LEGACY_SCRIPT -->` (~770 líneas) con PW_HASH y SYNC_URL en texto plano purgado del código fuente

---

## [1.2.0-alpha] — 2026-04-11 — Fase 2: Seguridad y Resiliencia

### Added
- `js/auth.js`: flujo de autenticación con token GAS v2 + fallback SHA-256 local sin regresión
- `js/auth.js`: `restoreSession()` — restaura sesión automáticamente desde `sessionStorage` (evita re-login en recargas)
- `js/state.js`: `_token` + `setToken()` para gestión del token de sesión
- `docs/gas-auth-v2.md`: guía completa para activar el endpoint `/auth` en Google Apps Script

### Changed
- `js/cloud.js`: incluye token de sesión (`&token=...`) en peticiones GET y POST a GAS
- `js/app.js`: extraído `_applyAuthUI()` como helper reutilizable; `init()` restaura sesión al arrancar; listeners `online`/`offline` con toast informativo
- `index.html`: eliminado bloque `<style>` duplicado (CSS centralizado en `css/styles.css`)

---

## [1.1.0-alpha] — 2026-04-11 — Fase 1: Arquitectura Modular

### Added
- Arquitectura ES Modules: `css/styles.css` + 10 módulos JS (`config`, `state`, `utils`, `storage`, `cloud`, `portfolio`, `trades`, `gym`, `media`, `modals`, `auth`, `app`)
- Paginación mensual via `data-monthly-action` (sin onclick en HTML generado)
- Sistema de autenticación por CustomEvents (sin dependencias circulares)

### Changed
- `index.html`: eliminados todos los manejadores inline; `<script type="module" src="js/app.js">`
- Monolito JS (~700 líneas) trasladado a comentario HTML `<!-- LEGACY_SCRIPT -->`

---

## [1.0.0-alpha] — 2026-04-11 — Fase 0: Gobernanza

### Added
- `.gitignore`: excluye `AGENTS.md`, `TASKS.md`, `node_modules/`, `.env`
- `CHANGELOG.md`: registro de versiones siguiendo Keep a Changelog
- `docs/architecture.md`: diagrama C4 del sistema (GitHub Pages ↔ GAS ↔ Yahoo Finance)
- `docs/data-dictionary.md`: diccionario de datos completo de `data.json`
- `docs/auth-flow.md`: diagramas de secuencia del flujo de autenticación (actual vs objetivo)

---

## [0.9.0] — pre-refactorización — Monolito inicial

### Estado
- `index.html` monolítico (~1.100 líneas): HTML + CSS inline + JS inline
- Google Apps Script como proxy (Yahoo Finance) y almacenamiento de datos
- Autenticación SHA-256 comparada en el frontend
- Sin PWA, sin Service Worker, sin módulos JS
