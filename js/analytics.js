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
  _renderDividendHeatmap();
}

// ── Tarjetas de resumen ──────────────────────────────────────
function _renderSummaryCards() {
  const el = document.getElementById('analyticsSummary');
  if (!el) return;

  const totalVal = D.cash + D.holdings.reduce((s, h) => s + valEur(h), 0);
  const totalInv = D.totalInvested;
  const totalReturn = totalVal - totalInv;
  const totalReturnPct = totalInv > 0 ? (totalReturn / totalInv) * 100 : 0;

  // Dividendos totales cobrados (en EUR)
  const totalDivEur = D.holdings.reduce((s, h) => s + (h.dividends || 0) * fxR(h.currency), 0)
    + D.closedTrades.reduce((s, t) => s + (t.dividends || 0) * fxR(t.currency), 0);

  const yieldPct = totalInv > 0 ? (totalDivEur / totalInv) * 100 : 0;

  el.innerHTML = [
    { lbl: 'Total Return', val: (totalReturn >= 0 ? '+' : '') + F(totalReturn) + ' €', cls: totalReturn >= 0 ? 'up' : 'dn' },
    { lbl: 'Return %', val: (totalReturnPct >= 0 ? '+' : '') + F(totalReturnPct) + '%', cls: totalReturnPct >= 0 ? 'up' : 'dn' },
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

// ── Benchmark: Portfolio vs SPY (histórico) ──────────────────
// Precaución: requiere que GAS tenga espejo para Yahoo; si el proxy
// falla, el dataset SPY simplemente no se agrega al gráfico.
export async function renderBenchmark() {
  const canvas = document.getElementById('cBenchmark');
  if (!canvas) return;

  const sorted = [...(D.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Mi portfolio como % de retorno acumulado desde el primer punto
  const base = sorted[0].totalInvested || sorted[0].totalValue;
  const myReturns = sorted.map(h => base > 0 ? ((h.totalValue - base) / base) * 100 : 0);
  const labels = sorted.map(h => new Date(h.date).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));

  // Intentar obtener SPY del proxy
  let spyReturns = null;
  try {
    const rangeMonths = Math.ceil(sorted.length / 20) <= 1 ? '1mo' : sorted.length <= 90 ? '6mo' : sorted.length <= 365 ? '1y' : '2y';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=${rangeMonths}&interval=1d`;
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const json = await res.json();
      const closes = json.chart.result[0].indicators.quote[0].close.filter(v => v != null);
      if (closes.length >= 2) {
        const spyBase = closes[0];
        // Submuestrear para que los puntos coincidan en cantidad con nuestro historial
        const step = Math.max(1, Math.floor(closes.length / sorted.length));
        const sampled = [];
        for (let i = 0; i < sorted.length; i++) {
          const idx = Math.min(Math.round(i * step), closes.length - 1);
          sampled.push(((closes[idx] - spyBase) / spyBase) * 100);
        }
        spyReturns = sampled;
      }
    }
  } catch (_) { /* offline o proxy no configurado — no bloqueante */ }

  const datasets = [
    {
      label: 'My Portfolio',
      data: myReturns,
      borderColor: '#22df8a', backgroundColor: 'rgba(34,223,138,.06)',
      fill: true, tension: .3, pointRadius: 3, pointBackgroundColor: '#22df8a',
      pointBorderColor: '#0d0d1a', pointBorderWidth: 2, borderWidth: 2
    }
  ];
  if (spyReturns) {
    datasets.push({
      label: 'S&P 500 (SPY)',
      data: spyReturns,
      borderColor: '#5588ff', backgroundColor: 'rgba(85,136,255,.04)',
      fill: true, tension: .3, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 4]
    });
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
        tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}${F(c.parsed.y)}%` } }
      },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => (v >= 0 ? '+' : '') + F(v, 1) + '%' } }
      }
    }
  });
}

// ── Heatmap de dividendos (12 meses corrientes) ──────────────
export function renderDividendHeatmap() {
  const el = document.getElementById('dividendHeatmap');
  if (!el) return;

  const now = new Date();
  // Generar los últimos 12 meses como { year, month }
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  // Dividendos por holding: distribuimos uniformemente (datos reales requeriría
  // un calendario de ex-dividend del GAS proxy). Aquí mostramos dividendos totales
  // reales y el valor proyectado anual/12 como estimación mensual.
  const monthlyReal = {}; // clave: YYYY-MM
  const monthlyProjected = {};

  // Cada holding contribuye con dividendos anuales proyectados / 12 por mes futuro
  D.holdings.forEach(h => {
    const annualEur = (h.dividends || 0) * fxR(h.currency);
    const monthlyEst = annualEur / 12;
    months.forEach(({ year, month }) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const isCurrentOrFuture = year > now.getFullYear() ||
        (year === now.getFullYear() && month >= now.getMonth() + 1);
      if (isCurrentOrFuture) {
        monthlyProjected[key] = (monthlyProjected[key] || 0) + monthlyEst;
      } else {
        // Para meses pasados: los dividendos reales acumulados se muestran si existen
        monthlyReal[key] = (monthlyReal[key] || 0) + monthlyEst;
      }
    });
  });

  // Escala de colores: 0→bg-card, max→green con intensidad
  const allValues = [...Object.values(monthlyReal), ...Object.values(monthlyProjected)].filter(v => v > 0);
  const maxVal = allValues.length ? Math.max(...allValues) : 1;

  function _cellColor(val, projected) {
    if (!val || val <= 0) return 'background:var(--bg-hover);color:var(--text-muted)';
    const intensity = Math.round((val / maxVal) * 100);
    if (projected) {
      return `background:rgba(85,136,255,${0.08 + intensity / 100 * 0.35});color:var(--blue)`;
    }
    return `background:rgba(34,223,138,${0.08 + intensity / 100 * 0.40});color:var(--green)`;
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  el.innerHTML = months.map(({ year, month }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const isCurrentOrFuture = year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1);
    const val = isCurrentOrFuture ? (monthlyProjected[key] || 0) : (monthlyReal[key] || 0);
    const style = _cellColor(val, isCurrentOrFuture);
    const typeLabel = isCurrentOrFuture ? 'est.' : 'paid';
    return `<div class="hm-col">
      <div class="hm-month">${MONTH_NAMES[month - 1]}<br>${String(year).slice(2)}</div>
      <div class="hm-cell" style="${style}" title="${key}: ${F(val)} €">
        <span class="hm-amt">${val >= 0.01 ? F(val, 0) + '€' : '—'}</span>
        <span class="hm-type">${val >= 0.01 ? typeLabel : ''}</span>
      </div>
    </div>`;
  }).join('');
}
