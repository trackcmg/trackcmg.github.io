// ============================================================
//  portfolio.js — Cotizaciones, FX y render del portfolio
// ============================================================
import { PROXY_URL } from './config.js';
import { D } from './state.js';
import { _authed } from './state.js';
import { F, ttOpts, legOpts } from './utils.js';
import { saveAndSync } from './cloud.js';

// ── Precio y FX en memoria (persisten en localStorage) ──────
let P = {};
let FX = { USD: null, CAD: null, GBP: null };
let CH = {};
let _refreshing = false;
let _monthlyPage = 1;
const _monthlyPerPage = 12;
let _monthlyTotalPages = 1;

// Restaurar caché del portfolio al cargar el módulo
try {
  const cp = localStorage.getItem('pf_p');
  const cf = localStorage.getItem('pf_fx');
  if (cp) {
    P = JSON.parse(cp);
    Object.values(P).forEach(v => { if (v.ts) v.ts = v.ts.map(t => new Date(t)); });
  }
  if (cf) {
    const fx = JSON.parse(cf);
    if (fx.USD) FX = fx;
  }
} catch (e) { /* noop */ }

// ── Delegación para paginación mensual ──────────────────────
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-monthly-action]');
  if (!btn) return;
  const action = btn.dataset.monthlyAction;
  if (action === 'first') _monthlyPage = 1;
  else if (action === 'prev') _monthlyPage = Math.max(1, _monthlyPage - 1);
  else if (action === 'next') _monthlyPage = Math.min(_monthlyTotalPages, _monthlyPage + 1);
  else if (action === 'last') _monthlyPage = _monthlyTotalPages;
  else _monthlyPage = parseInt(action) || 1;
  renderMonthlyTable();
});

// ── Helpers de FX ───────────────────────────────────────────
export function fxR(c) { return c === 'EUR' ? 1 : (FX[c] || 0); }
export function valEur(h) {
  const d = P[h.ticker];
  if (!d || !isFinite(d.price)) return 0;
  return d.price * h.shares * fxR(h.currency);
}

// ── Fetch interno a través del GAS proxy ────────────────────
async function pFetch(u) {
  const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(u)}`);
  if (!r.ok) throw new Error('Proxy:' + r.status);
  return r.json();
}

export async function fetchStock(tk) {
  const d = await pFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${tk}?range=1d&interval=5m`);
  const result = d.chart.result[0], m = result.meta, q = result.indicators.quote[0];
  let price = m.regularMarketPrice, prev = m.chartPreviousClose || m.previousClose;
  let cls = q.close || [], his = (q.high || []).filter(v => v != null), los = (q.low || []).filter(v => v != null);
  if (['GBp', 'GBX', 'GBx'].includes(m.currency)) {
    price /= 100; prev /= 100;
    cls = cls.map(v => v != null ? v / 100 : null);
    his = his.map(v => v / 100);
    los = los.map(v => v / 100);
  }
  return {
    ticker: tk, price, prev,
    high: his.length ? Math.max(...his) : price,
    low: los.length ? Math.min(...los) : price,
    ts: (result.timestamp || []).map(t => new Date(t * 1000)),
    cls, _stale: !isFinite(price)
  };
}

export async function fetchFx() {
  try {
    const d = await (await fetch('https://api.exchangerate-api.com/v4/latest/EUR')).json();
    FX.USD = 1 / d.rates.USD; FX.CAD = 1 / d.rates.CAD; FX.GBP = 1 / d.rates.GBP; return;
  } catch (e) { /* fallback */ }
  try {
    const d = await (await fetch('https://open.er-api.com/v6/latest/EUR')).json();
    FX.USD = 1 / d.rates.USD; FX.CAD = 1 / d.rates.CAD; FX.GBP = 1 / d.rates.GBP; return;
  } catch (e) { /* noop */ }
  if (!FX.USD) { FX.USD = 0.86; FX.CAD = 0.63; FX.GBP = 1.17; }
}

