import { D, _authed } from './state.js';
import { language, locale } from './i18n.js';
import { esc, today } from './life-schema.js';
import { F, toast, ttOpts, legOpts } from './utils.js';
import { getPriceData, valEur, renderPortfolio, renderHistory } from './portfolio.js';
import { buildDataObj } from './storage.js';
import { saveAndSync } from './cloud.js';
import { brokerName, holdingAllocations, brokerSummary, prepareBrokerSetup, prepareBrokerMovement, prepareBrokerCashEdit, brokerSnapshotPatch } from './broker-model.js';

const text=(es,en)=>language()==='es'?es:en;
const euros=n=>Number.isFinite(n)?F(n,0)+' €':'—';
let chart, editorOpen=false;
function editable(){return _authed && document.body.classList.contains('edit-mode');}
function backup(download=true){
  const json=JSON.stringify(buildDataObj(),null,2);
  // If neither backup can be saved, refuse to overwrite data.
  let backed=false;
  try{localStorage.setItem('db_data_prebroker_backup',json);backed=true;}catch{}
  if(download)try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='trackcmg-pre-brokers-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);backed=true;}catch{}
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
    root.innerHTML='<div id="brokerOverview"></div><div class="add-section broker-controls"><button class="btn btn-g" id="brokerMovement"></button><button class="btn" id="brokerPositions"></button><button class="btn" id="brokerAddPosition"></button><button class="btn" id="editBrokers"></button><button class="btn" id="importBrokers"></button><input type="file" id="brokerFile" accept=".json,application/json" hidden></div><div id="brokerEditor" class="add-section"></div>';
    root.querySelector('#editBrokers').onclick=()=>openEditor();
    root.querySelector('#brokerMovement').onclick=openBrokerMovement;
    root.querySelector('#brokerPositions').onclick=()=>openEditor('positions');
    root.querySelector('#brokerAddPosition').onclick=()=>{if(editable())window.openAddModal('holding');};
    root.querySelector('#importBrokers').onclick=()=>{if(editable())root.querySelector('#brokerFile').click();};
    root.querySelector('#brokerFile').onchange=async e=>{
      const file=e.target.files[0];if(!file||!editable())return;
      try{if(file.size>1000000)throw new Error(text('Archivo demasiado grande.','File too large.'));await apply(JSON.parse(await file.text()));}
      catch(error){toast(error.message,'err');}finally{e.target.value='';}
    };
  }
  if(!document.body.classList.contains('edit-mode')){editorOpen=false;root.querySelector('#brokerEditor').replaceChildren();}
  root.querySelector('#editBrokers').textContent=text('Editar brokers','Edit brokers');
  root.querySelector('#brokerMovement').textContent=text('+ Movimiento','+ Cash movement');
  root.querySelector('#brokerPositions').textContent=text('Posiciones','Positions');
  root.querySelector('#brokerAddPosition').textContent=text('+ Acción','+ Stock');
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
function openEditor(mode='all'){
  if(!editable())return;
  editorOpen=true;
  const root=document.getElementById('brokerEditor');
  root.classList.toggle('broker-positions-only',mode==='positions');
  const known=[...new Set([...(D.brokers||[]).map(b=>brokerName(b.name)),...(D.holdings||[]).flatMap(h=>holdingAllocations(h).map(a=>a.broker))])];
  const accounts=known.length?known:['IBKR','Trading212','Degiro','XTB'];
  const fields=(name,value,attributes='')=>`<input ${attributes} aria-label="${esc(name)}" value="${esc(value??'')}" required>`;
  root.innerHTML=`<form id="brokerForm"><div class="broker-balances"><h3>${text('Movimientos acumulados y efectivo · EUR','Cumulative flows and cash · EUR')}</h3>
    <p class="broker-note">${text('Incluye los traspasos entre brokers en ingresado/retirado. No cambian tus aportaciones globales. Reparte el efectivo actual sin volver a sumarlo.','Include transfers between brokers in deposits/withdrawals. These do not change your global contributions. Allocate existing cash without adding it again.')}</p>
    <div class="broker-table-wrap"><table><thead><tr>${[text('Broker','Broker'),text('Ingresado','Deposited'),text('Retirado','Withdrawn'),text('Efectivo','Cash')].map(s=>`<th>${s}</th>`).join('')}<th></th></tr></thead><tbody id="brokerAccountRows"></tbody></table></div>
    <button type="button" class="btn btn-sm" id="addBrokerAccount">${text('Añadir broker','Add broker')}</button></div>
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

export function brokerError(error){
  const messages={
    'Invalid broker movement':'Introduce un movimiento válido.',
    'Enter at least 0.01 EUR':'Introduce al menos 0,01 €.',
    'Select a broker':'Selecciona un broker.',
    'Not enough broker cash':'No hay suficiente efectivo en ese broker.',
    'Select a different destination broker':'Elige otro broker de destino.',
    'Withdrawal exceeds total invested':'La retirada supera el total aportado. Revisa el importe.',
    'Invalid cash balances':'Revisa los importes de efectivo e invertido.',
    'Invalid broker cash allocation':'Revisa el reparto de efectivo.',
    'Allocate cash for every broker':'Indica el efectivo de cada broker.',
    'Select the broker for the invested-capital change':'Selecciona a qué broker asignar el cambio de invertido.'
  };
  return language()==='es'?(messages[error.message]||error.message):error.message;
}
function applyCashPatch(next){
  backup(false);
  const changed=next.cash!==D.cash || next.totalInvested!==D.totalInvested;
  const snapshot=changed?brokerSnapshotPatch({...D,...next},h=>Number.isFinite(getPriceData(h.ticker)?.price)?valEur(h):null,today()):{};
  Object.assign(D,next,snapshot);
}
export function brokerCashFields(){
  const unassigned=Math.max(0,(D.cash||0)-(D.brokers||[]).reduce((n,b)=>n+b.cash,0));
  return `<div data-no-i18n><h2>${text('Efectivo e invertido','Cash and invested capital')}</h2>
    ${(D.brokers||[]).map((b,i)=>`<div class="fg"><label>${esc(b.name)} · ${text('efectivo (€)','cash (€)')}</label><input class="broker-cash-input" type="number" min="0" step="0.01" id="eBrokerCash${i}" value="${b.cash}"></div>`).join('')}
    <div class="fg"><label>${text('Efectivo sin asignar (€)','Unassigned cash (€)')}</label><input class="broker-cash-input" type="number" min="0" step="0.01" id="eUnassignedCash" value="${unassigned.toFixed(2)}"></div>
    <div class="fg"><label>${text('Efectivo total (€)','Total cash (€)')}</label><input type="number" id="eCash" readonly value="${D.cash}"></div>
    <div class="fg"><label>${text('Total invertido en la cartera (€)','Total portfolio contributions (€)')}</label><input type="number" min="0" step="0.01" id="eInvested" value="${D.totalInvested}"></div>
    <div class="fg"><label>${text('Broker del cambio de invertido','Broker for the contribution adjustment')}</label><select id="eInvestedBroker"><option value="">${text('Elige si cambias el invertido','Choose when changing contributions')}</option>${(D.brokers||[]).map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}</select></div>
    <p class="broker-note">${text('Esto corrige saldos. Para añadir dinero nuevo, usa «Movimiento» en Brokers.','This corrects balances. To record new money, use Cash movement in Brokers.')}</p></div>`;
}
export function initBrokerCashFields(){
  const update=()=>{
    const values=[...document.querySelectorAll('.broker-cash-input')].map(e=>Number(e.value));
    document.getElementById('eCash').value=values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0).toFixed(2):'';
  };
  document.querySelectorAll('.broker-cash-input').forEach(input=>input.addEventListener('input',update));
}
export function saveBrokerCashFields(){
  const read=id=>{const value=document.getElementById(id)?.value;return value?.trim()?Number(value):NaN;};
  const next=prepareBrokerCashEdit(D,{allocations:D.brokers.map((b,i)=>({name:b.name,cash:read('eBrokerCash'+i)})),unassignedCash:read('eUnassignedCash'),totalInvested:read('eInvested'),investmentBroker:document.getElementById('eInvestedBroker').value});
  applyCashPatch(next);
}
export function openBrokerMovement(){
  if(!editable())return;
  if(!(D.brokers||[]).length){toast(text('Añade primero tus brokers.','Add your brokers first.'),'err');return;}
  const root=document.getElementById('mod');
  const options=D.brokers.map(b=>`<option value="${esc(b.name)}">${esc(b.name)} · ${euros(b.cash)}</option>`).join('');
  root.innerHTML=`<form id="brokerMovementForm" data-no-i18n><h2>${text('Registrar movimiento','Record cash movement')}</h2>
    <div class="fg"><label for="brokerMovementKind">${text('Tipo','Type')}</label><select id="brokerMovementKind"><option value="deposit">${text('Ingreso','Deposit')}</option><option value="withdrawal">${text('Retirada','Withdrawal')}</option><option value="transfer">${text('Traspaso entre brokers','Transfer between brokers')}</option></select></div>
    <div class="fg"><label for="brokerMovementSource">Broker</label><select id="brokerMovementSource">${options}</select></div>
    <div class="fg" id="brokerMovementTargetWrap" hidden><label for="brokerMovementTarget">${text('Broker de destino','Destination broker')}</label><select id="brokerMovementTarget">${options}</select></div>
    <div class="fg"><label for="brokerMovementAmount">${text('Importe (€)','Amount (€)')}</label><input type="number" id="brokerMovementAmount" min="0.01" step="0.01" required></div>
    <p class="broker-note" id="brokerMovementHelp"></p><p class="form-err" id="brokerMovementError" role="alert"></p>
    <div class="m-btns"><button type="button" class="btn" id="cancelBrokerMovement">${text('Cancelar','Cancel')}</button><button type="submit" class="btn btn-g" id="saveBrokerMovement">${text('Guardar movimiento','Save movement')}</button></div></form>`;
  const kind=root.querySelector('#brokerMovementKind');
  kind.onchange=()=>{
    root.querySelector('#brokerMovementTargetWrap').hidden=kind.value!=='transfer';
    root.querySelector('#brokerMovementHelp').textContent=kind.value==='transfer'?text('Mueve efectivo entre brokers sin cambiar lo aportado a la cartera.','Moves cash between brokers without changing portfolio contributions.'):text('Actualiza el efectivo del broker y las aportaciones de la cartera. Se registra hoy.','Updates broker cash and portfolio contributions. Recorded today.');
  };kind.onchange();
  root.querySelector('#cancelBrokerMovement').onclick=()=>document.getElementById('ov').classList.remove('open');
  root.querySelector('#brokerMovementForm').onsubmit=async e=>{
    e.preventDefault();if(!editable())return;
    const button=root.querySelector('#saveBrokerMovement');if(button.disabled)return;button.disabled=true;
    try{
      const next=prepareBrokerMovement(D,{kind:kind.value,broker:root.querySelector('#brokerMovementSource').value,toBroker:root.querySelector('#brokerMovementTarget').value,amount:Number(root.querySelector('#brokerMovementAmount').value)});
      applyCashPatch(next);document.getElementById('ov').classList.remove('open');
      renderPortfolio();renderHistory();renderBrokers();document.dispatchEvent(new Event('brokers-updated'));
      await saveAndSync();
    }catch(error){root.querySelector('#brokerMovementError').textContent=brokerError(error);}finally{button.disabled=false;}
  };
  document.getElementById('ov').classList.add('open');
}
