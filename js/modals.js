// ============================================================
//  modals.js — Modales de edición y alta
//
//  Las funciones criticas se exponen en window.* para que los
//  atributos onclick del HTML de los modales puedan invocarlas
//  sin necesidad de importar este módulo en el HTML.
// ============================================================
import { D } from './state.js';
import { _authed } from './state.js';
import { saveAndSync } from './cloud.js';
import { renderPortfolio, renderHistory } from './portfolio.js';
import { renderTrades } from './trades.js';
import { renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';

// ── Helpers de validación inline ─────────────────────────────
function _showErr(msg) {
  const el = document.getElementById('formErr');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function _clearErr() {
  const el = document.getElementById('formErr');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ── Helper: estado de carga en botón de modal ────────────────
function _setBtnLoading(btnId, on, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.origText = btn.textContent; btn.textContent = 'Saving…'; }
  else btn.textContent = label || btn.dataset.origText || 'Save';
}

// ── Helper: leer valor de input por id ──────────────────────
const g = id => document.getElementById(id);

// ── Cerrar modal ─────────────────────────────────────────────
export function closeModal() { document.getElementById('ov').classList.remove('open'); }
window.closeModal = closeModal;

// ── Abrir modal de edición ───────────────────────────────────
export function openEditModal(type, idx) {
  if (!_authed) return;
  const m = document.getElementById('mod');
  let f = '';

  if (type === 'book') {
    const b = D.books[idx];
    f = `<h2>Edit Book</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(b.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Author</label><input id="eAuthor" value="${(b.author || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Goodreads rating</label><input type="number" id="eGr" step="0.01" value="${b.grRating || ''}"></div>
      <div class="fg"><label>Pages</label><input type="number" id="ePages" value="${b.pages || ''}"></div>
      <div class="fg"><label>Year</label><input id="eYear" value="${b.year || ''}"></div>
      <div class="fg"><label>My rating (0-5)</label><input type="number" id="eMy" step="0.25" min="0" max="5" value="${b.myRating != null ? b.myRating : ''}"></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${b.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('book',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('book',${idx})">Save</button>
      </div>`;
  } else if (type === 'movie') {
    const mv = D.movies[idx];
    f = `<h2>Edit Movie</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(mv.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Director</label><input id="eDir" value="${(mv.director || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Filmaffinity rating</label><input type="number" id="eFa" step="0.1" value="${mv.faRating || ''}"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="eMy" step="0.25" min="0" max="10" value="${mv.myRating != null ? mv.myRating : ''}"></div>
      <div class="fg"><label>Duration</label><input id="eDur" value="${mv.duration || ''}"></div>
      <div class="fg"><label>Year</label><input type="number" id="eYear" value="${mv.year || ''}"></div>
      <div class="fg"><label>Platform</label><input id="ePlat" value="${(mv.platform || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Actors</label><input id="eAct" value="${(mv.actors || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${mv.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('movie',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('movie',${idx})">Save</button>
      </div>`;
  } else if (type === 'serie') {
    const s = D.series[idx];
    f = `<h2>Edit Series</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(s.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>IMDB rating</label><input type="number" id="eImdb" step="0.1" value="${s.imdbRating || ''}"></div>
      <div class="fg"><label>Seasons</label><input type="number" id="eSeasons" value="${s.seasons || ''}"></div>
      <div class="fg"><label>Ep length</label><input id="eEpLen" value="${s.epLength || ''}"></div>
      <div class="fg"><label>Platform</label><input id="ePlat" value="${(s.platform || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Years</label><input id="eYears" value="${s.years || ''}"></div>
      <div class="fg"><label>Watched</label><input id="eWatched" value="${(s.watched || '').replace(/"/g, '&quot;')}" placeholder="Finished / 3 seasons / Up to date"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="eMy" step="0.25" min="0" max="10" value="${s.myRating != null ? s.myRating : ''}"></div>
      <div class="fg"><label>Want to finish?</label><select id="eWant">
        <option value="">-</option>
        <option value="Yes" ${s.wantFinish === 'S\u00ed' || s.wantFinish === 'Yes' ? 'selected' : ''}>Yes</option>
        <option value="No" ${s.wantFinish === 'No' ? 'selected' : ''}>No</option>
        <option value="Rewatch" ${s.wantFinish === 'Volver a verla' || s.wantFinish === 'Rewatch' ? 'selected' : ''}>Rewatch</option>
      </select></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${s.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('serie',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('serie',${idx})">Save</button>
      </div>`;
  } else if (type === 'cash') {
    f = `<h2>Edit Cash & Totals</h2>
      <div class="fg"><label>Cash (EUR)</label><input type="number" id="eCash" step="0.01" value="${D.cash}"></div>
      <div class="fg"><label>Total invested (EUR)</label><input type="number" id="eInvested" step="1" value="${D.totalInvested}"></div>
      <div class="m-btns">
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('cash',0)">Save</button>
      </div>`;
  } else if (type === 'holding') {
    const h = D.holdings[idx];
    f = `<h2>Edit Position</h2>
      <div class="fg"><label>Ticker</label><input id="eHTicker" value="${(h.ticker || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Name</label><input id="eHName" value="${(h.name || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Shares</label><input type="number" id="eHShares" value="${h.shares || ''}"></div>
      <div class="fg"><label>Entry price (${h.currency})</label><input type="number" id="eHEntry" step="0.0001" value="${h.entryPrice || ''}"></div>
      <div class="fg"><label>Currency</label><select id="eHCur">
        <option ${h.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option ${h.currency === 'CAD' ? 'selected' : ''}>CAD</option>
        <option ${h.currency === 'GBP' ? 'selected' : ''}>GBP</option>
        <option ${h.currency === 'EUR' ? 'selected' : ''}>EUR</option>
      </select></div>
      <div class="fg"><label>Exchange</label><input id="eHExch" value="${(h.exchange || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Color</label><input id="eHColor" value="${h.color || '#5588ff'}"></div>
      <div class="fg"><label>Dividends received (total, ${h.currency})</label><input type="number" id="eHDiv" step="0.01" value="${h.dividends || ''}"></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns" style="flex-wrap:wrap">
        <button class="btn btn-r" onclick="window.modalDelete('holding',${idx})">Delete</button>
        <button class="btn btn-amber" onclick="window.openClosePositionModal(${idx})">Close Position</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('holding',${idx})">Save</button>
      </div>`;
  } else if (type === 'trade') {
    const t = D.closedTrades[idx];
    f = `<h2>Edit Trade</h2>
      <div class="fg"><label>Ticker</label><input id="eTTicker" value="${(t.ticker || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Name</label><input id="eTName" value="${(t.name || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Currency</label><select id="eTCur">
        <option ${t.currency === 'EUR' ? 'selected' : ''}>EUR</option>
        <option ${t.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option ${t.currency === 'CAD' ? 'selected' : ''}>CAD</option>
        <option ${t.currency === 'GBP' ? 'selected' : ''}>GBP</option>
      </select></div>
      <div class="fg"><label>Total shares</label><input type="number" id="eTShares" value="${t.totalShares || ''}"></div>
      <div class="fg"><label>Avg buy price</label><input type="number" id="eTBuy" step="0.0001" value="${t.avgBuy || ''}"></div>
      <div class="fg"><label>Sell price</label><input type="number" id="eTSell" step="0.0001" value="${t.sellPrice || ''}"></div>
      <div class="fg"><label>Lots</label><input id="eTLots" value="${(t.lots || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Color</label><input id="eTColor" value="${t.color || '#667788'}"></div>
      <div class="fg"><label>Dividends received (total, ${t.currency})</label><input type="number" id="eTDiv" step="0.01" value="${t.dividends || ''}"></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('trade',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('trade',${idx})">Save</button>
      </div>`;
  } else if (type === 'gym') {
    // idx es la fecha (string) en el caso del gym
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx < 0) return;
    const gym = D.gym[gIdx];
    f = `<h2>Edit Entry</h2>
      <div class="fg"><label>Date</label><input type="date" id="eGDate" value="${gym.date || ''}"></div>
      <div class="fg"><label>Weight (kg)</label><input type="number" id="eGWeight" step="0.1" value="${gym.weight != null ? gym.weight : ''}"></div>
      <div class="fg"><label>Body Fat (%)</label><input type="number" id="eGBf" step="0.1" value="${gym.bf != null ? gym.bf : ''}"></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('gym','${gym.date}')">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('gym','${gym.date}')">Save</button>
      </div>`;
  }

  m.innerHTML = f;
  document.getElementById('ov').classList.add('open');
}
window.openEditModal = openEditModal;

// ── Guardar edición desde modal ──────────────────────────────
window.modalSave = function (type, idx) {
  if (type === 'book') {
    D.books[idx] = {
      title: g('eTitle').value,
      author: g('eAuthor').value,
      grRating: parseFloat(g('eGr').value) || 0,
      pages: parseInt(g('ePages').value) || 0,
      year: g('eYear').value,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      opinion: g('eOp').value
    };
    closeModal(); renderBooks(); saveAndSync();
  } else if (type === 'movie') {
    D.movies[idx] = {
      title: g('eTitle').value,
      director: g('eDir').value,
      faRating: parseFloat(g('eFa').value) || 0,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      duration: g('eDur').value,
      year: parseInt(g('eYear').value) || 0,
      platform: g('ePlat').value,
      actors: g('eAct').value,
      opinion: g('eOp').value
    };
    closeModal(); renderMovies(); saveAndSync();
  } else if (type === 'serie') {
    D.series[idx] = {
      title: g('eTitle').value,
      imdbRating: parseFloat(g('eImdb').value) || 0,
      seasons: parseInt(g('eSeasons').value) || 1,
      epsPerSeason: '',
      epLength: g('eEpLen').value,
      platform: g('ePlat').value,
      years: g('eYears').value,
      watched: g('eWatched').value,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      wantFinish: g('eWant').value,
      opinion: g('eOp').value
    };
    closeModal(); renderSeries(); saveAndSync();
  } else if (type === 'cash') {
    const c = parseFloat(g('eCash').value);
    const t = parseFloat(g('eInvested').value);
    if (!isNaN(c) && c >= 0) D.cash = c;
    if (!isNaN(t) && t >= 0) D.totalInvested = t;
    closeModal(); renderPortfolio(); saveAndSync();
  } else if (type === 'holding') {
    D.holdings[idx] = {
      ...D.holdings[idx],
      ticker: g('eHTicker').value.toUpperCase(),
      name: g('eHName').value,
      shares: parseInt(g('eHShares').value) || 0,
      entryPrice: parseFloat(g('eHEntry').value) || 0,
      currency: g('eHCur').value,
      exchange: g('eHExch').value,
      color: g('eHColor').value,
      dividends: parseFloat(g('eHDiv').value) || 0
    };
    closeModal(); renderPortfolio(); renderHistory(); saveAndSync();
  } else if (type === 'trade') {
    D.closedTrades[idx] = {
      ...D.closedTrades[idx],
      ticker: g('eTTicker').value.toUpperCase(),
      name: g('eTName').value,
      currency: g('eTCur').value,
      totalShares: parseInt(g('eTShares').value) || 0,
      avgBuy: parseFloat(g('eTBuy').value) || 0,
      sellPrice: parseFloat(g('eTSell').value) || 0,
      lots: g('eTLots').value,
      color: g('eTColor').value,
      dividends: parseFloat(g('eTDiv').value) || 0
    };
    closeModal(); renderTrades(); saveAndSync();
  } else if (type === 'gym') {
    // idx es la fecha original del gym
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx < 0) return;
    const nd = g('eGDate').value;
    const nw = parseFloat(g('eGWeight').value);
    const nb = parseFloat(g('eGBf').value);
    D.gym[gIdx] = { date: nd || idx, weight: isNaN(nw) ? null : nw, bf: isNaN(nb) ? null : nb };
    D.gym.sort((a, b) => a.date.localeCompare(b.date));
    closeModal(); renderGym(); saveAndSync();
  }
};

