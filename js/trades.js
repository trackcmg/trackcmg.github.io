// ============================================================
//  trades.js — Trades cerrados: cálculo y render
// ============================================================
import { D } from './state.js';
import { _authed } from './state.js';
import { F, ttOpts, legOpts } from './utils.js';

// Tipos de cambio estáticos para el cálculo de rentabilidad histórica
const TRADE_FX = { EUR: 1, USD: 0.8696, CAD: 0.6369, GBP: 1.1574 };

let CH = {};

export function tradeFx(c) { return TRADE_FX[c] || 1; }

export function calcTrade(t) {
  const fx = tradeFx(t.currency);
  const grossPL = t.totalShares * (t.sellPrice - t.avgBuy) * fx;
  const divN = (t.dividends || 0) * fx;
  const inv = t.totalShares * t.avgBuy * fx;
  const net = grossPL + divN;
  return {
    grossPL, divN, inv, net,
    pct: inv > 0 ? (net / inv) * 100 : 0,
    ret: inv + net, fx,
    cur: t.currency,
    rawBuy: t.avgBuy,
    rawSell: t.sellPrice,
    rawInv: t.totalShares * t.avgBuy,
    rawGross: t.totalShares * (t.sellPrice - t.avgBuy)
  };
}

export function renderTrades() {
  let tI = 0, tG = 0, tDN = 0, tNet = 0;
  D.closedTrades.forEach(t => {
    const c = calcTrade(t);
    tI += c.inv; tG += c.grossPL; tDN += c.divN; tNet += c.net;
  });
  const nP = tNet >= 0;

  document.getElementById('tradesSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Capital deployed</div><div class="sum-val">${F(tI)} \u20ac</div></div>
    <div class="sum-card"><div class="sum-lbl">Gross P&L</div><div class="sum-val ${tG >= 0 ? 'up' : 'dn'}">${tG >= 0 ? '+' : ''}${F(tG)} \u20ac</div></div>
    <div class="sum-card"><div class="sum-lbl">Dividends (net)</div><div class="sum-val up">${tDN > 0 ? '+' + F(tDN) : '\u2014'}</div></div>
    <div class="sum-card"><div class="sum-lbl">Net result</div><div class="sum-val ${nP ? 'up' : 'dn'}">${nP ? '+' : ''}${F(tNet)} \u20ac</div></div>
    <div class="sum-card"><div class="sum-lbl">Return %</div><div class="sum-val ${nP ? 'up' : 'dn'}">${tI > 0 ? (nP ? '+' : '') + F((tNet / tI) * 100) + '%' : '\u2014'}</div></div>`;

  let rows = '';
  D.closedTrades.forEach((t, idx) => {
    const c = calcTrade(t);
    const pos = c.net >= 0;
    const curTag = t.currency !== 'EUR' ? `<span style="font-size:9px;color:var(--text-muted)"> ${t.currency}</span>` : '';
    rows += `<tr ${_authed ? `data-edit-type="trade" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <td><span style="color:${t.color};font-weight:600">${t.ticker}</span>${curTag}</td>
      <td style="white-space:normal">${t.name}</td>
      <td>${t.totalShares.toLocaleString('de-DE')}</td>
      <td>${F(c.rawBuy)}${curTag}</td>
      <td>${F(c.rawSell)}${curTag}</td>
      <td>${F(c.inv)} \u20ac</td>
      <td class="${c.grossPL >= 0 ? 'up' : 'dn'}">${c.grossPL >= 0 ? '+' : ''}${F(c.grossPL)} \u20ac</td>
      <td class="up">${c.divN > 0 ? '+' + F(c.divN) + ' \u20ac' : '\u2014'}</td>
      <td class="${pos ? 'up' : 'dn'}" style="font-weight:600">${pos ? '+' : ''}${F(c.net)} \u20ac</td>
      <td class="${pos ? 'up' : 'dn'}">${pos ? '+' : ''}${F(c.pct)}%</td>
    </tr>`;
  });

  document.getElementById('tradesTable').innerHTML = `
    <table><thead><tr><th>Ticker</th><th>Name</th><th>Shares</th><th>Avg Buy</th><th>Sell</th><th>Invested</th><th>Gross P&L</th><th>Div</th><th>Net</th><th>Return</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="tbl-foot">
      <td colspan="5" style="font-weight:600">TOTAL</td>
      <td>${F(tI)}</td>
      <td class="${tG >= 0 ? 'up' : 'dn'}">${tG >= 0 ? '+' : ''}${F(tG)}</td>
      <td class="up">${tDN > 0 ? '+' + F(tDN) : '\u2014'}</td>
      <td class="${nP ? 'up' : 'dn'}" style="font-weight:600">${nP ? '+' : ''}${F(tNet)}</td>
      <td class="${nP ? 'up' : 'dn'}">${tI > 0 ? (nP ? '+' : '') + F((tNet / tI) * 100) + '%' : '\u2014'}</td>
    </tr></tfoot></table>`;

  // Gráfico: Net P&L por trade
  const ctx1 = document.getElementById('cTrades').getContext('2d');
  const d1 = D.closedTrades.map(t => ({ tk: t.ticker, val: calcTrade(t).net, color: t.color })).sort((a, b) => b.val - a.val);
  if (CH.trades) CH.trades.destroy();
  if (d1.length) CH.trades = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: d1.map(d => d.tk),
      datasets: [{ data: d1.map(d => d.val), backgroundColor: d1.map(d => d.val >= 0 ? d.color + 'aa' : 'rgba(255,68,102,.5)'), borderColor: d1.map(d => d.val >= 0 ? d.color : 'var(--red)'), borderWidth: 1.5, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` Net: ${F(c.parsed.y)} \u20ac` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 11, weight: '600' } } },
        y: { grid: { color: 'rgba(26,26,53,.6)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac' } }
      }
    }
  });

  // Gráfico: Capital invertido vs retornado
  const ctx2 = document.getElementById('cCapital').getContext('2d');
  if (CH.capital) CH.capital.destroy();
  const d2 = D.closedTrades.map(t => { const c = calcTrade(t); return { tk: t.ticker, inv: c.inv, ret: c.ret, net: c.net }; }).sort((a, b) => b.net - a.net);
  if (d2.length) CH.capital = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d2.map(t => t.tk),
      datasets: [
        { label: 'Invested', data: d2.map(t => t.inv), backgroundColor: 'rgba(112,112,160,.4)', borderColor: '#7070a0', borderWidth: 1, borderRadius: 6, borderSkipped: false },
        { label: 'Returned', data: d2.map(t => t.ret), backgroundColor: 'rgba(34,223,138,.4)', borderColor: 'var(--green)', borderWidth: 1, borderRadius: 6, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: legOpts }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${F(c.parsed.y)} \u20ac` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 11, weight: '600' } } },
        y: { grid: { color: 'rgba(26,26,53,.6)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac' } }
      }
    }
  });
}
