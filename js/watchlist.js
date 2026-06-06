// ============================================================
//  watchlist.js — Watchlist de stocks con precio objetivo
//  Los datos viven en D.watchlist y se sincronizan a Drive
//  mediante saveAndSync() igual que el resto de secciones.
// ============================================================
import { PROXY_URL } from './config.js';
import { D } from './state.js';
import { saveAndSync } from './cloud.js';

const F2 = v => isFinite(v) ? (Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(2)) : '—';

let _prices = {}; // ticker -> { price, prev }
let _refreshing = false;

async function _pFetch(u) {
  const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(u)}`);
  if (!r.ok) throw new Error('Proxy:' + r.status);
  return r.json();
}

export async function refreshWatchlist() {
  if (_refreshing) return;
  _refreshing = true;
  const items = D.watchlist || [];
  if (!items.length) { _refreshing = false; renderWatchlist(); return; }

  const tickers = [...new Set(items.map(i => i.ticker))];
  await Promise.allSettled(tickers.map(async tk => {
    try {
      const d = await _pFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?range=1d&interval=5m`
      );
      const result = d.chart?.result?.[0];
      if (!result) return;
      const m = result.meta;
      let price = m.regularMarketPrice;
      let prev  = m.chartPreviousClose || m.previousClose;
      if (['GBp', 'GBX', 'GBx'].includes(m.currency)) { price /= 100; prev /= 100; }
      _prices[tk] = { price, prev };
    } catch (_) { /* mantener precio anterior si falla */ }
  }));

  _refreshing = false;
  renderWatchlist();
}

export function renderWatchlist() {
  const items = D.watchlist || [];
  const tbody = document.getElementById('wlBody');
  const empty = document.getElementById('wlEmpty');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = items.map((item, i) => {
    const pd = _prices[item.ticker];
    const hasPrice = pd && isFinite(pd.price);
    const price = hasPrice ? pd.price : null;
    const prev  = hasPrice ? pd.prev  : null;
    const chg   = hasPrice && isFinite(prev) ? price - prev : null;
    const pct   = hasPrice && prev ? (chg / prev) * 100 : null;
    const dailyPos = chg != null ? chg >= 0 : null;

    // Verde cuando el precio llega o baja del objetivo
    const hit     = hasPrice && price <= item.targetPrice;
    const distPct = hasPrice ? ((price - item.targetPrice) / item.targetPrice * 100) : null;

    const inEditMode = document.body.classList.contains('edit-mode');
    const tickerColor = !hasPrice ? 'var(--text-muted)' : (hit ? 'var(--green)' : 'var(--red)');

    return `<tr style="${hit ? 'background:rgba(34,223,138,.07);' : ''}cursor:default">
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${tickerColor}">
        ${item.ticker}
        ${hit ? '<span style="font-size:9px;background:rgba(34,223,138,.2);color:var(--green);border-radius:4px;padding:1px 5px;margin-left:6px;letter-spacing:.5px">TARGET</span>' : ''}
      </td>
      <td style="color:var(--text-muted);font-size:12px">${item.name || '—'}</td>
      <td style="font-family:'IBM Plex Mono',monospace;${hit ? 'color:var(--green);font-weight:700;' : ''}">
        ${hasPrice ? F2(price) : '<span style="color:var(--text-muted)">—</span>'}
        <span style="font-size:10px;color:var(--text-muted)">${item.currency}</span>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace">
        ${F2(item.targetPrice)}
        <span style="font-size:10px;color:var(--text-muted)">${item.currency}</span>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${hit ? 'var(--green)' : (distPct != null && distPct < 0 ? 'var(--red)' : 'var(--text-muted)')}">
        ${distPct != null ? (distPct >= 0 ? '+' : '') + distPct.toFixed(2) + '%' : '—'}
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${dailyPos === null ? 'var(--text-muted)' : (dailyPos ? 'var(--green)' : 'var(--red)')}">
        ${pct != null ? (dailyPos ? '+' : '') + pct.toFixed(2) + '%' : '—'}
      </td>
      <td>
        ${inEditMode ? `<button class="btn btn-sm wl-del-btn" data-wl-idx="${i}"
          style="padding:2px 8px;font-size:11px;color:var(--red);border-color:rgba(255,68,102,.3)"
          title="Remove">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

export function initWatchlist() {
  // ── Formulario de añadir ─────────────────────────────────
  const form = document.getElementById('wlForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ticker      = (document.getElementById('wlTicker').value  || '').trim().toUpperCase();
      const targetPrice = parseFloat(document.getElementById('wlTarget').value);
      const currency    = document.getElementById('wlCurrency').value || 'USD';
      const name        = (document.getElementById('wlName').value    || '').trim();
      if (!ticker || !isFinite(targetPrice) || targetPrice <= 0) return;
      if (!D.watchlist) D.watchlist = [];
      D.watchlist.push({ ticker, targetPrice, currency, name });
      saveAndSync();
      form.reset();
      document.getElementById('wlCurrency').value = 'USD';
      renderWatchlist();
      refreshWatchlist();
    });
  }

  // ── Delegación: botón eliminar ───────────────────────────
  document.addEventListener('click', e => {
    const btn = e.target.closest('.wl-del-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.wlIdx);
    if (!D.watchlist || isNaN(idx) || idx < 0 || idx >= D.watchlist.length) return;
    D.watchlist.splice(idx, 1);
    saveAndSync();
    renderWatchlist();
  });
}
