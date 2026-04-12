// ============================================================
//  app.js — Punto de entrada. Orquesta todos los módulos.
// ============================================================
import { loadData } from './storage.js';
import { fetchDataFromCloud, updateSyncStatus, migrateFromGAS } from './cloud.js';
import { refreshPortfolio, renderPortfolio, renderHistory, toggleHoldingDetail } from './portfolio.js';
import { renderTrades, toggleTradeDetail } from './trades.js';
import { addGymEntry, renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';
import { openEditModal, openAddModal, closeModal } from './modals.js';
import { authThenAction, checkAuth, restoreSession } from './auth.js';
import { toast } from './utils.js';
import { renderAnalytics, renderBenchmark } from './analytics.js';
import { renderCalculator, syncCalculatorCapital } from './calculator.js';

// ── Render completo de todas las secciones ───────────────────
function renderAll() {
  renderPortfolio();
  renderTrades();
  renderGym();
  renderBooks();
  renderMovies();
  renderSeries();
  renderHistory();
  renderAnalytics();
}

// ── Ejecuta una acción que requiere auth ─────────────────────
function doAction(action) {
  if (action === 'addBook') openAddModal('book');
  else if (action === 'addMovie') openAddModal('movie');
  else if (action === 'addSeries') openAddModal('serie');
  else if (action === 'addTrade') openAddModal('trade');
  else if (action === 'addHolding') openAddModal('holding');
}

// ── Helper: aplicar estado autenticado a la UI (modo lectura por defecto) ──
function _applyAuthUI() {
  // Solo revela el botón Admin; los botones de edición permanecen ocultos
  // hasta que el usuario active explícitamente el modo edición.
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = '';
  const ab = document.getElementById('btnAuth');
  if (ab) { ab.innerHTML = '&#x1F513; Authed'; ab.classList.add('btn-g'); }
}

// ── Modo edición: muestra/oculta controles de escritura ───────────────
let _editMode = false;
let _activeTab = 'portfolio';

// btnAddTrade solo visible cuando (edit mode) Y (pestaña activa = trades)
function _syncTradeBtn() {
  const btn = document.getElementById('btnAddTrade');
  if (btn) btn.style.display = (_editMode && _activeTab === 'trades') ? '' : 'none';
}

function _applyEditMode(on) {
  _editMode = on;
  document.body.classList.toggle('edit-mode', on);
  // Los elementos .add-section se muestran/ocultan mediante CSS (body.edit-mode .add-section)
  // btnAddTrade tiene lógica especial (tab + edit-mode) gestionada por _syncTradeBtn
  _syncTradeBtn();
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.innerHTML = on ? '&#x270F;&#xFE0E; Editing' : '&#x270F; Edit';
  // Al desactivar el modo edición se hace un renderAll para limpiar cualquier
  // elemento de UI de edición que quedara visible (tarjetas, atributos, etc.)
  if (on) renderPortfolio();
  else renderAll();
}

// ── Flag de bloqueo de vista (view-lock) ───────────────────────
let _lockMode = false;
let _rfInterval = null;

// ── Post-auth: render + fetch + intervalo ────────────────────
async function _postAuthInit() {
  renderAll();
  renderCalculator();
  refreshPortfolio();
  if (!_rfInterval) _rfInterval = setInterval(refreshPortfolio, 60000);
  const ok = await fetchDataFromCloud();
  if (ok) renderAll();
  if (!ok) updateSyncStatus('local');
}

// ── Event: autenticación correcta ────────────────────────────────
document.addEventListener('dashboard:auth-success', async e => {
  _lockMode = false;
  document.getElementById('authOv').classList.remove('auth-locked');
  _applyAuthUI();
  await _postAuthInit();
  const pendingAction = e.detail;
  if (pendingAction && pendingAction !== 'none') doAction(pendingAction);
});

// ── Event: acción de acceso rápido (ya autenticado) ──────────
document.addEventListener('dashboard:action', e => { doAction(e.detail); });

// ── Sistema de pestañas ──────────────────────────────────────
let _benchmarkLoaded = false;
document.getElementById('tabBar').addEventListener('click', e => {
  if (!e.target.matches('.tab-btn')) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  const tab = e.target.dataset.tab;
  _activeTab = tab;
  document.getElementById('tab-' + tab).classList.add('active');
  _syncTradeBtn();
  // Carga el benchmark SPY al entrar por primera vez en Analytics (evita fetch innecesario)
  if (tab === 'analytics' && !_benchmarkLoaded) {
    _benchmarkLoaded = true;
    renderBenchmark();
  }
  // Siempre sincroniza la calculadora con el patrimonio actual al abrir Analytics
  if (tab === 'analytics') syncCalculatorCapital();
});

// ── Selector de periodo del benchmark ───────────────────────
document.getElementById('benchmarkBtns')?.addEventListener('click', e => {
  const btn = e.target.closest('.bench-btn');
  if (!btn) return;
  document.querySelectorAll('#benchmarkBtns .bench-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBenchmark();
});

// ── Toggle de tema claro/oscuro ──────────────────────────────
// Dark es el valor por defecto absoluto. Solo se activa light
// cuando el usuario lo selecciona manualmente.
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.documentElement.classList.add('theme-light');
  else document.documentElement.classList.add('theme-dark');
})();

document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  const isLight = html.classList.contains('theme-light');
  html.classList.toggle('theme-light', !isLight);
  html.classList.toggle('theme-dark', isLight);
  localStorage.setItem('theme', isLight ? 'dark' : 'light');
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = isLight ? '☽' : '☀';
});