// ── Actualización completa de precios ───────────────────────
export async function refreshPortfolio() {
  if (_refreshing) return;
  _refreshing = true;
  const dot = document.getElementById('dot'), tsE = document.getElementById('ts');
  dot.style.background = 'var(--amber)';
  tsE.textContent = 'Updating...';
  if (Object.keys(P).length) renderPortfolio();
  else rSkeletons();

  let fxOk = false;
  try { await fetchFx(); fxOk = true; } catch (e) { /* noop */ }
  if (!FX.USD) { FX.USD = 0.86; FX.CAD = 0.63; FX.GBP = 1.17; }

  const res = await Promise.allSettled(D.holdings.map(h => fetchStock(h.ticker)));
  let allOk = true;
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') P[D.holdings[i].ticker] = r.value;
    else { if (P[D.holdings[i].ticker]) P[D.holdings[i].ticker]._stale = true; allOk = false; }
  });

  try {
    localStorage.setItem('pf_p', JSON.stringify(
      Object.fromEntries(Object.entries(P).map(([k, v]) => [k, { ...v, ts: v.ts ? v.ts.map(d => d.toISOString()) : [] }]))
    ));
    localStorage.setItem('pf_fx', JSON.stringify(FX));
  } catch (e) { /* storage full */ }

  renderPortfolio();

  // Snapshot diario (solo días laborables, zona Europe/Amsterdam)
  if (allOk && fxOk) {
    const euNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    const dow = euNow.getDay();
    if (dow !== 0 && dow !== 6) {
      const todayStr = euNow.getFullYear() + '-'
        + String(euNow.getMonth() + 1).padStart(2, '0') + '-'
        + String(euNow.getDate()).padStart(2, '0');
      if (!D.history) D.history = [];
      const already = D.history.find(h => h.date === todayStr);
      let totalVal = D.cash;
      D.holdings.forEach(h => {
        const d = P[h.ticker];
        if (d && isFinite(d.price)) totalVal += d.price * h.shares * fxR(h.currency);
      });
      if (!already) {
        D.history.push({ date: todayStr, totalInvested: D.totalInvested, totalValue: Math.round(totalVal * 100) / 100 });
        saveAndSync();
      } else {
        const oldVal = already.totalValue;
        already.totalValue = Math.round(totalVal * 100) / 100;
        already.totalInvested = D.totalInvested;
        if (oldVal !== already.totalValue) saveAndSync();
      }
    }
    renderHistory();
  }

  dot.style.background = (allOk && fxOk) ? 'var(--green)' : 'var(--amber)';
  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  tsE.textContent = (allOk && fxOk) ? now : now + ' (Parcial)';
  _refreshing = false;
}

// ── Render completo del portfolio ───────────────────────────
export function renderPortfolio() { rFx(); rHero(); rStocks(); rDonut(); rBar(); }

// ── Skeleton loaders (mientras la API responde) ──────────────
function rSkeletons() {
  const g = document.getElementById('sGrid');
  const count = D.holdings.length || 3;
  g.innerHTML = Array(count).fill(`
    <div class="stock-skeleton">
      <div class="sk-line sk-lg skeleton"></div>
      <div class="sk-line sk-sm skeleton" style="width:45%;margin-top:4px"></div>
      <div class="sk-line sk-xl skeleton" style="margin-top:8px"></div>
      <div class="sk-grid">
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
      </div>
    </div>`).join('');
}

function rFx() {
  const skel = '<span class="fx-skeleton skeleton"></span>';
  document.getElementById('fxU').innerHTML = FX.USD ? F(FX.USD, 4) : skel;
  document.getElementById('fxC').innerHTML = FX.CAD ? F(FX.CAD, 4) : skel;
  document.getElementById('fxG').innerHTML = FX.GBP ? F(FX.GBP, 4) : skel;
}

