# Diccionario de Datos

Esquema completo del objeto `data.json` / `D` (objeto de estado en memoria).

---

## Estructura raíz

```json
{
  "holdings":      [],
  "cash":          0,
  "totalInvested": 0,
  "closedTrades":  [],
  "history":       [],
  "gym":           [],
  "books":         [],
  "movies":        [],
  "series":        []
}
```

---

## `holdings[]` — Posiciones activas

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ticker` | `string` | ✓ | Símbolo bursátil. Ej: `"AAPL"`, `"TOT.TO"`, `"MPE.L"` |
| `name` | `string` | ✓ | Nombre completo de la empresa |
| `shares` | `number` | ✓ | Número de acciones en cartera |
| `currency` | `"USD" \| "CAD" \| "GBP" \| "EUR"` | ✓ | Moneda de cotización |
| `exchange` | `string` | ✓ | Bolsa. Ej: `"NYSE"`, `"TSX"`, `"LSE"`, `"AIM"` |
| `entryPrice` | `number` | ✓ | Precio medio de entrada en `currency` |
| `color` | `string` | ✓ | Color HEX para gráficos. Ej: `"#5588ff"` |
| `dividends` | `number` | — | Total dividendos cobrados en `currency` (default: `0`) |

**Nota**: Los precios actuales se obtienen en tiempo real (Yahoo Finance via GAS) y se almacenan en `P[ticker]` en memoria, no en `D`.

---

## `cash` — Efectivo

| Tipo | Descripción |
|---|---|
| `number` | Cash disponible en cartera, denominado en **EUR** |

---

## `totalInvested` — Capital total invertido

| Tipo | Descripción |
|---|---|
| `number` | Suma acumulada de capital histórico desplegado, en **EUR** |

---

## `closedTrades[]` — Posiciones cerradas

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ticker` | `string` | ✓ | Símbolo bursátil |
| `name` | `string` | ✓ | Nombre de la empresa |
| `currency` | `"USD" \| "CAD" \| "GBP" \| "EUR"` | ✓ | Moneda de la operación |
| `color` | `string` | ✓ | Color HEX |
| `totalShares` | `number` | ✓ | Total de acciones compradas (puede diferir de las vendidas si fue parcial) |
| `avgBuy` | `number` | ✓ | Precio medio de compra en `currency` |
| `sellPrice` | `number` | ✓ | Precio de venta en `currency` |
| `dividends` | `number` | — | Total dividendos cobrados en `currency` (default: `0`) |
| `lots` | `string` | — | Descripción textual de los lotes. Ej: `"100@5.00 + 50@5.50"` |

**Cálculo P&L** (ejecutado por `calcTrade(t)` en `trades.js`):
```
grossPL  = totalShares × (sellPrice − avgBuy) × fxToEUR
divNet   = dividends × fxToEUR
invested = totalShares × avgBuy × fxToEUR
netPL    = grossPL + divNet
return%  = (netPL / invested) × 100
```

---

## `history[]` — Snapshots diarios del portfolio

Generado automáticamente cada vez que se carga la página en un día laborable (lunes–viernes) y hay precios disponibles.

| Campo | Tipo | Descripción |
|---|---|---|
| `date` | `string` | Fecha en formato `YYYY-MM-DD` (zona horaria Europe/Amsterdam) |
| `totalInvested` | `number` | Capital invertido en ese momento (EUR) |
| `totalValue` | `number` | Valor total del portfolio en ese momento (EUR) |

**Regla de unicidad**: un solo snapshot por fecha. Si ya existe, se actualiza el `totalValue`.

---

## `gym[]` — Registro de métricas físicas

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `date` | `string` | ✓ | Fecha `YYYY-MM-DD` |
| `weight` | `number \| null` | — | Peso en kg. `null` si no se registró |
| `bf` | `number \| null` | — | Porcentaje de grasa corporal. `null` si no se registró |

**Ordenación**: siempre por `date` ascendente.

---

