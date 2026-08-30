# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.2.2] — 2026-08-30 — Limpieza de Analytics

### Removed
- Gráfico **Drawdown from Peak**: aportaba poco con datos mensuales y ocupaba
  media fila. La métrica **Max Drawdown** sigue en Risk & Performance; el
  heatmap de retornos mensuales pasa a ancho completo.

### Changed
- `sw.js` → `CACHE_VERSION v16`.

---

## [2.2.1] — 2026-08-30 — Multi-benchmark + móvil

### Added
- Benchmark multi-índice: Nasdaq 100 (QQQ), IBEX 35, MSCI EM (EEM), Gold (GLD)
  y Bitcoin (BTC-USD), todos money-weighted con las mismas aportaciones.
  Aparecen desactivados (tachados) en la leyenda y se activan al tocarlos;
  los toggles sobreviven al cambio de período. Se cargan en segundo plano
  tras SPY, con la misma caché de 20h.

### Changed
- Móvil (≤600px): los botones de export/import (⤓/⤒) se ocultan del header —
  el botón Edit ya no se sale. La tabla de trades conserva TODAS las columnas
  (scroll horizontal, como siempre).
- Hero: eliminado el chip de P&L del último mes.
- `sw.js` → `CACHE_VERSION v13`.

---

## [2.2.0] — 2026-08-29 — Import + histórico real desde 2025 + benchmark honesto

### Added
- **`js/importer.js`** — import de backups JSON (botón `⤒` junto al export):
  validación de esquema con errores legibles, resumen de diferencias
  actual → importado, checkbox de confirmación, **backup automático** del
  estado previo (descarga + copia en `localStorage['db_data_preimport_backup']`),
  opción de fusionar histórico, y bloqueo de imports vacíos sobre datos buenos.
- **Histórico reconstruido desde 2025-01-02** a partir de los informes reales
  de IBKR, Trading212, Degiro y XTB (aportaciones reales por fecha, precios
  diarios sin ajustar y FX BCE). Se importa vía el nuevo botón; los puntos
  desde 2026-03-26 siguen siendo los snapshots en vivo de la app.
- `buyDate`/`sellDate` reales en todas las posiciones y trades cerrados,
  trade de Inmocemento (IMC) que faltaba, y dividendos TOT/MPE corregidos
  con los statements.
- Hero: chip de P&L de mercado del último mes (Δvalor − Δaportado).

### Changed
- **Benchmark S&P 500 money-weighted**: la línea SPY ahora simula comprar SPY
  con las mismas aportaciones en las mismas fechas (EUR→USD al tipo del día),
  en vez de comprar todo el día 1. Misma métrica en ambas líneas:
  `(valor − invertido) / invertido`, rebasada por período. Se eliminó la zona
  interpolada sintética previa al primer dato (ya hay datos reales).
- Gráfica "Invested vs Portfolio Value": la línea Invested ya no está oculta
  por defecto (ahora discontinua), y el muestreo pasa a semanal para series
  largas (antes buckets de 30 días).
- `sw.js` → `CACHE_VERSION v11` (+ `importer.js` en precache).

### Fixed / Removed
- **README y docs honestos**: descripciones de un backend Supabase/PostgreSQL
  que nunca existió, sustituidas por la arquitectura real (Google Sign-In +
  Apps Script + JSON en Drive). `STORAGE_UPGRADE.md` (propuesta nunca
  ejecutada) y `data.json` (volcado viejo que ningún código leía) eliminados.

---

## [2.1.0] — 2026-06-10 — Insights Pack (nuevas secciones + UI/UX)

### Added
- **`js/insights.js`** — nuevo módulo de métricas derivadas (solo lectura sobre `D`):
  - **Risk & Performance** (Analytics): CAGR anualizado, max drawdown,
    volatilidad anualizada, mejor/peor mes, win rate y profit factor de
    trades cerrados. Se rellenan progresivamente según crece el historial.
  - **Monthly Returns Heatmap** (Analytics): grid año × mes con intensidad
    verde/roja, en CSS puro (sin canvas — inmune al bug de canvas oculto).
    Misma convención de retorno que la tabla "Monthly Returns".
  - **Drawdown from Peak** (Analytics): underwater chart del índice compuesto
    de retornos mensuales; mensaje en canvas si aún no hay 2 meses de datos.
  - **Road to €1M** (Analytics): barra de progreso al siguiente hito
    (125k → 1M) con ETA por hito al ritmo actual de crecimiento del valor.
    Fallback al último snapshot del historial si los precios no han cargado.
  - **Gym stat cards**: peso actual, Δ 30 días, Δ total, % grasa, Δ grasa
    y masa magra estimada.
  - **Taste Profile** (Books/Movies/Series): histograma CSS de notas,
    top autores/directores/plataformas con media, décadas favoritas y
    sesgo vs Goodreads.
  - **Backup**: botón `⤓` en el header (visible con sesión) que descarga
    todos los datos como JSON (`trackcmg-backup-YYYY-MM-DD.json`).
- **Social/SEO meta**: Open Graph + Twitter Card, `color-scheme`, descripción más rica.
- **A11y**: skip link, `:focus-visible` en botones/tabs/inputs, `aria-label`
  en Refresh y tab bar, `prefers-reduced-motion`, fallback `<noscript>`.
- **Estilos de impresión**: modo informe limpio.
- `manifest.json`: campo `categories`.
- `tabular-nums` en todos los elementos numéricos.

### Changed
- **Header sticky** con glassmorphism (`position:sticky; top:10px`).
- **Hero glow**: orbe radial con deriva lenta.
- Micro-interacciones: `:active` press en botones, lift en `.card`,
  borde de acento en filas de tabla al hover, toast con slide-in.
- Empty state del watchlist con copy más útil (clase `.empty-state`).
- README: badges, tagline y sección "Why it exists".
- `sw.js`: `CACHE_VERSION` v8 → v10; precache de `insights.js` y
  `watchlist.js` (este último faltaba en la lista).

### Fixed
- `</div>` huérfano tras el login overlay en `index.html`.
- Título "Track CMG" del header ilegible en tema claro (gradiente blanco
  sobre fondo claro).

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
