// ============================================================
//  config.js — Constantes de la aplicación
//
//  INSTRUCCIÓN: Rellena GAS_URL y PW_HASH con tus valores reales.
//  Puedes copiarlos del script original en index.html.
//  Este archivo NO debe contener contraseñas en texto plano.
// ============================================================

// URL del Web App de Google Apps Script (sincronización de datos)
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbzSrJ7ZPEWRU2tJugXIywr0jHQeUCCRlnrIIVfKdzU0N65d_quPzCclFc-WNBdbYWpu/exec';

// URL del Web App de Google Apps Script que actúa como proxy para Yahoo Finance
// (puede ser el mismo endpoint u otro separado)
export const PROXY_URL = 'https://script.google.com/macros/s/AKfycbzSrJ7ZPEWRU2tJugXIywr0jHQeUCCRlnrIIVfKdzU0N65d_quPzCclFc-WNBdbYWpu/exec';

// Hash SHA-256 de tu contraseña de acceso al dashboard
export const PW_HASH = '1a34ce6f94df88d435381a01277d152d07efb361b2b69cf67046f0488018dfbc';

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
