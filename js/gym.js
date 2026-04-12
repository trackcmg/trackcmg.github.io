// ============================================================
//  gym.js — Seguimiento de peso y % grasa corporal
// ============================================================
import { D } from './state.js';
import { _authed } from './state.js';
import { F, ttOpts, legOpts } from './utils.js';
import { saveAndSync } from './cloud.js';
import { toast } from './utils.js';

let CH = {};

export function addGymEntry() {
  const date = document.getElementById('gymDate').value;
  const w = parseFloat(document.getElementById('gymWeight').value);
  const bf = parseFloat(document.getElementById('gymBf').value);
  if (!date) { toast('Select a date first', 'err'); return; }
  if (isNaN(w) && isNaN(bf)) { toast('Enter weight or body fat %', 'err'); return; }
  const entry = { date, weight: isNaN(w) ? null : w, bf: isNaN(bf) ? null : bf };
  const idx = D.gym.findIndex(g => g.date === date);
  if (idx >= 0) D.gym[idx] = entry;
  else D.gym.push(entry);
  D.gym.sort((a, b) => a.date.localeCompare(b.date));
  renderGym();
  saveAndSync();
  document.getElementById('gymWeight').value = '';
  document.getElementById('gymBf').value = '';
}

export function renderGym() {
  const ctx = document.getElementById('cGym').getContext('2d');
  const labels = D.gym.map(g => {
    const d = new Date(g.date);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
  });

  if (CH.gym) CH.gym.destroy();
  CH.gym = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Weight (kg)', data: D.gym.map(g => g.weight), borderColor: '#5588ff', backgroundColor: 'rgba(85,136,255,.1)', fill: true, tension: .3, pointRadius: 5, pointBackgroundColor: '#5588ff', pointBorderColor: '#0d0d1a', pointBorderWidth: 2, yAxisID: 'y' },
        { label: 'Body Fat (%)', data: D.gym.map(g => g.bf), borderColor: '#ffaa22', backgroundColor: 'rgba(255,170,34,.1)', fill: true, tension: .3, pointRadius: 5, pointBackgroundColor: '#ffaa22', pointBorderColor: '#0d0d1a', pointBorderWidth: 2, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: legOpts }, tooltip: { ...ttOpts } },
      scales: {
        x: { grid: { color: 'rgba(26,26,53,.4)' }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 } } },
        y: { type: 'linear', position: 'left', title: { display: true, text: 'Weight (kg)', color: '#5588ff', font: { family: 'Sora', size: 11 } }, grid: { color: 'rgba(26,26,53,.4)' }, ticks: { color: '#5588ff', font: { family: 'IBM Plex Mono', size: 10 } } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Body Fat (%)', color: '#ffaa22', font: { family: 'Sora', size: 11 } }, grid: { drawOnChartArea: false }, ticks: { color: '#ffaa22', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => v + '%' } }
      }
    }
  });

  const tbl = document.getElementById('gymTable');
  if (!D.gym.length) {
    tbl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No entries yet.</p>';
    return;
  }
  let rows = '';
  D.gym.slice().reverse().forEach(g => {
    rows += `<tr ${_authed ? `data-edit-type="gym" data-edit-date="${g.date}" style="cursor:pointer"` : ''}>
      <td>${g.date}</td>
      <td>${g.weight != null ? F(g.weight, 1) + ' kg' : '\u2014'}</td>
      <td>${g.bf != null ? F(g.bf, 1) + '%' : '\u2014'}</td>
    </tr>`;
  });
  tbl.innerHTML = `<table><thead><tr><th>Date</th><th>Weight</th><th>Body Fat</th></tr></thead><tbody>${rows}</tbody></table>`;
}
