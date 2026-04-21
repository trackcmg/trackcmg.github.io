// ============================================================
//  auth.js — Google Identity Services (GSI) auth
//
//  Flujo:
//    1. Usuario pulsa el botón "Sign in with Google" renderizado por GSI
//    2. Google devuelve un id_token (JWT) firmado
//    3. Lo guardamos en localStorage; cada llamada al GAS lo incluye
//    4. El GAS verifica la firma con tokeninfo + comprueba allowlist
//
//  No hay allowlist en el frontend: si el token es válido pero el email
//  no está autorizado, el GAS devolverá 'unauthorized' y cerramos sesión.
// ============================================================
import { setAuthed, setCurrentUser } from './state.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const LS_TOKEN = 'g_id_token';
const LS_EMAIL = 'g_email';

let _idToken = null;
let _email   = null;
let _onLogin = null;
let _onLogout = null;

// ── Decodifica el payload de un JWT (sin verificar la firma — solo UI) ─────
function _decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  } catch { return null; }
}

function _isExpired(token) {
  const p = _decodeJwt(token);
  if (!p || !p.exp) return true;
  return (p.exp * 1000) <= Date.now();
}

// ── Accessor para cloud.js: devuelve el id_token actual o null ────────────
export function getIdToken() {
  if (!_idToken) return null;
  if (_isExpired(_idToken)) {
    _clearSession();
    return null;
  }
  return _idToken;
}

function _clearSession() {
  _idToken = null;
  _email = null;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EMAIL);
  setAuthed(false);
  setCurrentUser(null);
}

// ── Inicializa GSI y conecta los callbacks del app ────────────────────────
// onLogin(user, isNewLogin) cuando hay sesión activa
// onLogout() cuando no la hay
export function initAuth(onLogin, onLogout) {
  _onLogin = onLogin;
  _onLogout = onLogout;

  // Intenta restaurar sesión del almacenamiento local
  const stored = localStorage.getItem(LS_TOKEN);
  const storedEmail = localStorage.getItem(LS_EMAIL);
  if (stored && storedEmail && !_isExpired(stored)) {
    _idToken = stored;
    _email = storedEmail;
    const user = { id: storedEmail, email: storedEmail };
    setCurrentUser(user);
    setAuthed(true);
    onLogin(user, false);
    // Inicializamos GSI igualmente (para auto-refresh cuando el token caduque)
    _initGsi();
    return;
  }

  // Sin sesión válida → limpia y muestra login
  _clearSession();
  onLogout();
  _initGsi();
}

// ── Espera hasta que window.google.accounts.id esté disponible ────────────
function _whenGsiReady(cb, attempts = 50) {
  if (window.google && window.google.accounts && window.google.accounts.id) return cb();
  if (attempts <= 0) { console.warn('[auth] GSI no cargó'); return; }
  setTimeout(() => _whenGsiReady(cb, attempts - 1), 100);
}

function _initGsi() {
  _whenGsiReady(() => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: _handleCredentialResponse,
      auto_select: false,
    });
    const host = document.getElementById('gsiButton');
    if (host) {
      host.innerHTML = '';
      google.accounts.id.renderButton(host, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: 280,
      });
    }
  });
}

function _handleCredentialResponse(resp) {
  const token = resp && resp.credential;
  if (!token) return;
  const payload = _decodeJwt(token);
  if (!payload || !payload.email) return;

  _idToken = token;
  _email = payload.email;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_EMAIL, _email);

  const user = { id: _email, email: _email };
  setCurrentUser(user);
  setAuthed(true);
  if (_onLogin) _onLogin(user, true);
}

// ── Llamar cuando una respuesta del GAS indica 'unauthorized' ──────────────
export function onUnauthorizedFromServer() {
  _clearSession();
  if (_onLogout) _onLogout();
  _initGsi();
}

// ── Cerrar sesión: revoca en GSI y limpia almacenamiento ──────────────────
export async function signOut() {
  try {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch {}
  _clearSession();
  if (_onLogout) _onLogout();
  _initGsi();
}
