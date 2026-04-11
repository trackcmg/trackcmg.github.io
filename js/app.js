// ============================================================
//  app.js — Punto de entrada. Orquesta todos los módulos.
// ============================================================
import { loadData } from './storage.js';
import { fetchDataFromCloud, updateSyncStatus } from './cloud.js';
import { refreshPortfolio, renderPortfolio, renderHistory } from './portfolio.js';
import { renderTrades } from './trades.js';
import { addGymEntry, renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';
import { openEditModal, openAddModal, closeModal } from './modals.js';
import { authThenAction, checkAuth } from './auth.js';

// ── Render completo de todas las secciones ───────────────────
function renderAll() {
  renderPortfolio();
  renderTrades();
  renderGym();
  renderBooks();
  renderMovies();
  renderSeries();
  renderHistory();
}

// ── Ejecuta una acción que requiere auth ─────────────────────
function doAction(action) {
  if (action === 'addBook') openAddModal('book');
  else if (action === 'addMovie') openAddModal('movie');
  else if (action === 'addSeries') openAddModal('serie');
  else if (action === 'addTrade') openAddModal('trade');
  else if (action === 'addHolding') openAddModal('holding');
}

// ── Event: autenticación correcta ────────────────────────────
document.addEventListener('dashboard:auth-success', e => {
  // Mostrar botones de edición
  ['btnAddTrade', 'btnAddBook', 'btnAddMovie', 'btnAddSeries', 'btnAddHolding', 'gymForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  // Actualizar botón auth
  const ab = document.getElementById('btnAuth');
  if (ab) { ab.innerHTML = '&#x1F513; Unlocked'; ab.classList.add('btn-g'); }

  // Rerender con estado autenticado
  renderAll();

  // Sincronizar con la nube si no estaba listo
  fetchDataFromCloud().then(ok => {
    if (ok) renderAll();
    updateSyncStatus('local');
  });

  // Ejecutar acción pendiente
  const pendingAction = e.detail;
  if (pendingAction && pendingAction !== 'none') doAction(pendingAction);
});

// ── Event: acción de acceso rápido (ya autenticado) ──────────
document.addEventListener('dashboard:action', e => { doAction(e.detail); });

// ── Sistema de pestañas ──────────────────────────────────────
document.getElementById('tabBar').addEventListener('click', e => {
  if (!e.target.matches('.tab-btn')) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('tab-' + e.target.dataset.tab).classList.add('active');
});

// ── Listeners de botones de la barra superior ────────────────
document.getElementById('btnRefresh')?.addEventListener('click', () => refreshPortfolio());
document.getElementById('btnAuth')?.addEventListener('click', () => authThenAction('none'));
document.getElementById('btnAddHolding')?.addEventListener('click', () => authThenAction('addHolding'));
document.getElementById('btnAddTrade')?.addEventListener('click', () => authThenAction('addTrade'));
document.getElementById('btnAddBook')?.addEventListener('click', () => authThenAction('addBook'));
document.getElementById('btnAddMovie')?.addEventListener('click', () => authThenAction('addMovie'));
document.getElementById('btnAddSeries')?.addEventListener('click', () => authThenAction('addSeries'));
document.getElementById('btnGymAdd')?.addEventListener('click', () => addGymEntry());

// ── Listeners del overlay de auth ────────────────────────────
document.getElementById('btnAuthCancel')?.addEventListener('click', () => {
  document.getElementById('authOv').classList.remove('open');
});
document.getElementById('btnAuthSubmit')?.addEventListener('click', () => checkAuth());
document.getElementById('authPw')?.addEventListener('keydown', e => { if (e.key === 'Enter') checkAuth(); });

// ── Cerrar modal al hacer click en el overlay ────────────────
document.getElementById('ov')?.addEventListener('click', e => {
  if (e.target === document.getElementById('ov')) closeModal();
});
document.getElementById('authOv')?.addEventListener('click', e => {
  if (e.target === document.getElementById('authOv')) {
    document.getElementById('authOv').classList.remove('open');
  }
});

// ── Filtros de libros, films y series ────────────────────────
document.getElementById('booksSearch')?.addEventListener('input', () => renderBooks());
document.getElementById('booksSort')?.addEventListener('change', () => renderBooks());
document.getElementById('booksFilter')?.addEventListener('change', () => renderBooks());
document.getElementById('moviesSearch')?.addEventListener('input', () => renderMovies());
document.getElementById('moviesSort')?.addEventListener('change', () => renderMovies());
document.getElementById('moviesFilter')?.addEventListener('change', () => renderMovies());
document.getElementById('seriesSearch')?.addEventListener('input', () => renderSeries());
document.getElementById('seriesSort')?.addEventListener('change', () => renderSeries());
document.getElementById('seriesFilter')?.addEventListener('change', () => renderSeries());

// ── Delegación global: click en tarjetas editables ───────────
document.addEventListener('click', function (e) {
  const card = e.target.closest('.m-card[data-edit-type]');
  if (card) { openEditModal(card.dataset.editType, parseInt(card.dataset.editIdx)); return; }

  const stock = e.target.closest('.stock[data-edit-type]');
  if (stock) {
    if (stock.dataset.editType === 'cash') openEditModal('cash', 0);
    else openEditModal('holding', parseInt(stock.dataset.editIdx));
    return;
  }

  const row = e.target.closest('tr[data-edit-type]');
  if (row) {
    if (row.dataset.editType === 'trade') openEditModal('trade', parseInt(row.dataset.editIdx));
    else if (row.dataset.editType === 'gym') openEditModal('gym', row.dataset.editDate);
  }
});

// ── Inicialización ───────────────────────────────────────────
async function init() {
  loadData();
  renderAll();
  document.getElementById('gymDate').value = new Date().toISOString().slice(0, 10);
  refreshPortfolio();
  setInterval(refreshPortfolio, 60000);

  const ok = await fetchDataFromCloud();
  if (ok) renderAll();
  if (!ok) updateSyncStatus('local');

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const ok = await fetchDataFromCloud();
      if (ok) renderAll();
    }
  });
}

init();