// ── Eliminar entrada desde modal ─────────────────────────────
window.modalDelete = function (type, idx) {
  const msgs = { book: 'Delete this book?', movie: 'Delete this movie?', serie: 'Delete this series?', holding: 'Delete this position?', trade: 'Delete this trade?', gym: 'Delete this entry?' };
  if (!confirm(msgs[type] || 'Delete?')) return;
  if (type === 'book') { D.books.splice(idx, 1); closeModal(); renderBooks(); saveAndSync(); }
  else if (type === 'movie') { D.movies.splice(idx, 1); closeModal(); renderMovies(); saveAndSync(); }
  else if (type === 'serie') { D.series.splice(idx, 1); closeModal(); renderSeries(); saveAndSync(); }
  else if (type === 'holding') { D.holdings.splice(idx, 1); closeModal(); renderPortfolio(); saveAndSync(); }
  else if (type === 'trade') { D.closedTrades.splice(idx, 1); closeModal(); renderTrades(); saveAndSync(); }
  else if (type === 'gym') {
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx >= 0) { D.gym.splice(gIdx, 1); closeModal(); renderGym(); saveAndSync(); }
  }
};

// ── Abrir modal de alta ──────────────────────────────────────
export function openAddModal(type) {
  const m = document.getElementById('mod');
  let f = '';
  if (type === 'book') {
    f = `<h2>Add Book</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>Author</label><input id="aAuthor"></div>
      <div class="fg"><label>Goodreads rating</label><input type="number" id="aGr" step="0.01"></div>
      <div class="fg"><label>Pages</label><input type="number" id="aPages"></div>
      <div class="fg"><label>Year</label><input id="aYear"></div>
      <div class="fg"><label>My rating (0-5)</label><input type="number" id="aMy" step="0.25" min="0" max="5"></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('book')">Add</button></div>`;
  } else if (type === 'movie') {
    f = `<h2>Add Movie</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>Director</label><input id="aDir"></div>
      <div class="fg"><label>Filmaffinity rating</label><input type="number" id="aFa" step="0.1"></div>
      <div class="fg"><label>Duration</label><input id="aDur" placeholder="2h 30 min"></div>
      <div class="fg"><label>Year</label><input type="number" id="aYear"></div>
      <div class="fg"><label>Platform</label><input id="aPlat"></div>
      <div class="fg"><label>Actors</label><input id="aAct"></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('movie')">Add</button></div>`;
  } else if (type === 'serie') {
    f = `<h2>Add Series</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>IMDB rating</label><input type="number" id="aImdb" step="0.1"></div>
      <div class="fg"><label>Seasons</label><input type="number" id="aSeasons"></div>
      <div class="fg"><label>Ep length</label><input id="aEpLen" placeholder="1h"></div>
      <div class="fg"><label>Platform</label><input id="aPlat"></div>
      <div class="fg"><label>Years</label><input id="aYears" placeholder="2020-2024"></div>
      <div class="fg"><label>Watched</label><input id="aWatched" placeholder="Finished / 2 seasons / Up to date"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="aMy" step="0.25" min="0" max="10"></div>
      <div class="fg"><label>Want to finish?</label><select id="aWant"><option value="">-</option><option value="Yes">Yes</option><option value="No">No</option><option value="Rewatch">Rewatch</option></select></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('serie')">Add</button></div>`;
  } else if (type === 'trade') {
    f = `<h2>Add Closed Trade</h2>
      <div class="fg"><label>Ticker *</label><input id="aTicker" autofocus placeholder="AAPL"></div>
      <div class="fg"><label>Name</label><input id="aName"></div>
      <div class="fg"><label>Currency</label><select id="aCur"><option>EUR</option><option>USD</option><option>CAD</option><option>GBP</option></select></div>
      <div class="fg"><label>Total shares *</label><input type="number" id="aShares" min="1"></div>
      <div class="fg"><label>Avg buy price *</label><input type="number" id="aAvgBuy" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Sell price *</label><input type="number" id="aSell" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Lots (optional)</label><input id="aLots" placeholder="100@5.00 + 50@5.50"></div>
      <div class="fg"><label>Color</label><input id="aColor" value="#667788"></div>
      <div class="fg"><label>Dividends received (total, in selected currency)</label><input type="number" id="aDiv" step="0.01"></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('trade')">Add</button></div>`;
  } else if (type === 'holding') {
    f = `<h2>Add Position</h2>
      <div class="fg"><label>Ticker *</label><input id="aHTicker" autofocus placeholder="AAPL"></div>
      <div class="fg"><label>Name</label><input id="aHName"></div>
      <div class="fg"><label>Currency</label><select id="aHCur"><option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option></select></div>
      <div class="fg"><label>Exchange</label><input id="aHExch" placeholder="NYSE / LSE / TSX"></div>
      <div class="fg"><label>Shares *</label><input type="number" id="aHShares" min="1"></div>
      <div class="fg"><label>Entry price *</label><input type="number" id="aHEntry" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Color</label><input id="aHColor" value="#5588ff"></div>
      <div class="fg"><label>Dividends received (total, in selected currency)</label><input type="number" id="aHDiv" step="0.01"></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('holding')">Add</button></div>`;
  }
  m.innerHTML = f;
  document.getElementById('ov').classList.add('open');
}
window.openAddModal = openAddModal;

