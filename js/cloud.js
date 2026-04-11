// ============================================================
//  cloud.js — Comunicación con Google Apps Script
// ============================================================
import { GAS_URL, PW_HASH } from './config.js';
import { D, _authed, _token } from './state.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
// Re-export updateSyncStatus para compatibilidad con imports desde cloud.js
export { updateSyncStatus };

export let _cloudReady = false;

// Intenta parsear la respuesta de GAS (puede venir con prefijo HTML)
export function _parseGASResponse(text) {
  try { return JSON.parse(text); } catch (e) { /* not pure JSON */ }
  const m = text.match(/\{[^]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { /* noop */ } }
  return null;
}

// Descarga datos desde GAS y los fusiona con el estado local
export async function fetchDataFromCloud() {
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
      // Si el local tiene entradas que la nube no tenía, sincronizar de vuelta
      if (hadLocalHistory && D.history.length > (j.history || []).length) {
        pushDataToCloud();
      }
      updateSyncStatus('ok');
      return true;
    }

    _cloudReady = true;
    return false;
  } catch (e) {
    console.warn('Cloud fetch failed:', e.name, e.message);
    updateSyncStatus(e.name === 'AbortError' ? 'local' : 'err');
    return false;
  }
}

// Envía el estado actual a GAS
export async function pushDataToCloud() {
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
      return await _verifySync();
    }

    const j = _parseGASResponse(text);
    if (j) {
      if (j.error) {
        console.warn('Cloud sync:', j.error);
        toast('Sync: ' + j.error, 'err');
        updateSyncStatus('err');
        return false;
      }
      toast('Synced', 'ok');
      updateSyncStatus('ok');
      return true;
    }

    console.warn('POST response not JSON, verifying...', text.substring(0, 120));
    return await _verifySync();
  } catch (e) {
    console.warn('Cloud push:', e.name, e.message);
    toast('Sync failed', 'err');
    updateSyncStatus('err');
    return false;
  }
}

// Verifica que el push se reflejó en GAS (GET de comprobación)
async function _verifySync() {
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

// Guarda localmente y, si está autenticado, también en la nube
export async function saveAndSync() {
  saveLocal();
  if (_authed) await pushDataToCloud();
}
