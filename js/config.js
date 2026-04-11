// ============================================================
//  config.js — Constantes de la aplicación
//
//  INSTRUCCIÓN: Rellena GAS_URL y PW_HASH con tus valores reales.
//  Puedes copiarlos del script original en index.html.
//  Este archivo NO debe contener contraseñas en texto plano.
// ============================================================

// URL del Web App de Google Apps Script (sincronización de datos)
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbyWUy-SpQFdJZnI1TWeL68pu5gdax4Tj6ZHg_pSY-R2HWzaHB4KDZo44se5vMdu_8xV/exec';

// URL del Web App de Google Apps Script que actúa como proxy para Yahoo Finance
// (puede ser el mismo endpoint u otro separado)
export const PROXY_URL = 'https://script.google.com/macros/s/AKfycbyWUy-SpQFdJZnI1TWeL68pu5gdax4Tj6ZHg_pSY-R2HWzaHB4KDZo44se5vMdu_8xV/exec';

// Hash SHA-256 de tu contraseña de acceso al dashboard
export const PW_HASH = '3b45022ab36728cdae12e709e945bba267c50ee8a91e6e4388539a8e03a3fdcd';

// Tipos de cambio estáticos (fallback de emergencia si las APIs de FX fallan)
// Se actualizan periódicamente de forma manual
export const TRADE_FX = { EUR: 1, USD: 0.8696, CAD: 0.6369, GBP: 1.1574 };

// Datos de arranque vacíos (FALLBACK)
// Los datos reales se cargan desde localStorage o desde GAS al autenticarse.
// SEGURIDAD: No incluir holdings, trades ni datos personales aquí.
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
