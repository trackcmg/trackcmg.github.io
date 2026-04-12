// ============================================================
//  auth.js — Autenticación con GAS token (v2) + SHA-256 local (fallback)
//
//  Flujo preferido: POST hash a GAS → GAS devuelve UUID token → sessionStorage
//  Fallback: comparación SHA-256 local (hasta que GAS implemente ?action=auth)
//  Sin dependencias circulares: comunica resultado vía CustomEvents.
// ============================================================
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

// Autenticación sin contraseña: genera token de sesión y activa edit-mode.
export async function checkAuth() {
  const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  setToken(token);
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_TS_KEY, Date.now().toString());
  setAuthed(true);
  document.getElementById('authOv').classList.remove('open');
  document.dispatchEvent(
    new CustomEvent('dashboard:auth-success', { detail: _pendingAction })
  );
  setPendingAction(null);
}
