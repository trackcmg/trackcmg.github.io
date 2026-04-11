# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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
