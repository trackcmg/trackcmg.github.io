import {D,setAuthed} from '/js/state.js';
import {loadDataFromObj} from '/js/storage.js';
import {renderPortfolio,renderHistory} from '/js/portfolio.js';
import {renderAnalytics} from '/js/analytics.js';
import {renderTrades} from '/js/trades.js';
import {initI18n} from '/js/i18n.js';
import '/js/modals.js';
loadDataFromObj({cash:50,totalInvested:550,holdings:[
  {ticker:'DEMO.L',name:'Demo split position',shares:100,entryPrice:1,currency:'GBP',color:'#5588ff',brokerAllocations:[{broker:'Trading212',shares:20},{broker:'Degiro',shares:80}]},
  {ticker:'DEMO',name:'Demo single position',shares:10,entryPrice:4,currency:'USD',color:'#ffaa22',broker:'IBKR'}
],brokers:[{name:'IBKR',deposits:200,withdrawals:0,cash:50},{name:'Trading212',deposits:100,withdrawals:0,cash:0},{name:'Degiro',deposits:750,withdrawals:0,cash:0},{name:'XTB',deposits:1000,withdrawals:1500,cash:0}],history:[],closedTrades:[],gym:[],books:[],movies:[],series:[],games:[],watchlist:[],preferences:{language:'es',theme:'dark'}});
setAuthed(true);initI18n();
document.getElementById('loginOv').style.display='none';
const edit=document.getElementById('btnAdmin');edit.style.display='';
edit.onclick=()=>{document.body.classList.toggle('edit-mode');edit.textContent=document.body.classList.contains('edit-mode')?'Editando':'Editar';renderPortfolio();renderAnalytics();};
document.getElementById('tabBar').onclick=e=>{if(!e.target.matches('.tab-btn'))return;document.querySelectorAll('.tab-btn,.tab-content').forEach(t=>t.classList.remove('active'));e.target.classList.add('active');document.getElementById('tab-'+e.target.dataset.tab).classList.add('active');renderAnalytics();};
renderPortfolio();renderHistory();renderTrades();renderAnalytics();
document.querySelector('[data-tab="analytics"]').click();
document.getElementById('analyticsSummary').insertAdjacentHTML('beforebegin','<p data-no-i18n>PRUEBA AISLADA · datos ficticios · sin conexión a Drive</p>');
document.addEventListener('click',e=>{const card=e.target.closest('.stock[data-edit-type]');if(card && document.body.classList.contains('edit-mode'))window.openEditModal(card.dataset.editType,Number(card.dataset.editIdx));});
