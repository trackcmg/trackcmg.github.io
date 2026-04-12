// ============================================================
//  config.js — Constantes de la aplicación (ZERO SECRETS)
//
//  POLÍTICA DE SEGURIDAD: Este archivo NO contiene secretos.
//  Todas las URLs privadas y hashes se leen desde localStorage
//  a través de js/secrets.js (clave: APP_SECRETS).
// ============================================================

// Helpers para leer secretos en tiempo de ejecución
function _getSecrets() {
  try { return JSON.parse(localStorage.getItem('APP_SECRETS') || '{}'); } catch { return {}; }
}

// URL del Web App de Google Apps Script — leída de APP_SECRETS.GAS_URL
export function getGasUrl() { return _getSecrets().GAS_URL || ''; }

// URL del proxy GAS para Yahoo Finance — leída de APP_SECRETS.PROXY_URL (fallback a GAS_URL)
export function getProxyUrl() { return _getSecrets().PROXY_URL || _getSecrets().GAS_URL || ''; }

// Hash SHA-256 de contraseña — leído de APP_SECRETS.PW_HASH
export function getPwHash() { return _getSecrets().PW_HASH || ''; }

// Modo de almacenamiento activo: 'gas' | 'supabase'
export function getStorageMode() { return _getSecrets().STORAGE_MODE || 'gas'; }

// Credenciales Supabase — leídas de APP_SECRETS
export function getSupabaseUrl() { return _getSecrets().SUPABASE_URL || ''; }
export function getSupabaseKey() { return _getSecrets().SUPABASE_KEY || ''; }

// ── Constantes estáticas (no son secretos) ──────────────────

// Tipos de cambio estáticos (fallback de emergencia si las APIs de FX fallan)
export const TRADE_FX = { EUR: 1, USD: 0.8696, CAD: 0.6369, GBP: 1.1574 };

// Datos de arranque vacíos (FALLBACK)
export const FALLBACK = {
  holdings: [],
  cash: 0,
  totalInvested: 0,
  closedTrades: [],
  history: [],
  gym: [],
  books: [],
  movies: [],
  series: []
};

// ── Alias síncronos usados internamente (para compatibilidad con imports directos) ──
// cloud.js y auth.js deben migrar a los getters anteriores; estos permiten
// que el código antiguo que importa GAS_URL / PW_HASH siga funcionando
// leyendo siempre de localStorage en lugar de un valor hardcodeado.
export const GAS_URL = /** @deprecated usar getGasUrl() */ '';
export const PROXY_URL = /** @deprecated usar getProxyUrl() */ '';
export const PW_HASH = /** @deprecated usar getPwHash() */ '';