function rHero() {
  let t = D.cash;
  const bc = { EUR: D.cash };
  D.holdings.forEach(h => { const v = valEur(h); t += v; bc[h.currency] = (bc[h.currency] || 0) + v; });
  document.getElementById('hVal').innerHTML = `${F(t)} &euro;`;
  const inv = D.totalInvested, tRoi = t - inv, tPct = (tRoi / inv) * 100, tPos = tRoi >= 0;
  document.getElementById('hRoi').innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-dim);margin-bottom:6px">Invested: ${F(inv)} &euro;</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;margin-bottom:14px;color:var(--${tPos ? 'green' : 'red'})">All-Time ROI: ${tPos ? '+' : ''}${F(tPct)}% | ${tPos ? '+' : ''}${F(tRoi)} &euro;</div>`;
  document.getElementById('hSub').innerHTML = Object.entries(bc).map(([c, v]) => `<span>${c}: ${F(v)} &euro;</span>`).join('');
}

function rStocks() {
  const g = document.getElementById('sGrid');
  g.innerHTML = '';
  let totalPV = D.cash;
  D.holdings.forEach(h => { totalPV += valEur(h); });
  const sorted = D.holdings.map((h, i) => ({ h, i, ve: valEur(h) })).sort((a, b) => b.ve - a.ve);
  sorted.forEach(({ h, i: hi }) => {
    const d = P[h.ticker];
    const dOk = d && isFinite(d.price);
    const chg = dOk ? (d.price - d.prev) : 0, pct = dOk && d.prev ? (chg / d.prev) * 100 : 0, pos = chg >= 0;
    const ve = dOk ? d.price * h.shares * fxR(h.currency) : 0;
    const tc = h.currency === 'USD' ? 'tag-usd' : h.currency === 'CAD' ? 'tag-cad' : 'tag-gbp';
    const staleTag = dOk && d._stale ? '<span class="tag" style="background:rgba(255,170,34,.12);color:var(--amber);margin-left:4px">STALE</span>' : '';
    const noData = !dOk ? '<span class="tag" style="background:rgba(255,68,102,.12);color:var(--red);margin-left:4px">NO DATA</span>' : '';
    const divNetEur = (h.dividends || 0) * fxR(h.currency);
    const hRoiAbsEur = dOk ? (d.price - h.entryPrice) * h.shares * fxR(h.currency) + divNetEur : 0;
    const totalInv = h.entryPrice * h.shares * fxR(h.currency);
    const hRoiPct = totalInv > 0 ? (hRoiAbsEur / totalInv) * 100 : 0;
    const hPos = hRoiAbsEur >= 0;
    const pctOfPortfolio = totalPV > 0 ? (ve / totalPV) * 100 : 0;
    const el = document.createElement('div');
    el.className = 'stock';
    if (dOk && d._stale) el.style.opacity = '0.7';
    if (!dOk) el.style.opacity = '0.55';
    if (_authed) { el.dataset.editType = 'holding'; el.dataset.editIdx = hi; el.style.cursor = 'pointer'; }
    el.innerHTML = `
      <div class="s-top"><div>
        <div class="s-tk">${h.ticker} <span class="tag ${tc}">${h.exchange}</span>${staleTag}${noData}</div>
        <div class="s-nm">${h.name}</div>
        <div class="s-pr" style="margin:6px 0 0">${dOk ? F(d.price) : '--'} <span class="cur">${h.currency}</span></div>
      </div>
      ${dOk ? `<div class="s-chg" style="text-align:right">
        <div style="font-size:9px;color:var(--text);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:3px">Daily</div>
        <div class="pct ${pos ? 'up' : 'dn'}">${pos ? '+' : ''}${F(pct)}%</div>
        <div class="abs ${pos ? 'up' : 'dn'}" style="font-size:11px">${pos ? '+' : ''}${F(chg)} ${h.currency}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${F(d.low)} \u2013 ${F(d.high)}</div>
      </div>` : ''}</div>
      <div class="s-meta">
        <div><div class="ml">Shares</div><div class="mv">${h.shares.toLocaleString('de-DE')}</div></div>
        <div><div class="ml">Value (EUR)</div><div class="mv ${dOk ? 'up' : ''}">${dOk ? F(ve) + ' \u20ac' : '--'}</div></div>
        <div><div class="ml">Dividends (${h.currency})</div><div class="mv ${(h.dividends || 0) > 0 ? 'up' : ''}">${(h.dividends || 0) > 0 ? '+' + F(h.dividends) + ' ' + h.currency : '\u2014'}</div></div>
        <div><div class="ml">% of Portfolio</div><div class="mv">${dOk ? F(pctOfPortfolio, 1) + '%' : '--'}</div></div>
        <div><div class="ml">Avg Price</div><div class="mv">${F(h.entryPrice)} <span style="font-size:10px;color:var(--text-dim)">${h.currency}</span></div></div>
        <div><div class="ml">Total Return</div><div class="mv ${dOk ? (hPos ? 'up' : 'dn') : ''}">${dOk ? (hPos ? '+' : '') + F(hRoiPct) + '% <span style="font-size:10px;">(' + (hPos ? '+' : '') + F(hRoiAbsEur) + ' \u20ac)</span>' : '--'}</div></div>
      </div>`;
    g.appendChild(el);
  });
  if (D.cash > 0 || _authed) {
    const cel = document.createElement('div');
    cel.className = 'stock';
    if (_authed) { cel.dataset.editType = 'cash'; cel.style.cursor = 'pointer'; }
    cel.innerHTML = `<div class="s-top"><div>
      <div class="s-tk" style="color:#667788">CASH <span class="tag" style="background:rgba(102,119,136,.12);color:#667788">EUR</span></div>
      <div class="s-nm">Cash & totals${_authed ? ' \u00b7 click to edit' : ''}</div>
    </div></div>
    <div class="s-pr">${F(D.cash)} <span class="cur">EUR</span></div>`;
    g.appendChild(cel);
  }
}

function rDonut() {
  const ctx = document.getElementById('cD').getContext('2d');
  if (CH.d) CH.d.destroy();
  const dItems = [
    ...D.holdings.map(h => ({ tk: h.ticker, val: valEur(h), color: h.color })),
    { tk: 'Cash', val: D.cash, color: '#667788' }
  ].sort((a, b) => b.val - a.val);
  const dTotal = dItems.reduce((a, b) => a + b.val, 0);
  CH.d = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: dItems.map(i => i.tk), datasets: [{ data: dItems.map(i => i.val), backgroundColor: dItems.map(i => i.color), borderColor: '#0d0d1a', borderWidth: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: legOpts },
        tooltip: { ...ttOpts, callbacks: { label: c => { const pct = dTotal > 0 ? (c.parsed / dTotal * 100) : 0; return ` ${c.label}: ${F(c.parsed)} \u20ac (${F(pct, 1)}%)`; } } }
      }
    }
  });
}

function rBar() {
  const ctx = document.getElementById('cB').getContext('2d');
  const items = [
    ...D.holdings.map(h => ({ tk: h.ticker, val: valEur(h), color: h.color })),
    { tk: 'Cash', val: D.cash, color: '#667788' }
  ].sort((a, b) => b.val - a.val);
  if (CH.b) CH.b.destroy();
  CH.b = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(i => i.tk),
      datasets: [{ data: items.map(i => i.val), backgroundColor: items.map(i => i.color + 'aa'), borderColor: items.map(i => i.color), borderWidth: 1.5, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${F(c.parsed.x)} \u20ac` } } },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.6)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac' } },
        y: { grid: { display: false }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 11, weight: '600' } } }
      }
    }
  });
}

