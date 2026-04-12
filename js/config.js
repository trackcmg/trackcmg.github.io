// ============================================================
//  config.js — Constantes de la aplicación
// ============================================================

export const STORAGE_MODE = 'supabase'; // 'supabase' | 'gas'

// --- SUPABASE CONFIG (Main Database) ---
export const SUPABASE_URL      = 'https://qwpoyyrddchdbsxpvvaa.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3cG95eXJkZGNoZGJzeHB2dmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzM1OTYsImV4cCI6MjA5MTUwOTU5Nn0.10QOc9w_Lhh7NG2OtYEC2Rm5C-VqH4Pb0k99aN1E0DI';

// --- PROXY CONFIG (Yahoo Fetcher via GAS) ---
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
