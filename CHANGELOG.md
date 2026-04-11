# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