// ── Historial y tabla mensual ────────────────────────────────
export function renderHistory() { renderHistoryChart(); renderMonthlyTable(); }

function renderHistoryChart() {
  if (!D.history || !D.history.length) return;
  const sorted = [...D.history].sort((a, b) => a.date.localeCompare(b.date));
  let sampled;
  if (sorted.length <= 90) {
    sampled = sorted;
  } else {
    const bucket = sorted.length <= 365 ? 7 : 30;
    sampled = [];
    let i = 0;
    while (i < sorted.length) {
      const chunk = sorted.slice(i, i + bucket);
      const last = chunk[chunk.length - 1];
      sampled.push({ date: last.date, totalInvested: last.totalInvested, totalValue: last.totalValue });
      i += bucket;
    }
  }
  const fmt = sampled.length <= 90 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' };
  const labels = sampled.map(h => new Date(h.date).toLocaleDateString('es-ES', fmt));
  const invested = sampled.map(h => h.totalInvested);
  const values = sampled.map(h => h.totalValue);
  const ctx = document.getElementById('cHistory').getContext('2d');
  if (CH.history) CH.history.destroy();
  CH.history = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Invested', data: invested, borderColor: '#22df8a', backgroundColor: 'rgba(34,223,138,.06)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#22df8a', pointBorderColor: '#0d0d1a', pointBorderWidth: 2, borderWidth: 2, hidden: true },
        { label: 'Portfolio Value', data: values, borderColor: '#5588ff', backgroundColor: 'rgba(85,136,255,.06)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#5588ff', pointBorderColor: '#0d0d1a', pointBorderWidth: 2, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: legOpts },
        tooltip: {
          ...ttOpts, callbacks: {
            label: c => ` ${c.dataset.label}: ${F(c.parsed.y)} \u20ac`,
            afterBody: function (ctx) {
              const i = ctx[0].dataIndex;
              const inv = invested[i], val = values[i];
              if (inv > 0) { const r = ((val - inv) / inv) * 100; return `  Return: ${r >= 0 ? '+' : ''}${F(r)}%`; }
              return '';
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.4)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 14 } },
        y: { type: 'linear', grid: { color: 'rgba(26,26,53,.4)' }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac' } }
      }
    }
  });
}