// ── Guardar nuevo elemento desde modal ───────────────────────
window.saveAdd = function (type) {
  _clearErr();
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const gvRaw = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  if (type === 'book') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.books.push({ title: t, author: gv('aAuthor'), grRating: parseFloat(gvRaw('aGr')) || 0, pages: parseInt(gvRaw('aPages')) || 0, year: gv('aYear'), myRating: gvRaw('aMy') ? parseFloat(gvRaw('aMy')) : null, opinion: gvRaw('aOp') });
    renderBooks();
  } else if (type === 'movie') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.movies.push({ title: t, director: gv('aDir'), faRating: parseFloat(gvRaw('aFa')) || 0, duration: gv('aDur'), year: parseInt(gvRaw('aYear')) || 0, platform: gv('aPlat'), actors: gv('aAct'), opinion: gvRaw('aOp') });
    renderMovies();
  } else if (type === 'serie') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.series.push({ title: t, imdbRating: parseFloat(gvRaw('aImdb')) || 0, seasons: parseInt(gvRaw('aSeasons')) || 1, epsPerSeason: '', epLength: gv('aEpLen'), platform: gv('aPlat'), years: gv('aYears'), watched: gv('aWatched'), myRating: gvRaw('aMy') ? parseFloat(gvRaw('aMy')) : null, wantFinish: gvRaw('aWant'), opinion: gvRaw('aOp') });
    renderSeries();
  } else if (type === 'trade') {
    const tk = gv('aTicker');
    if (!tk) { _showErr('Ticker is required'); return; }
    const sh = parseInt(gvRaw('aShares'));
    const ab = parseFloat(gvRaw('aAvgBuy'));
    const sp = parseFloat(gvRaw('aSell'));
    if (!sh || sh <= 0) { _showErr('Shares must be a positive whole number'); return; }
    if (!ab || ab <= 0) { _showErr('Avg buy price must be a positive number'); return; }
    if (!sp || sp <= 0) { _showErr('Sell price must be a positive number'); return; }
    D.closedTrades.push({ ticker: tk.toUpperCase(), name: gv('aName'), currency: gvRaw('aCur'), color: gvRaw('aColor') || '#667788', totalShares: sh, avgBuy: ab, sellPrice: sp, dividends: parseFloat(gvRaw('aDiv')) || 0, lots: gv('aLots') });
    renderTrades();
  } else if (type === 'holding') {
    const tk = gv('aHTicker');
    if (!tk) { _showErr('Ticker is required'); return; }
    const sh = parseInt(gvRaw('aHShares'));
    const ep = parseFloat(gvRaw('aHEntry'));
    if (!sh || sh <= 0) { _showErr('Shares must be a positive whole number'); return; }
    if (!ep || ep <= 0) { _showErr('Entry price must be a positive number'); return; }
    D.holdings.push({ ticker: tk.toUpperCase(), name: gv('aHName'), currency: gvRaw('aHCur'), exchange: gv('aHExch'), shares: sh, entryPrice: ep, color: gvRaw('aHColor') || '#5588ff', dividends: parseFloat(gvRaw('aHDiv')) || 0 });
    renderPortfolio();
    renderHistory();
  }
  closeModal();
  saveAndSync();
};

