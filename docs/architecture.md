# Arquitectura del Sistema

## Visión General

Dashboard financiero personal estático desplegado en GitHub Pages. Todo el código sensible (precios de mercado, datos de usuario) se gestiona mediante Google Apps Script como backend proxy sin coste.

---

## Diagrama C4 — Contexto

```mermaid
C4Context
  title Dashboard Personal — Contexto del Sistema

  Person(user, "Usuario", "Accede al dashboard desde navegador o como PWA instalada")

  System(frontend, "Dashboard Frontend", "GitHub Pages — HTML/CSS/JS estático")

  System_Ext(gas, "Google Apps Script", "Backend proxy serverless. Autentica, almacena datos y consulta Yahoo Finance")

  System_Ext(yahoo, "Yahoo Finance API", "Precios de mercado en tiempo real")

  System_Ext(fxapi, "ExchangeRate-API / Open ER-API", "Tipos de cambio (EUR/USD/CAD/GBP)")

  Rel(user, frontend, "Abre en navegador")
  Rel(frontend, gas, "GET /POST — stocks, datos personales", "HTTPS/JSON")
  Rel(gas, yahoo, "GET precios", "HTTPS")
  Rel(frontend, fxapi, "GET divisas (fallback directo)", "HTTPS")
```

---

## Diagrama C4 — Contenedores

```mermaid
C4Container
  title Dashboard — Contenedores

  Person(user, "Usuario")

  Container(html, "index.html", "HTML5", "Estructura de la interfaz. Sin lógica inline.")
  Container(css, "css/styles.css", "CSS3", "Design system: variables, componentes, responsive")
  Container(app, "js/app.js", "ES Module", "Entry point. Inicialización, routing de tabs, listeners globales")
  Container(config, "js/config.js", "ES Module", "Constantes: GAS_URL placeholder, TRADE_FX")
  Container(state, "js/state.js", "ES Module", "Estado mutable compartido: D (datos), _authed")
  Container(storage, "js/storage.js", "ES Module", "localStorage: carga, guarda, migra datos")
  Container(cloud, "js/cloud.js", "ES Module", "Comunicación GAS: GET datos, POST sync")
  Container(portfolio, "js/portfolio.js", "ES Module", "Estado P/FX, fetch precios, renders portfolio")
  Container(modals, "js/modals.js", "ES Module", "Sistema de modales y formularios CRUD")
  Container(auth, "js/auth.js", "ES Module", "SHA-256, validación contraseña, eventos auth")

  Rel(user, html, "Carga")
  Rel(html, app, "type=module")
  Rel(app, config, "import")
  Rel(app, state, "import")
  Rel(app, storage, "import")
  Rel(app, cloud, "import")
  Rel(app, portfolio, "import")
  Rel(app, modals, "import")
  Rel(app, auth, "import")
  Rel(cloud, gas, "fetch HTTPS")
  Rel(portfolio, gas, "fetch via pFetch proxy")
```

---

## Flujo de Datos Principal

```mermaid
sequenceDiagram
  participant B as Browser (app.js)
  participant S as storage.js
  participant C as cloud.js
  participant G as Google Apps Script
  participant Y as Yahoo Finance

  B->>S: loadData() — carga localStorage
  S-->>B: D poblado con datos locales
  B->>B: renderPortfolio(), renderTrades(), etc.

  par Refresco de precios
    B->>G: pFetch(Yahoo URL) via GAS proxy
    G->>Y: GET /v8/finance/chart/{ticker}
    Y-->>G: JSON precios
    G-->>B: JSON precios parseados
    B->>B: actualiza P[ticker], renderPortfolio()
  end

  par Sync de datos
    B->>G: GET ?action=getData
    G-->>B: JSON {holdings, trades, gym, books, ...}
    B->>S: loadDataFromObj(j, merge=true)
    B->>S: saveLocal() — actualiza localStorage
  end
```

---

## Estrategia de Caché (Stale-While-Revalidate)

```mermaid
flowchart TD
  A[Usuario abre la app] --> B{¿Hay datos en localStorage?}
  B -->|Sí| C[Renderizar inmediatamente con datos locales]
  B -->|No| D[Mostrar skeleton loaders]
  C --> E[En paralelo: fetch datos frescos de GAS]
  D --> E
  E --> F{¿Respuesta exitosa?}
  F -->|Sí| G[Actualizar UI con datos frescos + guardar en localStorage]
  F -->|No| H[Mantener datos locales + mostrar indicador Offline]
  G --> I[Indicador: Synced ✓]
  H --> J[Indicador: Local / Offline ⚠]
```

---

## TTL de Caché por Tipo de Dato

| Origen | TTL | Condición de revalidación |
|---|---|---|
| Precios de stocks (Yahoo via GAS) | 60 s | Solo si tab visible + ≥ 60s desde último fetch |
| Tipos de cambio FX | 1 hora | Máx 1 vez/hora por sesión |
| Datos propios (GAS sync) | Sin expiración | Solo tras acción de escritura |
| Datos estáticos (books, series…) | Sin expiración | Solo si hay cambios pendientes |
