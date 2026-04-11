// ============================================================
//  analytics.js — Pestaña Analytics: sectores, divisa,
//  benchmark SPY, heatmap de dividendos.
// ============================================================
import { D } from './state.js';
import { F, ttOpts, legOpts } from './utils.js';
import { fxR, valEur, fetchStock } from './portfolio.js';
import { PROXY_URL } from './config.js';

// Caché de charts para destruir antes de re-render
const CH = {};

// ── Sectores por defecto (enriquecibles por el usuario) ──────
// El usuario puede añadir una propiedad `sector` a cada holding
// via el modal de edición. Si no existe, se agrupa como "Other".
const SECTOR_COLORS = {
  Technology: '#5588ff', Financials: '#22df8a', Healthcare: '#aa66ff',
  Energy: '#ffaa22', Consumer: '#ff6688', Industrials: '#22dddd',
  Materials: '#ff8844', Utilities: '#88bbff', 'Real Estate': '#ffdd44',
  Other: '#667788'
};

// ── Render principal de la pestaña Analytics ─────────────────
export function renderAnalytics() {
  _renderSummaryCards();
  _renderSectorChart();
  _renderCurrencyChart();
}

// ── Tarjetas de resumen ──────────────────────────────────────
function _renderSummaryCards() {
  const el = document.getElementById('analyticsSummary');
  if (!el) return;

  const totalVal = D.cash + D.holdings.reduce((s, h) => s + valEur(h), 0);
  const totalInv = D.totalInvested;

  // PnL Latente: valor actual posiciones abiertas vs lo invertido en ellas
  const openInvestedEur = D.holdings.reduce((s, h) => s + h.entryPrice * h.shares * fxR(h.currency), 0);
  const latentPnl   = D.holdings.reduce((s, h) => s + valEur(h), 0) - openInvestedEur;

  // PnL Realizado: suma de realizedPnl de closedTrades (o gross si no existe)
  const realizedPnl = D.closedTrades.reduce((s, t) => {
    const fx = fxR(t.currency);
    if (t.realizedPnl != null) return s + t.realizedPnl * fx;
    return s + (t.sellPrice - t.avgBuy) * t.totalShares * fx;
  }, 0);

  const totalReturn = latentPnl + realizedPnl;
  const totalReturnPct = totalInv > 0 ? (totalReturn / totalInv) * 100 : 0;

  // Dividendos totales cobrados (en EUR)
  const totalDivEur = D.holdings.reduce((s, h) => s + (h.dividends || 0) * fxR(h.currency), 0)
    + D.closedTrades.reduce((s, t) => s + (t.dividends || 0) * fxR(t.currency), 0);

  const yieldPct = totalInv > 0 ? (totalDivEur / totalInv) * 100 : 0;

  el.innerHTML = [
    { lbl: 'Total Return (Real.+Lat.)', val: (totalReturn >= 0 ? '+' : '') + F(totalReturn) + ' €', cls: totalReturn >= 0 ? 'up' : 'dn' },
    { lbl: 'Return %', val: (totalReturnPct >= 0 ? '+' : '') + F(totalReturnPct) + '%', cls: totalReturnPct >= 0 ? 'up' : 'dn' },
    { lbl: 'Realized P&L', val: (realizedPnl >= 0 ? '+' : '') + F(realizedPnl) + ' €', cls: realizedPnl >= 0 ? 'up' : 'dn' },
    { lbl: 'Unrealized P&L', val: (latentPnl >= 0 ? '+' : '') + F(latentPnl) + ' €', cls: latentPnl >= 0 ? 'up' : 'dn' },
    { lbl: 'Dividends (EUR)', val: F(totalDivEur) + ' €', cls: totalDivEur > 0 ? 'up' : '' },
    { lbl: 'Dividend Yield', val: F(yieldPct) + '%', cls: '' },
    { lbl: 'Positions', val: D.holdings.length, cls: '' },
    { lbl: 'Closed Trades', val: D.closedTrades.length, cls: '' }
  ].map(c => `<div class="sum-card">
    <div class="sum-lbl">${c.lbl}</div>
    <div class="sum-val ${c.cls}" style="font-size:16px">${c.val}</div>
  </div>`).join('');
}