// ── Listeners de botones de la barra superior ────────────────
document.getElementById('btnRefresh')?.addEventListener('click', () => refreshPortfolio());
document.getElementById('btnAuth')?.addEventListener('click', () => authThenAction('none'));
document.getElementById('btnAdmin')?.addEventListener('click', () => _applyEditMode(!_editMode));
document.getElementById('btnAddHolding')?.addEventListener('click', () => authThenAction('addHolding'));
document.getElementById('btnAddTrade')?.addEventListener('click', () => authThenAction('addTrade'));
document.getElementById('btnAddBook')?.addEventListener('click', () => authThenAction('addBook'));
document.getElementById('btnAddMovie')?.addEventListener('click', () => authThenAction('addMovie'));
document.getElementById('btnAddSeries')?.addEventListener('click', () => authThenAction('addSeries'));
document.getElementById('btnGymAdd')?.addEventListener('click', () => addGymEntry());

// ── Listeners del overlay de auth ────────────────────────────
document.getElementById('btnAuthCancel')?.addEventListener('click', () => {
  // En view-lock, no se puede cancelar; redirigir al campo de contraseña
  if (_lockMode) { document.getElementById('authPw')?.focus(); return; }
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
    if (_lockMode) { document.getElementById('authPw')?.focus(); return; }
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
document.addEventListener('click', function (e) {  // En modo lectura no se procesa ninguna edición
  if (!document.body.classList.contains('edit-mode')) {
    // Accordion de holding al hacer clic en tarjeta (modo lectura)
    const stock = e.target.closest('.stock[data-detail-idx]');
    if (stock) { toggleHoldingDetail(stock, parseInt(stock.dataset.detailIdx)); return; }
    // Accordion de trade cerrado al hacer clic en fila (siempre disponible en lectura)
    const tradeRow = e.target.closest('tr[data-trade-idx]');
    if (tradeRow && !e.target.closest('tr.trade-detail-row')) {
      toggleTradeDetail(tradeRow, parseInt(tradeRow.dataset.tradeIdx)); return;
    }
    return;
  }
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
  document.getElementById('gymDate').value = new Date().toISOString().slice(0, 10);

  // Icono del botón de tema al estado actual
  const btnTheme = document.getElementById('btnTheme');
  if (btnTheme) {
    const isLight = document.documentElement.classList.contains('theme-light');
    btnTheme.textContent = isLight ? '☀' : '☽';
  }

  // Sin view-lock: la app carga directamente.
  // Si hay sesión activa, revelar controles de edición.
  if (restoreSession()) _applyAuthUI();
  await _postAuthInit();

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && !_lockMode) {
      const ok = await fetchDataFromCloud();
      if (ok) renderAll();
    }
  });

  window.addEventListener('online', () => toast('Back online', 'ok'));
  window.addEventListener('offline', () => toast('Sin conexión — mostrando datos en caché', 'err'));
}

init();

// ── Migration Bridge ─────────────────────────────────────────
// Hide notice if user previously dismissed permanently
if (localStorage.getItem('HIDE_MIGRATION_NOTICE') === '1') {
  const bar = document.getElementById('migration-bar');
  if (bar) bar.style.display = 'none';
}

document.getElementById('btn-migrate-logic')?.addEventListener('click', async () => {
  // Step 1: broker warning
  const step1 = confirm(
    '\u26A0\uFE0F MARKET VOLATILITY WARNING\n\n' +
    'You are about to initiate a cross-platform asset liquidation.\n' +
    'This operation will migrate all data from Google Legacy Servers to the Supabase High-Frequency Vault.\n\n' +
    'Do you wish to proceed with this high-risk maneuver?'
  );
  if (!step1) {
    if (confirm('Hide this migration notice permanently?')) {
      localStorage.setItem('HIDE_MIGRATION_NOTICE', '1');
      const bar = document.getElementById('migration-bar');
      if (bar) bar.style.display = 'none';
    }
    return;
  }

  // Step 2: double-check
  const step2 = confirm(
    '\uD83D\uDEA8 FINAL AUTHORIZATION\n\n' +
    'This action is irreversible and will overwrite any existing data in the new Vault.\n\n' +
    'Are you ABSOLUTELY certain? (Your future wealth depends on this).'
  );
  if (!step2) return;

  // Step 3: authentication
  const password = prompt(
    '\uD83D\uDD10 ENCRYPTED ACCESS REQUIRED\n\n' +
    'Please enter your Master Access Key (Password or Hash) to authorize the data bridge.\n' +
    '(Leave blank if your GAS endpoint does not require authentication.)'
  );
  // null = cancelled
  if (password === null) return;

  const btn = document.getElementById('btn-migrate-logic');
  btn.disabled = true;
  btn.textContent = 'Executing bridge...';

  const ok = await migrateFromGAS(password);
  if (ok) {
    alert('\u2705 MIGRATION SUCCESSFUL. Assets secured in the new Vault.\n\nThe page will now reload.');
    location.reload();
  } else {
    btn.disabled = false;
    btn.textContent = '\uD83D\uDE80 Migrate from Google';
  }
});

document.getElementById('btn-migrate-dismiss')?.addEventListener('click', () => {
  if (confirm('Hide this migration notice permanently?')) {
    localStorage.setItem('HIDE_MIGRATION_NOTICE', '1');
  }
  const bar = document.getElementById('migration-bar');
  if (bar) bar.style.display = 'none';
});