// ── Modal: cerrar posición abierta → moverla a closedTrades ──
window.openClosePositionModal = function (holdingIdx) {
  const h = D.holdings[holdingIdx];
  if (!h) return;
  const m = document.getElementById('mod');
  m.innerHTML = `<h2>Close Position</h2>
    <p>${h.name || h.ticker} &mdash; ${h.shares} shares &bull; avg buy ${h.entryPrice} ${h.currency}</p>
    <div class="fg"><label>Sell price (${h.currency}) *</label>
      <input type="number" id="cSell" step="0.0001" min="0.0001" autofocus placeholder="0.0000">
    </div>
    <div class="fg"><label>Lots (optional)</label>
      <input id="cLots" placeholder="200@12.50">
    </div>
    <div id="formErr" class="form-err"></div>
    <div class="m-btns">
      <button class="btn" onclick="window.openEditModal('holding',${holdingIdx})">&#8592; Back</button>
      <button class="btn btn-r" id="btnClosePos" onclick="window.saveClosePosition(${holdingIdx})">Confirm Close</button>
    </div>`;
};
window.openClosePositionModal = window.openClosePositionModal;

// ── Confirmar cierre: mueve holding → closedTrades ─────────
window.saveClosePosition = async function (holdingIdx) {
  const sellVal = document.getElementById('cSell')?.value;
  const sell = parseFloat(sellVal);
  if (!sellVal || isNaN(sell) || sell <= 0) {
    _showErr('Sell price is required and must be greater than 0');
    return;
  }

  const h = D.holdings[holdingIdx];
  if (!h) return;

  _setBtnLoading('btnClosePos', true);

  const trade = {
    ticker: h.ticker,
    name: h.name || h.ticker,
    currency: h.currency,
    color: h.color || '#667788',
    totalShares: h.shares,
    avgBuy: h.entryPrice,
    sellPrice: sell,
    dividends: h.dividends || 0,
    lots: document.getElementById('cLots')?.value || ''
  };

  D.holdings.splice(holdingIdx, 1);
  D.closedTrades.push(trade);

  closeModal();
  renderPortfolio();
  renderTrades();
  renderHistory();

  await saveAndSync();
};
