# Performance Metrics — Methodology

This document explains how each metric in the Analytics tab is calculated.

---

## 1. Total Return (EUR)

```
Total Return = Portfolio Value - Total Invested
Portfolio Value = SUM(shares_i × price_i × FX_i) + cash
```

Where `FX_i` is the EUR conversion rate for the holding's currency.

- **Total Invested** is the `totalInvested` field stored in cloud/localStorage. It is updated manually by the user via the Cash modal.
- **Prices** are fetched live from Yahoo Finance via the GAS proxy; stale prices from localStorage cache are used when offline.

---

## 2. Return (%)

```
Return % = (Total Return / Total Invested) × 100
```

Individual position return:

```
Position Return = (current_price - entry_price) × shares × FX + dividends_EUR
Position Return % = Position Return / (entry_price × shares × FX) × 100
```

---

## 3. Dividend Yield

```
Dividend Yield % = Total Dividends EUR / Total Invested × 100
Total Dividends EUR = SUM(holding.dividends × FX_holding) + SUM(closedTrade.dividends × FX_trade)
```

`dividends` per holding is the **cumulative total** received, not annualised.

---

## 4. Monthly Returns Table

The table shows the **change in portfolio value** between the first and last snapshots of each calendar month.

```
Monthly Return = last_day_value - first_day_value (of that month from history[])
Monthly Return % = Monthly Return / first_day_value × 100
```

History snapshots are recorded automatically on each page load during weekdays (Europe/Amsterdam timezone).

---

## 5. Benchmark (Portfolio vs S&P 500 / SPY)

```
My Portfolio Cumulative Return % = (current_value - base_value) / base_value × 100
```

Where `base_value` is the portfolio value at the **first history entry**.

SPY data is fetched on demand via the GAS proxy from Yahoo Finance when the Analytics tab is opened. If the proxy is unavailable, the SPY line is omitted and no error is thrown.

```
SPY Cumulative Return % = (current_close - first_close) / first_close × 100
```

Both series start at 0% at their respective base dates.

---

## 6. Dividend Heatmap

The heatmap displays **12 rolling months** (most recent first).

- **Past months**: estimated dividend per month = `holding.dividends × FX / 12` (pro-rated assumption as Yahoo does not provide ex-dividend dates via this proxy).
- **Current and future months**: same pro-rated estimate, shown in blue (`est.`).
- Color intensity scales linearly from 0 to the maximum monthly value across all cells.

> To display real dividend calendar data, the GAS proxy would need to fetch Yahoo Finance's `/v8/finance/chart/{ticker}?events=dividends` endpoint and relay it as structured JSON.

---

## 7. Compound Interest Calculator

Simulates compound growth with monthly contributions:

```
FV = C × (1+r)^n + PMT × [((1+r)^n − 1) / r]
```

Where:
- `C` = initial capital
- `PMT` = monthly contribution
- `r` = annual rate / 12 / 100
- `n` = total months (years × 12)

Results are rounded to 2 decimal places. Tax and inflation are **not** modelled.

---

## 8. FX Rates

Rates are fetched from `exchangerate-api.com` (primary) → `open.er-api.com` (fallback) → hardcoded emergency fallback.

All values in the UI are expressed in **EUR** after conversion, unless otherwise noted.