// ── Gráfico de sectores ──────────────────────────────────────
function _renderSectorChart() {
  const canvas = document.getElementById('cSector');
  if (!canvas) return;

  const sectors = {};
  D.holdings.forEach(h => {
    const s = h.sector || 'Other';
    sectors[s] = (sectors[s] || 0) + valEur(h);
  });

  if (!Object.keys(sectors).length) { canvas.getContext('2d'); return; }

  const labels = Object.keys(sectors);
  const data = Object.values(sectors);
  const colors = labels.map(l => SECTOR_COLORS[l] || SECTOR_COLORS.Other);
  const total = data.reduce((a, b) => a + b, 0);

  if (CH.sector) CH.sector.destroy();
  CH.sector = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: 'var(--bg-card)', borderWidth: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: legOpts },
        tooltip: {
          ...ttOpts,
          callbacks: { label: c => ` ${c.label}: ${F(c.parsed)} € (${total > 0 ? F(c.parsed / total * 100, 1) : 0}%)` }
        }
      }
    }
  });
}

// ── Gráfico de exposición por divisa ─────────────────────────
function _renderCurrencyChart() {
  const canvas = document.getElementById('cCurrency');
  if (!canvas) return;

  const cur = { EUR: D.cash };
  D.holdings.forEach(h => { cur[h.currency] = (cur[h.currency] || 0) + valEur(h); });

  const labels = Object.keys(cur);
  const data = Object.values(cur);
  const bgColors = { EUR: '#22df8a', USD: '#5588ff', CAD: '#ffaa22', GBP: '#aa66ff' };
  const colors = labels.map(l => bgColors[l] || '#667788');

  if (CH.currency) CH.currency.destroy();
  CH.currency = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors, borderWidth: 1.5, borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${F(c.parsed.y)} €` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 12, weight: '600' } } },
        y: { grid: { color: 'rgba(26,26,53,.5)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' €' } }
      }
    }
  });
}

// ── Benchmark: Portfolio vs SPY ────────────────────────────────
// Caché global de precios SPY para no re-fetchear al cambiar periodo
let _spyMap = null;

function _nearestSpy(dateStr) {
  if (!_spyMap) return null;
  if (_spyMap[dateStr]) return _spyMap[dateStr];
  const base = new Date(dateStr);
  for (let offset = 1; offset <= 5; offset++) {
    for (const sign of [-1, 1]) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + sign * offset);
      const k = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      if (_spyMap[k]) return _spyMap[k];
    }
  }
  return null;
}

export async function renderBenchmark() {
  // Cargar precios SPY una sola vez; si ya existe la caché, redibujar directamente
  if (!_spyMap) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=1704067200&interval=1d`;
      const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const json = await res.json();
        const r0 = json.chart?.result?.[0];
        if (r0) {
          const timestamps = r0.timestamp || [];
          const closes = r0.indicators.quote[0].close || [];
          _spyMap = {};
          timestamps.forEach((ts, i) => {
            if (closes[i] != null) {
              const d = new Date(ts * 1000);
              const key = d.getUTCFullYear() + '-'
                + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
                + String(d.getUTCDate()).padStart(2, '0');
              _spyMap[key] = closes[i];
            }
          });
          console.log('[SPY] cargado:', Object.keys(_spyMap).length, 'días');
        } else {
          console.warn('[SPY] respuesta sin result:', JSON.stringify(json).slice(0, 200));
          _spyMap = {};
        }
      } else {
        console.warn('[SPY] HTTP error:', res.status);
        _spyMap = {};
      }
    } catch (err) {
      console.warn('[SPY] fetch falló (offline/proxy):', err.message);
      _spyMap = {};
    }
  }
  _drawBenchmark();
}

