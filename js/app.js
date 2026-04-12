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
import { initAuth, signIn, signOut } from './auth.js';
import { toast } from './utils.js';
import { renderAnalytics, renderBenchmark } from './analytics.js';
import { renderCalculator, syncCalculatorCapital } from './calculator.js';

// ── Render completo de todas las secciones ───────────────────
// Cada módulo se programa como una tarea independiente (setTimeout 0)
// para ceder el hilo principal al navegador entre renders y reducir el TBT.
function renderAll() {
  renderPortfolio();
  setTimeout(() => renderTrades(), 0);
  setTimeout(() => renderGym(), 0);
  setTimeout(() => renderBooks(), 0);
  setTimeout(() => renderMovies(), 0);
  setTimeout(() => renderSeries(), 0);
  setTimeout(() => renderHistory(), 0);
  setTimeout(() => renderAnalytics(), 0);
}

// ── Ejecuta una acción que requiere auth ─────────────────────
function doAction(action) {
  if (action === 'addBook') openAddModal('book');
  else if (action === 'addMovie') openAddModal('movie');
  else if (action === 'addSeries') openAddModal('serie');
  else if (action === 'addTrade') openAddModal('trade');
  else if (action === 'addHolding') openAddModal('holding');
}

// ── Helper: aplicar estado autenticado a la UI ──────────────────
function _applyAuthUI(_user) {
  const lb = document.getElementById('btnLogout');
  if (lb) lb.style.display = '';
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = '';
}

// ── Login overlay helpers ─────────────────────────────────
function _showLoginOverlay() {
  const el = document.getElementById('loginOv');
  if (el) el.style.display = 'flex';
}
function _hideLoginOverlay() {
  const el = document.getElementById('loginOv');
  if (el) el.style.display = 'none';
  const errEl = document.getElementById('loginErr');
  if (errEl) errEl.textContent = '';
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

// ── Flag de bloqueo de vista (eliminado en Fase 7.3) ──────────
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

// ── Handlers de Supabase Auth ─────────────────────────────────
async function _handleLogin(user, isNewLogin) {
  _hideLoginOverlay();
  _applyAuthUI(user);
  await _postAuthInit();
}

function _handleLogout() {
  _applyEditMode(false);
  const lb = document.getElementById('btnLogout');
  if (lb) lb.style.display = 'none';
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = 'none';
  _showLoginOverlay();
}

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
// btnLogout — Sign out
document.getElementById('btnLogout')?.addEventListener('click', () => signOut());
document.getElementById('btnRefresh')?.addEventListener('click', () => refreshPortfolio());
document.getElementById('btnAdmin')?.addEventListener('click', () => _applyEditMode(!_editMode));
document.getElementById('btnAddHolding')?.addEventListener('click', () => doAction('addHolding'));
document.getElementById('btnAddTrade')?.addEventListener('click', () => doAction('addTrade'));
document.getElementById('btnAddBook')?.addEventListener('click', () => doAction('addBook'));
document.getElementById('btnAddMovie')?.addEventListener('click', () => doAction('addMovie'));
document.getElementById('btnAddSeries')?.addEventListener('click', () => doAction('addSeries'));
document.getElementById('btnGymAdd')?.addEventListener('click', () => addGymEntry());

// ── Login overlay: submit handler ─────────────────────────────
async function _doLogin() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const pw    = document.getElementById('loginPw')?.value;
  const errEl = document.getElementById('loginErr');
  const btn   = document.getElementById('btnLogin');
  if (!email || !pw) { if (errEl) errEl.textContent = 'Email and password required.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Authorizing…'; }
  const { error } = await signIn(email, pw);
  if (btn) { btn.disabled = false; btn.textContent = 'Authorize Access'; }
  if (error) {
    if (errEl) errEl.textContent = error.message || 'Invalid credentials.';
  }
  // On success, onAuthStateChange fires automatically → _handleLogin → hides overlay
}
document.getElementById('btnLogin')?.addEventListener('click', _doLogin);
document.getElementById('loginPw')?.addEventListener('keydown', e => { if (e.key === 'Enter') _doLogin(); });
document.getElementById('loginEmail')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPw')?.focus(); });

// ── Cerrar modal genérico al hacer click en el overlay ────────
document.getElementById('ov')?.addEventListener('click', e => {
  if (e.target === document.getElementById('ov')) closeModal();
});
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

  // Ocultar btnAdmin hasta que haya sesión activa
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = 'none';

  // Si hay sesión guardada de Supabase, ocultar el login overlay inmediatamente
  // sin esperar al callback async (elimina el freeze de ~5s en PWA móvil)
  const hasSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (hasSession) _hideLoginOverlay();

  // Render inicial con datos locales (sin esperar a la nube)
  renderAll();
  renderCalculator();

  // Configurar auth de Supabase:
  // onAuthStateChange disparará inmediatamente si hay sesión guardada.
  initAuth(_handleLogin, _handleLogout);

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const ok = await fetchDataFromCloud();
      if (ok) renderAll();
    }
  });

  window.addEventListener('online', () => toast('Back online', 'ok'));
  window.addEventListener('offline', () => toast('Sin conexión — mostrando datos en caché', 'err'));
}

init();

// ════════════════════════════════════════════════════════════════════════════
//  MIGRATION BRIDGE — Hidden Pro Feature
//  Trigger: triple-click on the dashboard title  OR  Ctrl+Shift+M
//  Remove this entire block after a successful migration.
// ════════════════════════════════════════════════════════════════════════════

