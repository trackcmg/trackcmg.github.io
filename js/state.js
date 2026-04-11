// ============================================================
//  state.js — Estado mutable compartido entre módulos
//
//  Usa live bindings de ES Modules: importar _authed en otro
//  módulo siempre refleja el valor actual (no una copia).
// ============================================================

// Objeto de datos de la aplicación — mutable, compartido
export const D = {};

// Estado de autenticación
export let _authed = false;
export function setAuthed(v) { _authed = v; }

// Acción pendiente tras autenticación
export let _pendingAction = null;
export function setPendingAction(v) { _pendingAction = v; }
