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
import { STORAGE_MODE, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
export { updateSyncStatus };

export let _cloudReady = false;

// InicializaciÃ³n global del cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// user_id estÃ¡tico para este proyecto personal (mono-usuario)
const UID = 'default_user';

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
    const [
      { data: holdingsRows,  error: e1 },
      { data: tradesRows,    error: e2 },
      { data: mediaRows,     error: e3 },
      { data: gymRows,       error: e4 },
      { data: historyRows,   error: e5 },
      { data: settingsRow,   error: e6 },
    ] = await Promise.all([
      supabase.from('holdings').select('payload').eq('user_id', UID),
      supabase.from('closed_trades').select('payload').eq('user_id', UID),
      supabase.from('media').select('type, payload').eq('user_id', UID),
      supabase.from('gym').select('payload').eq('user_id', UID),
      supabase.from('history').select('snapped_at, payload').eq('user_id', UID)
        .order('snapped_at', { ascending: true }),
      supabase.from('settings').select('cash, total_invested').eq('user_id', UID)
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
    await Promise.all([
      supabase.from('holdings').delete().eq('user_id', UID),
      supabase.from('closed_trades').delete().eq('user_id', UID),
      supabase.from('media').delete().eq('user_id', UID),
      supabase.from('gym').delete().eq('user_id', UID),
    ]);

    // 2. Insertar datos actuales
    const ops = [];

    if (data.holdings.length) {
      ops.push(supabase.from('holdings').insert(
        data.holdings.map(h => ({ user_id: UID, ticker: h.ticker, payload: h }))
      ));
    }

    if (data.closedTrades.length) {
      ops.push(supabase.from('closed_trades').insert(
        data.closedTrades.map(t => ({ user_id: UID, ticker: t.ticker, payload: t }))
      ));
    }

    const mediaAll = [
      ...data.books.map(b  => ({ user_id: UID, type: 'book',  payload: b })),
      ...data.movies.map(m => ({ user_id: UID, type: 'movie', payload: m })),
      ...data.series.map(s => ({ user_id: UID, type: 'serie', payload: s })),
    ];
    if (mediaAll.length) ops.push(supabase.from('media').insert(mediaAll));

    if (data.gym.length) {
      ops.push(supabase.from('gym').insert(
        data.gym.map(g => ({ user_id: UID, log_date: g.date, payload: g }))
      ));
    }

    // History: upsert para preservar snapshots histÃ³ricos sin duplicados
    if (data.history.length) {
      ops.push(supabase.from('history').upsert(
        data.history.map(h => ({ user_id: UID, snapped_at: h.date, payload: h })),
        { onConflict: 'user_id,snapped_at' }
      ));
    }

    // Settings: upsert escalar (cash + totalInvested)
    ops.push(supabase.from('settings').upsert(
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

export async function fetchDataFromCloud() {
  if (STORAGE_MODE === 'supabase') return await _loadFromSupabase();
  throw new Error('GAS Mode requiere configuraciÃ³n manual de seguridad.');
}

export async function pushDataToCloud() {
  if (STORAGE_MODE === 'supabase') return await _saveToSupabase();
  throw new Error('GAS Mode requiere configuraciÃ³n manual de seguridad.');
}

// Guarda localmente y envÃ­a a Supabase
export async function saveAndSync() {
  saveLocal();
  return await pushDataToCloud();
}