// SHA-256 helper (Web Crypto API)
async function _sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Inject the migration terminal modal (only once)
function _showMigrationModal() {
  if (document.getElementById('migration-overlay')) return; // already open

  const overlay = document.createElement('div');
  overlay.id = 'migration-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000',
    'background:rgba(6,6,17,.88)', 'display:flex',
    'align-items:center', 'justify-content:center',
    'font-family:"IBM Plex Mono",monospace',
  ].join(';');

  overlay.innerHTML = `
    <div style="background:#0d0d1f;border:1px solid #3a3a7a;border-radius:10px;padding:32px 28px;max-width:480px;width:90%;box-shadow:0 0 40px rgba(85,51,255,.3)">
      <div style="color:#5533ff;font-size:11px;letter-spacing:2px;margin-bottom:4px">// CLASSIFIED TERMINAL v2</div>
      <h2 style="color:#e0e0ff;margin:0 0 6px;font-size:18px">🚀 Migration Bridge</h2>
      <p style="color:#8888aa;font-size:12px;margin:0 0 20px;line-height:1.6">
        Cross-platform asset liquidation from <strong style="color:#5533ff">Google Legacy</strong>
        to <strong style="color:#22df8a">Supabase Vault</strong>.<br>
        This is a one-way, irreversible operation.
      </p>
      <div style="margin-bottom:14px">
        <label style="color:#8888aa;font-size:11px;display:block;margin-bottom:5px">MASTER ACCESS KEY</label>
        <input id="mig-pw" type="password" placeholder="Enter password…"
          style="width:100%;box-sizing:border-box;background:#0a0a1a;border:1px solid #3a3a6a;color:#e0e0ff;padding:9px 12px;border-radius:6px;font-family:inherit;font-size:13px;outline:none">
        <div style="color:#8888aa;font-size:10px;margin-top:4px">Auto-hashed with SHA-256 before transmission. Leave blank if GAS is public.</div>
      </div>
      <div id="mig-status" style="min-height:18px;font-size:11px;color:#22df8a;margin-bottom:16px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="mig-cancel" style="background:transparent;color:#778;border:1px solid #3a3a6a;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:12px">Cancel</button>
        <button id="mig-execute" style="background:#5533ff;color:#fff;border:none;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:13px;font-weight:600">⚡ Execute Bridge</button>
      </div>
      <div style="margin-top:18px;border-top:1px solid #1a1a3a;padding-top:12px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="mig-hide" style="accent-color:#5533ff">
        <label for="mig-hide" style="color:#556;font-size:11px;cursor:pointer">Don't show this tool again</label>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const statusEl  = overlay.querySelector('#mig-status');
  const pwInput   = overlay.querySelector('#mig-pw');
  const executeBtn = overlay.querySelector('#mig-execute');
  const cancelBtn = overlay.querySelector('#mig-cancel');
  const hideChk   = overlay.querySelector('#mig-hide');

  function _close() {
    if (hideChk.checked) localStorage.setItem('HIDE_MIGRATION_NOTICE', '1');
    overlay.remove();
  }

  cancelBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

  executeBtn.addEventListener('click', async () => {
    // Step 1 — broker warning
    const step1 = confirm(
      '\u26A0\uFE0F MARKET VOLATILITY WARNING\n\n' +
      'You are about to initiate a cross-platform asset liquidation from ' +
      'Google Legacy Servers to the Supabase High-Frequency Vault.\n\n' +
      'Do you wish to proceed with this high-risk maneuver?'
    );
    if (!step1) return;

    // Step 2 — double-check
    const step2 = confirm(
      '\uD83D\uDEA8 FINAL AUTHORIZATION\n\n' +
      'This action is irreversible and will overwrite any existing data in the Vault.\n\n' +
      'Are you ABSOLUTELY certain? (Your future wealth depends on this).'
    );
    if (!step2) return;

    executeBtn.disabled = true;
    executeBtn.textContent = 'Connecting…';
    statusEl.style.color = '#5533ff';
    statusEl.textContent = '\u29D7 Hashing credentials…';

    // Auto-hash the password (never send plain text)
    const rawPw  = pwInput.value;
    const pwHash = rawPw ? await _sha256hex(rawPw) : '';

    statusEl.textContent = '\u29D7 Fetching data from Google Legacy Servers…';

    const result = await migrateFromGAS(pwHash);

    if (result && result.ok) {
      statusEl.style.color = '#22df8a';
      statusEl.textContent =
        '\u2705 MIGRATION SUCCESSFUL. Assets Liquidated: ' +
        result.holdings + ' Holdings, ' + result.trades + ' Trades. ' +
        'Database synchronized.';
      if (hideChk.checked) localStorage.setItem('HIDE_MIGRATION_NOTICE', '1');
      setTimeout(() => { alert('\u2705 MIGRATION SUCCESSFUL.\n\nAssets Liquidated: ' + result.holdings + ' Holdings, ' + result.trades + ' Trades.\n\nThe page will now reload.'); location.reload(); }, 600);
    } else {
      statusEl.style.color = 'var(--red, #ff4466)';
      statusEl.textContent = '\u274C TRANSACTION ABORTED. Check console for details.';
      executeBtn.disabled = false;
      executeBtn.textContent = '\u26A1 Execute Bridge';
    }
  });

  setTimeout(() => pwInput.focus(), 80);
}

// — Trigger 1: triple-click on dashboard title
let _titleClickCount = 0, _titleClickTimer = null;
document.querySelector('h1')?.addEventListener('click', () => {
  _titleClickCount++;
  clearTimeout(_titleClickTimer);
  _titleClickTimer = setTimeout(() => { _titleClickCount = 0; }, 600);
  if (_titleClickCount >= 3) {
    _titleClickCount = 0;
    if (localStorage.getItem('HIDE_MIGRATION_NOTICE') !== '1') _showMigrationModal();
  }
});

// — Trigger 2: Ctrl+Shift+M
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    _showMigrationModal();
  }
});
