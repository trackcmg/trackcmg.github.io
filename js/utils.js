// ============================================================
//  utils.js — Funciones de utilidad reutilizables
// ============================================================

// Formatea un número con separadores alemanes (1.234,56)
export const F = (n, d = 2) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Devuelve color CSS según ratio (verde/ámbar/gris/rojo)
export function ratingColor(r, max = 10) {
  if (!r) return 'var(--text-muted)';
  const pct = r / max;
  return pct >= 0.85 ? 'var(--green)'
       : pct >= 0.70 ? 'var(--amber)'
       : pct >= 0.50 ? 'var(--text-dim)'
       : 'var(--red)';
}

// Toast de notificación (auto-elimina a los 3s)
export function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'ok');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Configuración de tooltip para Chart.js
export const ttOpts = {
  backgroundColor: '#1a1a35',
  titleColor: '#e2e2f0',
  bodyColor: '#e2e2f0',
  borderColor: '#2d2d55',
  borderWidth: 1,
  cornerRadius: 8,
  padding: 10,
  bodyFont: { family: 'IBM Plex Mono' }
};

// Configuración de leyenda para Chart.js
export const legOpts = {
  color: '#7070a0',
  font: { family: 'Sora', size: 11 },
  padding: 12,
  usePointStyle: true,
  pointStyleWidth: 7
};
