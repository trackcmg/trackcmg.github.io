// ============================================================
//  auth.js — Autenticación con GAS token (v2) + SHA-256 local (fallback)
//
//  Flujo preferido: POST hash a GAS → GAS devuelve UUID token → sessionStorage
//  Fallback: comparación SHA-256 local (hasta que GAS implemente ?action=auth)
//  Sin dependencias circulares: comunica resultado vía CustomEvents.
// ============================================================
import { getGasUrl, getPwHash } from './config.js';
import { _authed, setAuthed, _pendingAction, setPendingAction, setToken } from './state.js';
import { toast } from './utils.js';

const TOKEN_KEY = 'dash_token';
const TOKEN_TS_KEY = 'dash_ts';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

// Hash SHA-256 usando Web Crypto API
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Intenta restaurar la sesión desde sessionStorage.
// Devuelve true si el token guardado sigue siendo válido (< 8 horas).
export function restoreSession() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const ts = Number(sessionStorage.getItem(TOKEN_TS_KEY) || 0);
  if (token && Date.now() - ts < TOKEN_TTL_MS) {
    setToken(token);
    setAuthed(true);
    return true;
  }
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_TS_KEY);
  return false;
}

// Inicia un flujo que requiere autenticación.
// Si ya está autenticado, emite el evento de acción directamente.
// Si no, guarda la acción pendiente y muestra el overlay de auth.
export function authThenAction(action) {
  if (_authed) {
    document.dispatchEvent(new CustomEvent('dashboard:action', { detail: action }));
    return;
  }
  setPendingAction(action);
  const authOv = document.getElementById('authOv');
  authOv.classList.add('open');
  const pw = document.getElementById('authPw');
  pw.value = '';
  document.getElementById('authErr').style.display = 'none';
  setTimeout(() => pw.focus(), 100);
}

// Verifica la contraseña: intenta auth server-side (GAS v2);
// si GAS no tiene el endpoint o falla, cae a SHA-256 local.
export async function checkAuth() {
  const pwValue = document.getElementById('authPw').value;
  if (!pwValue) return;
  const hash = await sha256(pwValue);
  let authenticated = false;

  // ── Intentar autenticación server-side (GAS v2) ───────────
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(
      getGasUrl() + '?action=auth&pw=' + encodeURIComponent(hash),
      { signal: ctrl.signal, redirect: 'follow' }
    );
    clearTimeout(tid);
    const j = JSON.parse(await res.text());
    if (j && j.ok === true && j.token) {
      // GAS emitió token — flujo v2
      setToken(j.token);
      sessionStorage.setItem(TOKEN_KEY, j.token);
      sessionStorage.setItem(TOKEN_TS_KEY, Date.now().toString());
      authenticated = true;
    } else if (j && j.ok === false) {
      // GAS rechazó explícitamente la contraseña
      document.getElementById('authErr').style.display = 'block';
      return;
    }
    // j.ok undefined → GAS sin endpoint /auth → seguir con fallback local
  } catch (e) {
    // Timeout / red / GAS sin endpoint /auth → fallback local silencioso
    console.info('Server-side auth no disponible, usando fallback local:', e.message);
  }

  // ── Fallback SHA-256 local ────────────────────────────────
  if (!authenticated) {
    if (hash !== getPwHash()) {
      document.getElementById('authErr').style.display = 'block';
      return;
    }
    authenticated = true;
  }

  setAuthed(true);
  document.getElementById('authOv').classList.remove('open');
  document.dispatchEvent(
    new CustomEvent('dashboard:auth-success', { detail: _pendingAction })
  );
  setPendingAction(null);
}