function renderMonthlyTable() {
  if (!D.history || !D.history.length) {
    document.getElementById('monthlyTable').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px">No history yet. Data is recorded daily on each page load.</p>';
    document.getElementById('monthlyPag').innerHTML = '';
    return;
  }
  const sorted = [...D.history].sort((a, b) => a.date.localeCompare(b.date));
  const months = {};
  sorted.forEach(h => {
    const mk = h.date.substring(0, 7);
    if (!months[mk]) months[mk] = { key: mk, entries: [] };
    months[mk].entries.push(h);
  });
  const mList = Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
  _monthlyTotalPages = Math.max(1, Math.ceil(mList.length / _monthlyPerPage));
  if (_monthlyPage > _monthlyTotalPages) _monthlyPage = _monthlyTotalPages;
  const start = (_monthlyPage - 1) * _monthlyPerPage;
  const page = mList.slice(start, start + _monthlyPerPage);
  let rows = '';
  page.forEach(m => {
    const last = m.entries[m.entries.length - 1];
    const fullIdx = mList.indexOf(m);
    const prevMonth = fullIdx < mList.length - 1 ? mList[fullIdx + 1] : null;
    const startVal = prevMonth ? prevMonth.entries[prevMonth.entries.length - 1].totalValue : m.entries[0].totalValue;
    const endVal = last.totalValue;
    const absRet = endVal - startVal, pctRet = startVal > 0 ? (absRet / startVal) * 100 : 0;
    const totalRet = last.totalInvested > 0 ? ((endVal - last.totalInvested) / last.totalInvested) * 100 : 0;
    const pos = absRet >= 0, tPos = totalRet >= 0;
    const [y, mo] = m.key.split('-');
    const mName = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    rows += `<tr>
      <td style="font-weight:600">${mName}</td>
      <td>${F(startVal)} \u20ac</td><td>${F(endVal)} \u20ac</td>
      <td class="${pos ? 'up' : 'dn'}" style="font-weight:600">${pos ? '+' : ''}${F(absRet)} \u20ac</td>
      <td class="${pos ? 'up' : 'dn'}" style="font-weight:600">${pos ? '+' : ''}${F(pctRet)}%</td>
      <td class="${tPos ? 'up' : 'dn'}">${tPos ? '+' : ''}${F(totalRet)}%</td>
    </tr>`;
  });
  document.getElementById('monthlyTable').innerHTML = `<table><thead><tr><th>Month</th><th>Start Value</th><th>End Value</th><th>Monthly P&L</th><th>Monthly %</th><th>All-Time %</th></tr></thead><tbody>${rows}</tbody></table>`;

  if (_monthlyTotalPages <= 1) { document.getElementById('monthlyPag').innerHTML = ''; return; }
  let pg = '';
  pg += `<button class="btn btn-sm" data-monthly-action="first" ${_monthlyPage === 1 ? 'disabled' : ''}>\u00ab</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="prev" ${_monthlyPage === 1 ? 'disabled' : ''}>\u2039</button>`;
  const maxShow = 5;
  let s = Math.max(1, _monthlyPage - Math.floor(maxShow / 2));
  let e = Math.min(_monthlyTotalPages, s + maxShow - 1);
  s = Math.max(1, e - maxShow + 1);
  for (let i = s; i <= e; i++) pg += `<button class="btn btn-sm${i === _monthlyPage ? ' btn-g' : ''}" data-monthly-action="${i}">${i}</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="next" ${_monthlyPage === _monthlyTotalPages ? 'disabled' : ''}>\u203a</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="last" ${_monthlyPage === _monthlyTotalPages ? 'disabled' : ''}>\u00bb</button>`;
  document.getElementById('monthlyPag').innerHTML = pg;
}
