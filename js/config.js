// ============================================================
//  config.js — Constantes de la aplicación
// ============================================================

// --- GOOGLE SIGN-IN ---
// Client ID de OAuth 2.0 (GCP → APIs & Services → Credentials).
// La allowlist de emails (hasheados) vive en Script Properties del GAS;
// nunca se publica en el repo.
export const GOOGLE_CLIENT_ID = '1029819457033-i79lmor8j7e2t26ib7m2ldmnpiv9un1p.apps.googleusercontent.com';

// --- STORAGE (Drive vía Apps Script) ---
export const PROXY_URL = 'https://script.google.com/macros/s/AKfycbyWUy-SpQFdJZnI1TWeL68pu5gdax4Tj6ZHg_pSY-R2HWzaHB4KDZo44se5vMdu_8xV/exec';

// ── Constantes estáticas ────────────────────────────────────

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