## `books[]` — Biblioteca de libros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | `string` | ✓ | Título del libro |
| `author` | `string` | ✓ | Autor(es) |
| `year` | `string` | — | Año de publicación. Puede ser `"1965"` o `"401 B.C"` |
| `pages` | `number` | — | Número de páginas |
| `grRating` | `number` | — | Puntuación de Goodreads (0–5) |
| `myRating` | `number \| null` | — | Puntuación personal (0–5, pasos de 0.25). `null` = no leído |
| `opinion` | `string` | — | Opinión personal. `""` si no hay |

---

## `movies[]` — Filmoteca

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | `string` | ✓ | Título de la película |
| `director` | `string` | — | Director |
| `year` | `number` | — | Año de estreno |
| `duration` | `string` | — | Duración en formato `"2h 30 min"` |
| `platform` | `string` | — | Plataforma donde está disponible |
| `actors` | `string` | — | Actores principales (lista separada por comas) |
| `faRating` | `number \| null` | — | Puntuación FilmAffinity (0–10) |
| `myRating` | `number \| null` | — | Puntuación personal (0–10, pasos de 0.25). `null` = no vista |
| `opinion` | `string` | — | Opinión personal. `""` si no hay |

---

## `series[]` — Catálogo de series

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | `string` | ✓ | Título de la serie |
| `seasons` | `number` | — | Número de temporadas |
| `epsPerSeason` | `string` | — | Episodios por temporada. Puede ser `"10"` o `"10(1-3) o 20(4-6)"` |
| `epLength` | `string` | — | Duración de episodio en formato `"1h"` o `"45 min"` |
| `platform` | `string` | — | Plataforma de emisión |
| `years` | `string` | — | Años de emisión. Ej: `"2013-2019"` o `"2022-"` |
| `imdbRating` | `number \| null` | — | Puntuación IMDB (0–10) |
| `myRating` | `number \| null` | — | Puntuación personal (0–10, pasos de 0.25). `null` = no vista |
| `watched` | `string` | — | Estado de visionado: `"Entera"`, `"Al día"`, `"2 Temporadas"`, `""` |
| `wantFinish` | `"Sí" \| "No" \| "Volver a verla" \| ""` | — | Intención de finalizar |
| `opinion` | `string` | — | Opinión personal |

**Lógica de estado** (en `renderSeries()`):

| `watched` / `wantFinish` | Estado mostrado | Color |
|---|---|---|
| `"Entera"` o `"Finished"` | Finished | Verde |
| `"Al día"` o `"Up to date"` | Up to date | Azul |
| `wantFinish = "Volver a verla"` | Rewatch | Cyan |
| `wantFinish = "No"` | Dropped | Rojo |
| `wantFinish = "Sí"` | In progress / watched | Ámbar |
| `myRating = null` y sin `watched` | Watchlist | Gris |

---

## Objeto `P[ticker]` — Precios en memoria (runtime)

No persiste en `data.json`. Se calcula en `portfolio.js` → `refreshPortfolio()`.

| Campo | Tipo | Descripción |
|---|---|---|
| `ticker` | `string` | Símbolo |
| `price` | `number` | Precio actual en la moneda nativa |
| `prev` | `number` | Precio de cierre anterior (para calcular variación diaria) |
| `high` | `number` | Máximo intradiario |
| `low` | `number` | Mínimo intradiario |
| `ts` | `Date[]` | Timestamps de los puntos del gráfico intradiario |
| `cls` | `number[]` | Precios de cierre de cada punto intradiario |
| `_stale` | `boolean` | `true` si el precio es cacheado y puede estar desactualizado |

**Nota de divisas**: `GBp`/`GBX` se convierten de peniques a libras (`÷ 100`) al recibir los datos de Yahoo.

---

## Objeto `FX` — Tipos de cambio en memoria (runtime)

| Campo | Tipo | Descripción |
|---|---|---|
| `USD` | `number` | 1 USD en EUR |
| `CAD` | `number` | 1 CAD en EUR |
| `GBP` | `number` | 1 GBP en EUR |

Fuente primaria: `api.exchangerate-api.com`. Fallback: `open.er-api.com`. Fallback de emergencia: valores estáticos en `config.js` (`TRADE_FX`).
