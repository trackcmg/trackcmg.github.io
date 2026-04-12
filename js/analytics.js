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
// null = no intentado / pendiente de retry; {} vacío = fallo estructural ya registrado
let _spyMap = null;

// Busca el precio SPY más cercano (±7 días hábiles) a una fecha ISO
function _nearestSpy(dateStr) {
  if (!_spyMap || !Object.keys(_spyMap).length) return null;
  if (_spyMap[dateStr] > 0) return _spyMap[dateStr];
  const base = new Date(dateStr + 'T00:00:00Z');
  for (let offset = 1; offset <= 7; offset++) {
    for (const sign of [1, -1]) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + sign * offset);
      const k = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      if (_spyMap[k] > 0) return _spyMap[k];
    }
  }
  return null;
}

export async function renderBenchmark() {
  // _spyMap === null → aún no hemos intentado cargarlo (o falló HTTP → reintentar)
  if (_spyMap === null) {
    try {
      // range=5y es el formato más fiable del endpoint v8 del proxy
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5y&interval=1d`;
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const raw = await res.text();
      console.log('[SPY] respuesta cruda (300 chars):', raw.slice(0, 300));

      let json;
      try { json = JSON.parse(raw); } catch { json = null; }

      const r0 = json?.chart?.result?.[0];
      if (r0) {
        const timestamps = r0.timestamp || [];
        const closes = r0.indicators?.quote?.[0]?.close || [];
        _spyMap = {};
        timestamps.forEach((ts, i) => {
          const price = closes[i];
          if (price != null && isFinite(price) && price > 0) {
            const d = new Date(ts * 1000);
            const key = d.getUTCFullYear() + '-'
              + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
              + String(d.getUTCDate()).padStart(2, '0');
            _spyMap[key] = price;
          }
        });
        const entries = Object.entries(_spyMap);
        console.log('[SPY] cargado:', entries.length, 'días | primer día:', entries[0]);
      } else {
        // Respuesta válida pero sin datos de bolsa — no reintentar
        console.warn('[SPY] estructura inesperada. chart.result vacío. JSON completo:', JSON.stringify(json));
        _spyMap = {};   // vacío → no SPY line, no retry
      }
    } catch (err) {
      console.warn('[SPY] fetch falló (proxy/red):', err.message);
      _spyMap = null;   // null → reintentará en la próxima llamada
    }
  }
  _drawBenchmark();
}

function _drawBenchmark() {
  const canvas = document.getElementById('cBenchmark');
  if (!canvas) return;

  const period = document.querySelector('#benchmarkBtns .active')?.dataset.period || 'all';
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const MIN_DATE = '2025-01-01';

  // ── viewStart según período (mínimo enero 2025) ──────────────
  let viewStart = MIN_DATE;
  if (period === '1y')  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '1m') { const d = new Date(now); d.setMonth(d.getMonth() - 1); viewStart = d.toISOString().slice(0, 10); }
  if (viewStart < MIN_DATE) viewStart = MIN_DATE;

  // ── Datos reales del portfolio ────────────────────────────────
  const allPortfolio = [...(D.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  const firstEntry = allPortfolio[0] || null;
  const portMap = {};
  for (const h of allPortfolio) portMap[h.date] = h;

  // ── Tasa mensual compuesta (constante) desde ene-2025 al primer dato real ──
  // Return en primer dato = (valor - invertido) / invertido
  // (1 + monthlyRate)^meses = 1 + totalReturn  →  monthlyRate = (1+R)^(1/m) - 1
  let monthlyRate = 0;
  if (firstEntry && firstEntry.totalInvested > 0) {
    const totalRet = (firstEntry.totalValue - firstEntry.totalInvested) / firstEntry.totalInvested;
    const startMs = new Date(MIN_DATE + 'T00:00:00Z').getTime();
    const firstMs = new Date(firstEntry.date + 'T00:00:00Z').getTime();
    const months = (firstMs - startMs) / (30.4375 * 24 * 3600 * 1000);
    if (months > 0) monthlyRate = Math.pow(1 + totalRet, 1 / months) - 1;
  }

  // Retorno acumulado absoluto del portfolio en cualquier fecha (desde ene-2025)
  function _absReturn(dateStr) {
    if (!firstEntry) return null;
    const startMs = new Date(MIN_DATE + 'T00:00:00Z').getTime();
    const curMs   = new Date(dateStr + 'T00:00:00Z').getTime();
    const months  = (curMs - startMs) / (30.4375 * 24 * 3600 * 1000);

    if (dateStr < firstEntry.date) {
      // Zona interpolada: rentabilidad compuesta constante
      return (Math.pow(1 + monthlyRate, months) - 1) * 100;
    }
    // Zona con datos reales: forward-fill
    let entry = portMap[dateStr];
    if (!entry) {
      const prev = allPortfolio.filter(h => h.date <= dateStr);
      entry = prev.length ? prev[prev.length - 1] : null;
    }
    if (!entry || firstEntry.totalInvested <= 0) return null;
    return ((entry.totalValue - firstEntry.totalInvested) / firstEntry.totalInvested) * 100;
  }

  // ── SPY base y portfolio base en viewStart → ambos parten de 0% ──
  const spyBase = _nearestSpy(viewStart);
  const portBase = _absReturn(viewStart); // retorno absoluto en viewStart

  console.log('[Benchmark] periodo:', period, '| viewStart:', viewStart, '| spyBase:', spyBase, '| portBase:', portBase?.toFixed(2));

  // ── Eje X: primer día de cada mes + fechas reales del portfolio ──
  const axisDates = [];
  const cur = new Date(viewStart + 'T00:00:00Z');
  cur.setUTCDate(1);
  while (true) {
    const key = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-01';
    if (key > todayStr) break;
    axisDates.push(key);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  allPortfolio.filter(h => h.date >= viewStart).forEach(h => { if (!axisDates.includes(h.date)) axisDates.push(h.date); });
  axisDates.sort();

  if (spyBase == null && portBase == null) {
    if (CH.benchmark) { CH.benchmark.destroy(); CH.benchmark = null; }
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = axisDates.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));

  // ── SPY: rebased a 0% en viewStart ───────────────────────────
  const spyData = spyBase
    ? (() => {
        let lastPct = null;
        return axisDates.map(d => {
          const p = _nearestSpy(d);
          if (p != null && isFinite(p)) lastPct = parseFloat(((p / spyBase - 1) * 100).toFixed(2));
          return lastPct;
        });
      })()
    : axisDates.map(() => null);

  // ── Portfolio: rebased a 0% en viewStart ─────────────────────
  const portData = portBase != null
    ? axisDates.map(d => {
        const abs = _absReturn(d);
        if (abs == null) return null;
        // Rebase: ((1 + abs/100) / (1 + portBase/100) - 1) * 100
        const rebased = ((1 + abs / 100) / (1 + portBase / 100) - 1) * 100;
        return parseFloat(rebased.toFixed(2));
      })
    : axisDates.map(() => null);

  const datasets = [];
  if (spyBase && spyData.some(v => v !== null)) {
    datasets.push({
      label: 'S&P 500 (SPY)',
      data: spyData,
      borderColor: '#5588ff',
      backgroundColor: 'rgba(85,136,255,.07)',
      fill: true, tension: .3, pointRadius: 0, borderWidth: 2,
      borderDash: [6, 3], spanGaps: true
    });
  }
  if (portBase != null) {
    datasets.push({
      label: 'My Portfolio',
      data: portData,
      borderColor: '#22df8a',
      backgroundColor: 'rgba(34,223,138,.08)',
      fill: true, tension: .3, pointRadius: 3, pointBackgroundColor: '#22df8a',
      pointBorderColor: '#0d0d1a', pointBorderWidth: 2, borderWidth: 2, spanGaps: true
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
        tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y != null ? (c.parsed.y >= 0 ? '+' : '') + F(c.parsed.y, 2) + '%' : 'N/A'}` } }
      },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 14 } },
        y: { grid: { color: 'rgba(26,26,53,.3)' }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => (v >= 0 ? '+' : '') + F(v, 1) + '%' } }
      }
    }
  });
}
