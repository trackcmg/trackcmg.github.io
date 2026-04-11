// ============================================================
//  auth.js — Autenticación SHA-256 client-side
//
//  No importa módulos de render para evitar dependencias circulares.
//  Comunica el resultado vía CustomEvents escuchados por app.js.
// ============================================================
import { PW_HASH } from './config.js';
import { _authed, setAuthed, _pendingAction, setPendingAction } from './state.js';
import { toast } from './utils.js';

// Hash SHA-256 usando Web Crypto API (disponible en todos los navegadores modernos)
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

// Verifica la contraseña introducida comparando el hash SHA-256.
// Si es correcta, emite 'dashboard:auth-success'; si no, muestra el error.
export async function checkAuth() {
  const inputHash = await sha256(document.getElementById('authPw').value);
  if (inputHash === PW_HASH) {
    setAuthed(true);
    document.getElementById('authOv').classList.remove('open');
    document.dispatchEvent(
      new CustomEvent('dashboard:auth-success', { detail: _pendingAction })
    );
    setPendingAction(null);
  } else {
    document.getElementById('authErr').style.display = 'block';
  }
}