function _drawBenchmark() {
  const canvas = document.getElementById('cBenchmark');
  if (!canvas) return;

  // Período seleccionado desde el grupo de botones
  const period = document.querySelector('#benchmarkBtns .active')?.dataset.period || 'all';
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // La ventana de vista nunca retrocede antes de enero 2024
  let viewStart = '2024-01-01';
  if (period === '1y') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); const s = d.toISOString().slice(0, 10); if (s > '2024-01-01') viewStart = s; }
  else if (period === '6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); const s = d.toISOString().slice(0, 10); if (s > '2024-01-01') viewStart = s; }
  else if (period === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); const s = d.toISOString().slice(0, 10); if (s > '2024-01-01') viewStart = s; }
  else if (period === '1m') { const d = new Date(now); d.setMonth(d.getMonth() - 1); const s = d.toISOString().slice(0, 10); if (s > '2024-01-01') viewStart = s; }

  // Ancla SPY: siempre el primer día hábil de enero 2024
  const spyBase = _nearestSpy('2024-01-01');
  console.log('[Benchmark] periodo:', period, '| viewStart:', viewStart, '| spyBase:', spyBase);

  // Eje X: primer día de cada mes desde viewStart hasta hoy
  const axisDates = [];
  const cur = new Date(viewStart + 'T00:00:00Z');
  cur.setUTCDate(1);
  while (true) {
    const key = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-01';
    if (key > todayStr) break;
    axisDates.push(key);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  // Añadir fechas reales del portfolio dentro del rango
  const allPortfolio = [...(D.history || [])].filter(h => h.date >= '2024-01-01').sort((a, b) => a.date.localeCompare(b.date));
  allPortfolio.filter(h => h.date >= viewStart).forEach(h => { if (!axisDates.includes(h.date)) axisDates.push(h.date); });
  axisDates.sort();

  // Base del portfolio: primer valor registrado desde enero 2024
  const portfolioFirstDate = allPortfolio[0]?.date;
  const portfolioBase = allPortfolio.length > 0
    ? (allPortfolio[0].totalInvested > 0 ? allPortfolio[0].totalInvested : allPortfolio[0].totalValue)
    : null;

  if (!spyBase && !portfolioBase) {
    if (CH.benchmark) { CH.benchmark.destroy(); CH.benchmark = null; }
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Mapa portfolio por fecha para forward-fill
  const portMap = {};
  for (const h of allPortfolio) portMap[h.date] = h.totalValue;

  const labels = axisDates.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));

  const spyData = axisDates.map(d => {
    if (!spyBase) return null;
    const p = _nearestSpy(d);
    return p != null ? parseFloat(((p / spyBase - 1) * 100).toFixed(2)) : null;
  });

  const portData = (() => {
    if (!portfolioBase || !portfolioFirstDate) return axisDates.map(() => null);
    let lastVal = null;
    return axisDates.map(d => {
      if (d < portfolioFirstDate) return null;
      if (portMap[d] != null) lastVal = portMap[d];
      if (lastVal == null) {
        const prev = allPortfolio.filter(h => h.date <= d);
        if (prev.length) lastVal = prev[prev.length - 1].totalValue;
      }
      return lastVal != null ? parseFloat(((lastVal / portfolioBase - 1) * 100).toFixed(2)) : null;
    });
  })();

  const datasets = [];
  if (spyBase) {
    datasets.push({
      label: 'S&P 500 (SPY)',
      data: spyData,
      borderColor: '#5588ff', backgroundColor: 'rgba(85,136,255,.04)',
      fill: true, tension: .3, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 4], spanGaps: true
    });
  }
  if (portfolioBase) {
    datasets.push({
      label: 'My Portfolio',
      data: portData,
      borderColor: '#22df8a', backgroundColor: 'rgba(34,223,138,.06)',
      fill: true, tension: .3, pointRadius: 3, pointBackgroundColor: '#22df8a',
      pointBorderColor: '#0d0d1a', pointBorderWidth: 2, borderWidth: 2, spanGaps: false
    });
  }

  if (!datasets.length || axisDates.length < 2) {
    if (CH.benchmark) { CH.benchmark.destroy(); CH.benchmark = null; }
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (CH.benchmark) CH.benchmark.destroy();
  CH.benchmark = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: legOpts },
        tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}${F(c.parsed.y, 2)}%` } }
      },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 14 } },
        y: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => (v >= 0 ? '+' : '') + F(v, 1) + '%' } }
      }
    }
  });
}
