import { D, _authed } from './state.js';
import { language, locale } from './i18n.js';
import { esc } from './life-schema.js';
import { F, toast, ttOpts, legOpts } from './utils.js';
import { getPriceData, valEur, renderPortfolio, renderHistory } from './portfolio.js';
import { buildDataObj } from './storage.js';
import { saveAndSync } from './cloud.js';
import { brokerName, holdingAllocations, brokerSummary, prepareBrokerSetup } from './broker-model.js';

const text=(es,en)=>language()==='es'?es:en;
const euros=n=>Number.isFinite(n)?F(n,0)+' €':'—';
let chart, editorOpen=false;
function editable(){return _authed && document.body.classList.contains('edit-mode');}
function backup(){
  const json=JSON.stringify(buildDataObj(),null,2);
  // If neither backup can be saved, refuse to overwrite data.
  let backed=false;
  try{localStorage.setItem('db_data_prebroker_backup',json);backed=true;}catch{}
  try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='trackcmg-pre-brokers-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);backed=true;}catch{}
  if(!backed)throw new Error(text('No se pudo guardar una copia de seguridad.','A backup could not be saved.'));
}
async function apply(setup){
  if(!editable())return;
  const next=prepareBrokerSetup(D,setup);
  if(!confirm(text('Guardar brokers y reparto de acciones. Se descargará una copia de seguridad. El efectivo total, las aportaciones y el histórico no cambian. ¿Continuar?','Save brokers and share allocations. A backup will be downloaded. Total cash, contributions and history remain unchanged. Continue?')))return;
  backup();Object.assign(D,next);editorOpen=false;
  document.getElementById('brokerEditor').replaceChildren();
  renderPortfolio();renderHistory();renderBrokers();
  await saveAndSync();document.dispatchEvent(new Event('brokers-updated'));
}
export function renderBrokers(){
  const root=document.getElementById('brokerDashboard');if(!root)return;
  if(!root.querySelector('#brokerOverview')){
    root.innerHTML='<div id="brokerOverview"></div><div class="add-section broker-controls"><button class="btn" id="editBrokers"></button><button class="btn" id="importBrokers"></button><input type="file" id="brokerFile" accept=".json,application/json" hidden></div><div id="brokerEditor" class="add-section"></div>';
    root.querySelector('#editBrokers').onclick=openEditor;
    root.querySelector('#importBrokers').onclick=()=>{if(editable())root.querySelector('#brokerFile').click();};
    root.querySelector('#brokerFile').onchange=async e=>{
      const file=e.target.files[0];if(!file||!editable())return;
      try{if(file.size>1000000)throw new Error(text('Archivo demasiado grande.','File too large.'));await apply(JSON.parse(await file.text()));}
      catch(error){toast(error.message,'err');}finally{e.target.value='';}
    };
  }
  if(!document.body.classList.contains('edit-mode')){editorOpen=false;root.querySelector('#brokerEditor').replaceChildren();}
  root.querySelector('#editBrokers').textContent=text('Editar brokers','Edit brokers');
  root.querySelector('#importBrokers').textContent=text('Importar configuración','Import setup');
  const rows=brokerSummary(D.holdings||[],D.brokers||[],h=>Number.isFinite(getPriceData(h.ticker)?.price)?valEur(h):null,D.cash||0);
  if(chart){chart.destroy();chart=null;}
  root.querySelector('#brokerOverview').innerHTML=`<h2>${text('Brokers','Brokers')}</h2>
    ${rows.length?`<div class="broker-chart"><canvas id="cBrokers" role="img" aria-label="${text('Ingresado, retirado y valor actual por broker','Deposits, withdrawals and current value by broker')}"></canvas></div>
    <div class="broker-table-wrap"><table class="broker-table"><thead><tr>${[text('Broker','Broker'),text('Ingresado','Deposited'),text('Retirado','Withdrawn'),text('Actual','Current'),text('Beneficio','Profit')].map(l=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name||text('Sin asignar','Unassigned'))}</strong><small>${r.positions.map(p=>F(p.shares,Number.isInteger(p.shares)?0:4)+' '+esc(p.ticker)).join(' · ')||text('Sin posiciones','No positions')}${r.cash?' · '+text('Efectivo ','Cash ')+euros(r.cash):''}</small></td><td data-label="${text('Ingresado','Deposited')}">${euros(r.deposits)}</td><td data-label="${text('Retirado','Withdrawn')}">${euros(r.withdrawals)}</td><td data-label="${text('Actual','Current')}">${euros(r.current)}</td><td data-label="${text('Beneficio','Profit')}" class="${r.profit>0?'up':r.profit<0?'dn':''}">${r.profit>0?'+':''}${euros(r.profit)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="broker-note">${text('Activa Editar para añadir tus brokers y repartir las posiciones.','Enable Edit to add brokers and allocate positions.')}</p>`}
    <p class="broker-note">${text('Beneficio = actual + retirado − ingresado. Actual incluye acciones y efectivo.','Profit = current + withdrawn − deposited. Current includes stocks and cash.')}</p>
    ${rows.some(r=>r.missing)?`<p class="broker-note">${text('Esperando cotizaciones: — no significa saldo cero.','Waiting for quotes: — does not mean zero balance.')}</p>`:''}`;
  const assigned=(D.brokers||[]).reduce((n,b)=>n+b.cash,0);
  if(assigned>(D.cash||0)+0.01)root.querySelector('#brokerOverview').insertAdjacentHTML('beforeend',`<p class="broker-note dn">${text('El efectivo por broker supera el total. Revisa el reparto en Editar brokers.','Broker cash exceeds portfolio cash. Review the split in Edit brokers.')}</p>`);
  const canvas=root.querySelector('#cBrokers');
  if(!canvas || !window.Chart)return;
  chart=new Chart(canvas,{
    type:'bar',
    data:{labels:rows.map(r=>r.name||text('Sin asignar','Unassigned')),datasets:[
      {label:text('Ingresado','Deposited'),data:rows.map(r=>r.deposits),backgroundColor:'#5588ff',borderRadius:4},
      {label:text('Retirado','Withdrawn'),data:rows.map(r=>r.withdrawals),backgroundColor:'#ffaa22',borderRadius:4},
      {label:text('Actual','Current'),data:rows.map(r=>r.current),backgroundColor:'#22df8a',borderRadius:4}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{labels:legOpts},tooltip:{...ttOpts,callbacks:{label:c=>c.dataset.label+': '+euros(c.parsed.y)}}},
      scales:{
        x:{grid:{display:false},ticks:{color:'#9ba9bf',font:{size:11}}},
        y:{beginAtZero:true,ticks:{color:'#9ba9bf',callback:v=>new Intl.NumberFormat(locale(),{notation:'compact',maximumFractionDigits:1}).format(v)+' €'},grid:{color:'#8290ad20'}}
      }
    }
  });
}
function openEditor(){
  if(!editable())return;
  editorOpen=true;
  const root=document.getElementById('brokerEditor');
  const known=[...new Set([...(D.brokers||[]).map(b=>brokerName(b.name)),...(D.holdings||[]).flatMap(h=>holdingAllocations(h).map(a=>a.broker))])];
  const accounts=known.length?known:['IBKR','Trading212','Degiro','XTB'];
  const fields=(name,value,attributes='')=>`<input ${attributes} aria-label="${esc(name)}" value="${esc(value??'')}" required>`;
  root.innerHTML=`<form id="brokerForm"><h3>${text('Movimientos acumulados y efectivo · EUR','Cumulative flows and cash · EUR')}</h3>
    <p class="broker-note">${text('Incluye los traspasos entre brokers en ingresado/retirado. No cambian tus aportaciones globales. Reparte el efectivo actual sin volver a sumarlo.','Include transfers between brokers in deposits/withdrawals. These do not change your global contributions. Allocate existing cash without adding it again.')}</p>
    <div class="broker-table-wrap"><table><thead><tr>${[text('Broker','Broker'),text('Ingresado','Deposited'),text('Retirado','Withdrawn'),text('Efectivo','Cash')].map(s=>`<th>${s}</th>`).join('')}<th></th></tr></thead><tbody id="brokerAccountRows"></tbody></table></div>
    <button type="button" class="btn btn-sm" id="addBrokerAccount">${text('Añadir broker','Add broker')}</button>
    <h3>${text('Acciones por broker','Shares by broker')}</h3><p class="broker-note">${text('El total de cada posición será la suma de su reparto. Cambiarlo aquí corrige cantidades; no registra compras o ventas.','Each position total is the sum of its allocations. Changes here correct quantities; they do not record purchases or sales.')}</p>
    ${(D.holdings||[]).map((h,i)=>`<fieldset class="broker-holding" data-holding="${i}"><legend>${esc(h.ticker)}</legend><div class="broker-lots"></div><button type="button" class="btn btn-sm broker-add-lot">${text('Añadir reparto','Add allocation')}</button></fieldset>`).join('')}
    <p class="broker-note">${text('Efectivo total que debes repartir: ','Total cash to allocate: ')+euros(D.cash||0)}</p><p id="brokerFormError" class="form-err" role="alert"></p>
    <div class="broker-controls"><button type="submit" class="btn btn-g">${text('Guardar','Save')}</button><button type="button" class="btn" id="cancelBrokerEdit">${text('Cancelar','Cancel')}</button></div></form>`;
  function accountRow(b={name:'',deposits:0,withdrawals:0,cash:0}){
    const tr=document.createElement('tr');tr.className='broker-account';
    tr.innerHTML=`<td>${fields(text('Nombre del broker','Broker name'),b.name,'class="broker-name" maxlength="60"')}</td>${['deposits','withdrawals','cash'].map((k,i)=>`<td>${fields([text('Ingresado','Deposited'),text('Retirado','Withdrawn'),text('Efectivo','Cash')][i],b[k],`class="broker-${k}" type="number" min="0" step="0.01"`)}</td>`).join('')}<td><button type="button" class="btn btn-sm" aria-label="${text('Quitar broker','Remove broker')}">×</button></td>`;
    tr.querySelector('button').onclick=()=>tr.remove();root.querySelector('#brokerAccountRows').append(tr);
  }
  for(const name of accounts)accountRow((D.brokers||[]).find(b=>brokerName(b.name)===name)||{name,deposits:0,withdrawals:0,cash:0});
  root.querySelector('#addBrokerAccount').onclick=()=>accountRow();
  function lotRow(fieldset,lot={broker:accounts[0],shares:''}){
    const row=document.createElement('div');row.className='broker-lot';
    row.innerHTML=`${fields(text('Broker de la posición','Position broker'),lot.broker,'class="broker-lot-name" maxlength="60"')}${fields(text('Acciones','Shares'),lot.shares,'class="broker-lot-shares" type="number" min="0.00000001" step="any"')}<button type="button" class="btn btn-sm" aria-label="${text('Quitar reparto','Remove allocation')}">×</button>`;
    row.querySelector('button').onclick=()=>row.remove();fieldset.querySelector('.broker-lots').append(row);
  }
  for(const fieldset of root.querySelectorAll('[data-holding]')){
    const h=D.holdings[Number(fieldset.dataset.holding)],lots=holdingAllocations(h);
    for(const lot of lots.length?lots:[{broker:accounts[0],shares:h.shares}])lotRow(fieldset,lot);
    fieldset.querySelector('.broker-add-lot').onclick=()=>lotRow(fieldset);
  }
  root.querySelector('#cancelBrokerEdit').onclick=()=>{root.replaceChildren();editorOpen=false;};
  root.querySelector('#brokerForm').onsubmit=async e=>{
    e.preventDefault();if(!editable())return;
    const button=e.submitter;button.disabled=true;
    try{
      const brokers=[...root.querySelectorAll('.broker-account')].map(row=>({name:brokerName(row.querySelector('.broker-name').value),...Object.fromEntries(['deposits','withdrawals','cash'].map(k=>[k,Number(row.querySelector('.broker-'+k).value)]))}));
      const positions=[...root.querySelectorAll('[data-holding]')].map(fieldset=>{const brokerAllocations=[...fieldset.querySelectorAll('.broker-lot')].map(row=>({broker:brokerName(row.querySelector('.broker-lot-name').value),shares:Number(row.querySelector('.broker-lot-shares').value)}));return {ticker:D.holdings[Number(fieldset.dataset.holding)].ticker,shares:brokerAllocations.reduce((n,a)=>n+a.shares,0),brokerAllocations};});
      await apply({format:'trackcmg-brokers',brokers,positions});
    }catch(error){root.querySelector('#brokerFormError').textContent=error.message;}finally{button.disabled=false;}
  };
}
document.addEventListener('portfolio-updated',renderBrokers);
