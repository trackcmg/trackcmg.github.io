// ============================================================
//  cloud.js â€” Backend Supabase (Fase 7.2)
//
//  STORAGE_MODE = 'supabase' â†’ lectura/escritura via Supabase JS
//  STORAGE_MODE = 'gas'      â†’ lanza error (requiere config manual)
//
//  Estrategia de escritura: Wipe & Insert por user_id.
//  No hay secretos en el cÃ³digo; SUPABASE_ANON_KEY es pÃºblica
//  y estÃ¡ protegida por RLS del lado del servidor.
// ============================================================
import { STORAGE_MODE, SUPABASE_URL, SUPABASE_ANON_KEY, PROXY_URL } from './config.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
export { updateSyncStatus };

export let _cloudReady = false;

// user_id estatico para este proyecto personal (mono-usuario)
const UID = 'default_user';

// Lazy-init del cliente Supabase: se crea la primera vez que se necesita.
// Evita que el modulo falle si el CDN de Supabase carga despues del modulo JS.
let _supabaseClient = null;
function _getSupabase() {
  if (!_supabaseClient) {
    if (!window.supabase) throw new Error('[Supabase] CDN no cargado aun. Comprueba el orden de <script> en index.html.');
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BACKEND: Supabase â€” lectura (6 SELECTs en paralelo)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function _loadFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] URL o ANON_KEY no configuradas. Cargando datos locales.');
    updateSyncStatus('local');
    return false;
  }

  try {
    const sb = _getSupabase();
    const [
      { data: holdingsRows,  error: e1 },
      { data: tradesRows,    error: e2 },
      { data: mediaRows,     error: e3 },
      { data: gymRows,       error: e4 },
      { data: historyRows,   error: e5 },
      { data: settingsRow,   error: e6 },
    ] = await Promise.all([
      sb.from('holdings').select('payload').eq('user_id', UID),
      sb.from('closed_trades').select('payload').eq('user_id', UID),
      sb.from('media').select('type, payload').eq('user_id', UID),
      sb.from('gym').select('payload').eq('user_id', UID),
      sb.from('history').select('snapped_at, payload').eq('user_id', UID)
        .order('snapped_at', { ascending: true }),
      sb.from('settings').select('cash, total_invested').eq('user_id', UID)
        .maybeSingle(),
    ]);

    for (const err of [e1, e2, e3, e4, e5, e6]) {
      if (err) throw err;
    }

    // Mapeo SQL â†’ estructura del objeto D
    const obj = {
      holdings:      (holdingsRows || []).map(r => r.payload),
      closedTrades:  (tradesRows   || []).map(r => r.payload),
      books:         (mediaRows    || []).filter(r => r.type === 'book').map(r => r.payload),
      movies:        (mediaRows    || []).filter(r => r.type === 'movie').map(r => r.payload),
      series:        (mediaRows    || []).filter(r => r.type === 'serie').map(r => r.payload),
      gym:           (gymRows      || []).map(r => r.payload),
      history:       (historyRows  || []).map(r => r.payload),
      cash:          settingsRow?.cash           ?? 0,
      totalInvested: settingsRow?.total_invested ?? 0,
    };

    // Base de datos vacia: inicializar D con valores por defecto (no es un error)
    loadDataFromObj(obj, true);
    saveLocal();
    _cloudReady = true;
    updateSyncStatus('ok');
    return true;
  } catch (e) {
    console.error('[Supabase] _loadFromSupabase:', e.message);
    updateSyncStatus('err');
    return false;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BACKEND: Supabase â€” escritura (Wipe & Insert)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function _saveToSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    updateSyncStatus('local');
    return false;
  }

  const data = buildDataObj();

  try {
    // 1. Borrar registros previos del usuario (arrays que se reescriben completamente)
    const sb = _getSupabase();
    await Promise.all([
      sb.from('holdings').delete().eq('user_id', UID),
      sb.from('closed_trades').delete().eq('user_id', UID),
      sb.from('media').delete().eq('user_id', UID),
      sb.from('gym').delete().eq('user_id', UID),
    ]);

    // 2. Insertar datos actuales
    const ops = [];

    if (data.holdings.length) {
      ops.push(sb.from('holdings').insert(
        data.holdings.map(h => ({ user_id: UID, ticker: h.ticker, payload: h }))
      ));
    }

    if (data.closedTrades.length) {
      ops.push(sb.from('closed_trades').insert(
        data.closedTrades.map(t => ({ user_id: UID, ticker: t.ticker, payload: t }))
      ));
    }

    const mediaAll = [
      ...data.books.map(b  => ({ user_id: UID, type: 'book',  payload: b })),
      ...data.movies.map(m => ({ user_id: UID, type: 'movie', payload: m })),
      ...data.series.map(s => ({ user_id: UID, type: 'serie', payload: s })),
    ];
    if (mediaAll.length) ops.push(sb.from('media').insert(mediaAll));

    if (data.gym.length) {
      ops.push(sb.from('gym').insert(
        data.gym.map(g => ({ user_id: UID, log_date: g.date, payload: g }))
      ));
    }

    if (data.history.length) {
      ops.push(sb.from('history').upsert(
        data.history.map(h => ({ user_id: UID, snapped_at: h.date, payload: h })),
        { onConflict: 'user_id,snapped_at' }
      ));
    }

    ops.push(sb.from('settings').upsert(
      { user_id: UID, cash: data.cash, total_invested: data.totalInvested,
        updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ));

    const results = await Promise.all(ops);
    for (const { error } of results) {
      if (error) throw error;
    }

    toast('Synced', 'ok');
    updateSyncStatus('ok');
    return true;
  } catch (e) {
    console.error('[Supabase] _saveToSupabase:', e.message);
    toast('Sync failed', 'err');
    updateSyncStatus('err');
    return false;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ROUTER PÃšBLICO â€” Ãºnica interfaz que consume el resto de la app
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ════════════════════════════════════════════════════════════════════════════
//  BACKEND: GAS — fallback / modo alternativo
//  Usa PROXY_URL (mismo endpoint GAS) para getData / saveData.
//  Lectura es anonima; escritura requiere que GAS este configurado sin pw.
// ════════════════════════════════════════════════════════════════════════════

async function _loadFromGAS() {
  if (!PROXY_URL) { console.warn('[GAS] PROXY_URL no configurada.'); updateSyncStatus('local'); return false; }
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(PROXY_URL + '?action=getData&t=' + Date.now(), { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text === '{}' || text === 'No URL' || text === 'Blocked') {
      updateSyncStatus('local'); return false;
    }
    let j;
    try { j = JSON.parse(text); } catch { updateSyncStatus('local'); return false; }
    if (j && j.holdings) {
      loadDataFromObj(j, true); saveLocal(); updateSyncStatus('ok'); return true;
    }
    return false;
  } catch (e) {
    console.warn('[GAS] _loadFromGAS:', e.message);
    updateSyncStatus(e.name === 'AbortError' ? 'local' : 'err');
    return false;
  }
}

async function _saveToGAS() {
  if (!PROXY_URL) { updateSyncStatus('local'); return false; }
  try {
    const payload = JSON.stringify({ data: JSON.stringify(buildDataObj()) });
    const res = await fetch(PROXY_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, body: payload
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    toast('Synced', 'ok'); updateSyncStatus('ok'); return true;
  } catch (e) {
    console.warn('[GAS] _saveToGAS:', e.message);
    toast('Sync failed', 'err'); updateSyncStatus('err'); return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ROUTER PUBLICO — unica interfaz que consume el resto de la app
// ════════════════════════════════════════════════════════════════════════════

export async function fetchDataFromCloud() {
  if (STORAGE_MODE === 'supabase') return await _loadFromSupabase();
  return await _loadFromGAS();
}

export async function pushDataToCloud() {
  if (STORAGE_MODE === 'supabase') return await _saveToSupabase();
  return await _saveToGAS();
}

// Guarda localmente y envia a la nube
export async function saveAndSync() {
  saveLocal();
  return await pushDataToCloud();
}

// ════════════════════════════════════════════════════════════════════════════
//  MIGRATION BRIDGE — mueve datos de GAS a Supabase de una sola vez.
//  Uso unico. Eliminar este bloque (y el boton en index.html) tras migrar.
// ════════════════════════════════════════════════════════════════════════════

export async function migrateFromGAS() {
  if (!PROXY_URL) {
    alert('PROXY_URL no esta configurada en config.js.');
    return false;
  }

  // Paso A: leer datos desde GAS (GET anonimo)
  let gasData;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(PROXY_URL + '?action=getData&t=' + Date.now(), { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text === '{}' || text === 'No URL' || text === 'Blocked') {
      alert('GAS devolvio una respuesta vacia o bloqueada: "' + text + '"');
      return false;
    }
    gasData = JSON.parse(text);
  } catch (e) {
    alert('Error al leer desde GAS:\n' + e.message);
    console.error('[Migration] fetch GAS:', e);
    return false;
  }

  if (!gasData || !gasData.holdings) {
    alert('Los datos de GAS no tienen el formato esperado (falta holdings).');
    return false;
  }

  console.log('[Migration] Datos recibidos de GAS:', {
    holdings: gasData.holdings?.length,
    closedTrades: gasData.closedTrades?.length,
    books: gasData.books?.length,
    movies: gasData.movies?.length,
    series: gasData.series?.length,
    gym: gasData.gym?.length,
    history: gasData.history?.length,
    cash: gasData.cash,
    totalInvested: gasData.totalInvested,
  });

  // Paso B: volcar a Supabase (Wipe & Insert completo)
  const sb = _getSupabase();

  try {
    // Limpiar tablas del usuario
    console.log('[Migration] Limpiando tablas de Supabase...');
    const delResults = await Promise.all([
      sb.from('holdings').delete().eq('user_id', UID),
      sb.from('closed_trades').delete().eq('user_id', UID),
      sb.from('media').delete().eq('user_id', UID),
      sb.from('gym').delete().eq('user_id', UID),
      sb.from('history').delete().eq('user_id', UID),
    ]);
    for (const { error } of delResults) {
      if (error) throw error;
    }

    // Insertar cada categoria
    const ops = [];

    if (gasData.holdings?.length) {
      ops.push(sb.from('holdings').insert(
        gasData.holdings.map(h => ({ user_id: UID, ticker: h.ticker, payload: h }))
      ));
    }
    if (gasData.closedTrades?.length) {
      ops.push(sb.from('closed_trades').insert(
        gasData.closedTrades.map(t => ({ user_id: UID, ticker: t.ticker, payload: t }))
      ));
    }

    const mediaAll = [
      ...(gasData.books  || []).map(b => ({ user_id: UID, type: 'book',  payload: b })),
      ...(gasData.movies || []).map(m => ({ user_id: UID, type: 'movie', payload: m })),
      ...(gasData.series || []).map(s => ({ user_id: UID, type: 'serie', payload: s })),
    ];
    if (mediaAll.length) ops.push(sb.from('media').insert(mediaAll));

    if (gasData.gym?.length) {
      ops.push(sb.from('gym').insert(
        gasData.gym.map(g => ({ user_id: UID, log_date: g.date, payload: g }))
      ));
    }
    if (gasData.history?.length) {
      ops.push(sb.from('history').upsert(
        gasData.history.map(h => ({ user_id: UID, snapped_at: h.date, payload: h })),
        { onConflict: 'user_id,snapped_at' }
      ));
    }

    // Paso D: settings (cash + totalInvested)
    ops.push(sb.from('settings').upsert(
      { user_id: UID, cash: gasData.cash ?? 0,
        total_invested: gasData.totalInvested ?? 0,
        updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ));

    console.log('[Migration] Ejecutando ' + ops.length + ' inserciones...');
    const results = await Promise.all(ops);
    for (const { error } of results) {
      if (error) throw error;
    }

    console.log('[Migration] Exito total.');
    return true;
  } catch (e) {
    alert('Error al escribir en Supabase:\n' + e.message);
    console.error('[Migration] Supabase write:', e);
    return false;
  }
}
