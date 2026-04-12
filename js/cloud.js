// ============================================================
//  cloud.js — Router de backend dual (GAS  ↔  Supabase)
//
//  Fase 7: Arquitectura dual-backend.
//  - STORAGE_MODE = 'gas'      → usa Google Apps Script (actual)
//  - STORAGE_MODE = 'supabase' → usa Supabase (Fase 7.2)
//
//  La clave APP_SECRETS en localStorage controla el modo.
//  Ningún secreto vive en el código fuente.
// ============================================================
import { getGasUrl, getPwHash, getStorageMode } from './config.js';
import { D, _authed, _token } from './state.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
export { updateSyncStatus };

export let _cloudReady = false;

// ── Utilidad de parseo GAS ────────────────────────────────────────────────────
export function _parseGASResponse(text) {
  try { return JSON.parse(text); } catch { /* not pure JSON */ }
  const m = text.match(/\{[^]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  BACKEND: GAS — lógica heredada renombrada a _loadFromGAS / _saveToGAS
// ════════════════════════════════════════════════════════════════════════════

async function _loadFromGAS() {
  const GAS_URL = getGasUrl();
  if (!GAS_URL) { updateSyncStatus('local'); return false; }
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20000);
    const tokenParam = _token ? '&token=' + encodeURIComponent(_token) : '';
    const res = await fetch(GAS_URL + '?action=getData&t=' + Date.now() + tokenParam, { signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    console.log('Cloud GET response:', text.substring(0, 200));

    if (!text || text === '{}' || text === 'No URL' || text === 'Blocked') {
      _cloudReady = (text !== 'No URL' && text !== 'Blocked');
      updateSyncStatus(_cloudReady ? 'ok' : 'local');
      return false;
    }

    const j = JSON.parse(text);
    if (j && j.holdings) {
      _cloudReady = true;
      const hadLocalHistory = (D.history && D.history.length) || 0;
      loadDataFromObj(j, true);
      saveLocal();
      if (hadLocalHistory && D.history.length > (j.history || []).length) _saveToGAS();
      updateSyncStatus('ok');
      return true;
    }

    _cloudReady = true;
    return false;
  } catch (e) {
    console.warn('GAS fetch failed:', e.name, e.message);
    updateSyncStatus(e.name === 'AbortError' ? 'local' : 'err');
    return false;
  }
}

async function _saveToGAS() {
  const GAS_URL = getGasUrl();
  const PW_HASH  = getPwHash();
  if (!GAS_URL) { updateSyncStatus('local'); return false; }
  try {
    const payload = JSON.stringify({ password: PW_HASH, token: _token || '', data: JSON.stringify(buildDataObj()) });
    let text = '';
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
      text = await res.text();
      console.log('Cloud POST status:', res.status, 'response:', text.substring(0, 300));
    } catch (fetchErr) {
      console.warn('POST fetch error (verifying):', fetchErr.message);
      return await _verifyGASSync();
    }

    const j = _parseGASResponse(text);
    if (j) {
      if (j.error) { console.warn('Cloud sync:', j.error); toast('Sync: ' + j.error, 'err'); updateSyncStatus('err'); return false; }
      toast('Synced', 'ok');
      updateSyncStatus('ok');
      return true;
    }

    console.warn('POST response not JSON, verifying...', text.substring(0, 120));
    return await _verifyGASSync();
  } catch (e) {
    console.warn('GAS push:', e.name, e.message);
    toast('Sync failed', 'err');
    updateSyncStatus('err');
    return false;
  }
}

async function _verifyGASSync() {
  const GAS_URL = getGasUrl();
  try {
    await new Promise(r => setTimeout(r, 1200));
    const res = await fetch(GAS_URL + '?action=getData&t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = JSON.parse(await res.text());
    if (j && j.holdings) { toast('Synced', 'ok'); updateSyncStatus('ok'); return true; }
  } catch (e) { console.warn('Verify failed:', e); }
  toast('Sync failed', 'err');
  updateSyncStatus('err');
  return false;
}

// ════════════════════════════════════════════════════════════════════════════
//  BACKEND: Supabase — reservado para Fase 7.2
//  Los métodos están declarados y lanzarán un aviso claro hasta que
//  se implemente la lógica de lectura/escritura.
// ════════════════════════════════════════════════════════════════════════════

async function _loadFromSupabase() {
  // TODO Fase 7.2: implementar SELECT desde tablas PostgreSQL via Supabase JS client
  console.warn('[Supabase] _loadFromSupabase: not yet implemented (Phase 7.2)');
  updateSyncStatus('local');
  return false;
}

async function _saveToSupabase() {
  // TODO Fase 7.2: implementar UPSERT hacia tablas PostgreSQL via Supabase JS client
  console.warn('[Supabase] _saveToSupabase: not yet implemented (Phase 7.2)');
  updateSyncStatus('local');
  return false;
}

// ════════════════════════════════════════════════════════════════════════════
//  ROUTER PÚBLICO — única interfaz que consume el resto de la app
// ════════════════════════════════════════════════════════════════════════════

export async function fetchDataFromCloud() {
  switch (getStorageMode()) {
    case 'supabase': return await _loadFromSupabase();
    case 'gas':
    default:         return await _loadFromGAS();
  }
}

export async function pushDataToCloud() {
  switch (getStorageMode()) {
    case 'supabase': return await _saveToSupabase();
    case 'gas':
    default:         return await _saveToGAS();
  }
}

// Guarda localmente y, si está autenticado, también en la nube
export async function saveAndSync() {
  saveLocal();
  if (_authed) return await pushDataToCloud();
  return true;
}
