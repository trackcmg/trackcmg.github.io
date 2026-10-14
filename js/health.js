import { PROXY_URL } from './config.js';
import { getSessionToken } from './auth.js';
import { language } from './i18n.js';

// Health is deliberately outside D, buildDataObj, finance backups and service-worker API caches.
let data=null,device=null,busy=false,code=null,source='',period=30;
let authGeneration=0;
const pending=new Set();
const charts=[];
const text=(es,en)=>language()==='es'?es:en;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const locale=()=>language()==='es'?'es-ES':'en-GB';
const number=(value,digits=0)=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{maximumFractionDigits:digits}).format(value):'—';
const date=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString(locale(),{day:'numeric',month:'short'}):'—';
const stamp=s=>s?new Date(s).toLocaleString(locale()):'—';
const definitions=()=>[
  ['steps',text('Pasos','Steps'),'',0],['activeCalories',text('Calorías activas','Active calories'),'kcal',0],
  ['heartRate',text('Pulso medio','Mean heart rate'),'bpm',0],['oxygenSaturation',text('Oxígeno medio','Mean oxygen saturation'),'%',1],
  ['sleep',text('Sueño registrado','Recorded sleep'),'h',1],['distance',text('Distancia','Distance'),'km',2],
  ['exercise',text('Entrenamientos','Workouts'),'min',0],['restingHeartRate',text('Pulso en reposo','Resting heart rate'),'bpm',0]
];
async function request(action,extra={}){
  const token=getSessionToken();if(!token)throw new Error(text('Inicia sesión de nuevo.','Sign in again.'));
  const generation=authGeneration,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);pending.add(controller);
  try{
    const response=await fetch(PROXY_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},
      // A legacy backend must reject this, never mistake it for a finance save.
      body:JSON.stringify({action,healthSession:token,...extra}),signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    let result;try{result=await response.json();}catch{throw new Error(text('El backend de Salud aún no está disponible.','The Health backend is not available yet.'));}
    if(!result.ok)throw new Error(result.error==='unauthorized'?text('Sesión caducada. Vuelve a iniciar sesión.','Session expired. Sign in again.'):text('No se pudo completar la operación de Salud.','The Health request failed.'));
    if(generation!==authGeneration)throw new Error(text('Sesión cambiada.','Session changed.'));
    return result;
  }finally{clearTimeout(timer);pending.delete(controller);}
}
function status(message){const element=document.getElementById('healthStatus');if(element)element.textContent=message;}
export function clearHealth(){authGeneration++;for(const controller of pending)controller.abort();pending.clear();busy=false;data=null;device=null;code=null;source='';for(const c of charts.splice(0))c.destroy();renderHealth();}
export async function refreshHealth(){
  if(busy)return;busy=true;status(text('Consultando tu archivo privado…','Loading your private health file…'));
  try{const result=await request('healthGet');data=result.data;device=result.device;renderHealth();}
  catch(error){status(error.name==='AbortError'?text('El servidor está tardando. Puedes volver a intentar actualizar.','The server is taking too long. Try refreshing again.'):error.message);}
  finally{busy=false;}
}
function plot(id,labels,datasets,type='line'){
  const canvas=document.getElementById(id);if(!canvas || !window.Chart)return;
  charts.push(new Chart(canvas,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},plugins:{legend:{display:datasets.length>1,labels:{color:'#9ba9bf'}}},
    scales:{x:{ticks:{maxTicksLimit:6,color:'#9ba9bf'},grid:{display:false}},y:{ticks:{color:'#9ba9bf'},grid:{color:'#8290ad20'}}}}}));
}
export function renderHealth(){
  const root=document.getElementById('healthDashboard');if(!root)return;
  const tab=document.querySelector('[data-tab="health"]');if(tab)tab.textContent=text('Salud','Health');
  for(const c of charts.splice(0))c.destroy();
  const sources=[...new Set((data?.days||[]).map(r=>r.source))];
  if(!sources.includes(source))source=sources.find(s=>/xiaomi|wearable|mifit/i.test(s))||sources[0]||'';
  const rows=(data?.days||[]).filter(r=>r.source===source).sort((a,b)=>a.date.localeCompare(b.date));
  const latestDate=rows.at(-1)?.date;
  const cutoff=latestDate&&period?new Date(Date.parse(latestDate+'T12:00:00Z')-(period-1)*86400000).toISOString().slice(0,10):'';
  const inRange=rows.filter(r=>!cutoff||r.date>=cutoff),visible=[];
  const byDate=new Map(inRange.map(r=>[r.date,r]));
  if(inRange.length)for(let day=Date.parse(inRange[0].date+'T12:00:00Z'),end=Date.parse(latestDate+'T12:00:00Z');day<=end;day+=86400000){
    const key=new Date(day).toISOString().slice(0,10);visible.push(byDate.get(key)||{date:key,source,metrics:{}});
  }
  const latest=key=>[...rows].reverse().find(r=>r.metrics[key]);
  const extraDefinitions=[
    ['totalCalories',text('Calorías totales','Total calories')],['heartRateVariability',text('Variabilidad cardíaca','Heart rate variability')],
    ['respiratoryRate',text('Frecuencia respiratoria','Respiratory rate')],['elevation',text('Desnivel ascendido','Elevation gained')],
    ['floors',text('Plantas subidas','Floors climbed')],['weight',text('Peso','Weight')],['height',text('Altura','Height')],
    ['bodyFat',text('Grasa corporal','Body fat')],['bodyTemperature',text('Temperatura corporal','Body temperature')],
    ['basalTemperature',text('Temperatura basal','Basal temperature')],['vo2Max','VO₂ max'],['speed',text('Velocidad','Speed')],
    ['power',text('Potencia','Power')],['cyclingCadence',text('Cadencia de ciclismo','Cycling cadence')],
    ['stepsCadence',text('Cadencia de pasos','Step cadence')],['inBed',text('Intervalo en cama, no sueño confirmado','In-bed interval, not confirmed sleep')]
  ].filter(([key])=>latest(key));
  root.innerHTML=`<div class="health-heading"><div><h2>${text('Salud','Health')}</h2><p>${text('Datos de tu pulsera, en privado.','Your wearable data, kept private.')}</p></div><button class="btn" id="healthRefresh">↻ ${text('Actualizar','Refresh')}</button></div>
    <div class="card health-connection add-section"><div><h3>${text('Tu móvil','Your phone')}</h3><p>${device?text('Vinculado','Paired')+' · '+text('Último contacto: ','Last contact: ')+stamp(device.lastSeen):text('Sin móvil vinculado. Instala la app y genera un código.','No phone paired. Install the app and generate a code.')}</p></div>
    <div class="health-actions"><a class="btn" href="downloads/TrackCMG-Salud-0.2.0.apk" download>${text('Descargar app Android','Download Android app')}</a><button class="btn btn-g" id="healthPair">${text('Vincular móvil','Pair phone')}</button>${device?`<button class="btn" id="healthRevoke">${text('Revocar acceso','Revoke access')}</button>`:''}</div>
    <div id="healthPairCode">${code&&code.expiresAt>Date.now()?`<strong class="health-code">${escape(code.code)}</strong><p>${text('Código de un solo uso. Caduca a las ','Single-use code. Expires at ')+stamp(new Date(code.expiresAt).toISOString())}</p>`:''}</div>
    <p class="health-muted">${text('En la app: vincula el código, activa la automática y pulsa «Sincronizar ahora» para el primer envío. Android decide cuándo ejecutar los siguientes envíos.','In the app: pair with this code, enable automatic sync and tap Sync now for the first upload. Android controls subsequent background execution.')}</p></div>
    <p id="healthStatus" role="status">${data?.updatedAt?text('Última lectura enviada: ','Last uploaded scan: ')+stamp(data.updatedAt):text('Aún no se han enviado datos a tu Drive.','No health data has been uploaded to your Drive yet.')}</p>
    <div class="health-toolbar"><label>${text('Fuente','Source')} <select id="healthSource">${sources.map(s=>`<option value="${escape(s)}" ${s===source?'selected':''}>${escape(s==='com.xiaomi.wearable'?'Mi Fitness':s)}</option>`).join('')||`<option>${text('Sin datos','No data')}</option>`}</select></label><label>${text('Periodo','Period')} <select id="healthPeriod">${[[7,'7D'],[30,'30D'],[90,'90D'],[0,text('TODO','ALL')]].map(([v,label])=>`<option value="${v}" ${v===period?'selected':''}>${label}</option>`).join('')}</select></label></div>
    <div class="health-tiles">${definitions().map(([key,label,unit,digits])=>{const r=latest(key),metric=r?.metrics[key],value=metric?.value;return `<div class="card"><div class="health-label">${label}</div><strong>${number(key==='distance'&&Number.isFinite(value)?value/1000:value,digits)} ${metric?unit:''}</strong><small>${r?date(r.date):text('Sin datos enviados','No data shared')}</small></div>`;}).join('')}</div>
    <div class="health-chart-grid"><div class="card"><h2>${text('Pasos diarios','Daily steps')}</h2><div class="health-chart"><canvas id="healthSteps"></canvas></div></div><div class="card"><h2>${text('Pulso diario · media de muestras','Daily heart rate · sample mean')}</h2><div class="health-chart"><canvas id="healthHeart"></canvas></div></div><div class="card"><h2>${text('Sueño registrado','Recorded sleep')}</h2>${!rows.some(r=>r.metrics.sleep)?`<p class="health-empty">${text('Xiaomi todavía no ha enviado sueño a Health Connect. No se interpreta como cero horas.','Xiaomi has not shared sleep through Health Connect yet. This does not mean zero hours of sleep.')}</p>`:`<div class="health-chart"><canvas id="healthSleep"></canvas></div>`}</div><div class="card"><h2>${text('Oxígeno · media de muestras','Oxygen · sample mean')}</h2><div class="health-chart"><canvas id="healthOxygen"></canvas></div></div></div>
    ${extraDefinitions.length?`<div class="card" style="margin-bottom:18px"><h2>${text('Otras mediciones recibidas','Other shared measurements')}</h2><div class="tbl-wrap"><table><tbody>${extraDefinitions.map(([key,label])=>{const r=latest(key),metric=r.metrics[key];return `<tr><td>${label}</td><td>${number(metric.value,2)} ${escape(metric.unit)}</td><td>${date(r.date)}</td></tr>`;}).join('')}</tbody></table></div></div>`:''}
    <div class="card"><h2>${text('Registro diario','Daily log')}</h2><div class="tbl-wrap"><table><thead><tr>${[text('Fecha','Date'),text('Pasos','Steps'),'kcal',text('Pulso','Heart rate'),'SpO₂',text('Sueño','Sleep')].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${visible.slice(-90).reverse().map(r=>`<tr><td>${date(r.date)}</td>${['steps','activeCalories','heartRate','oxygenSaturation','sleep'].map(k=>`<td>${number(r.metrics[k]?.value,['sleep','oxygenSaturation'].includes(k)?1:0)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="6">${text('Esperando el primer envío de tu móvil.','Waiting for the first upload from your phone.')}</td></tr>`}</tbody></table></div></div>
    <p class="health-muted">${text('Las tarjetas muestran el último día disponible de cada métrica. Las fuentes nunca se suman entre sí. Sueño se atribuye al día de despertar y solo cuenta fases identificadas como dormido. Los datos ausentes se muestran con —.','Cards show the latest available day for each metric. Sources are never added together. Sleep is assigned to the wake-up date and only identified sleeping stages are counted. Missing data is shown as —.')}</p>
    ${data?.warnings?.length?`<p class="health-muted">${text('La última lectura tiene categorías sin permiso o incompletas. Se conservan los datos anteriores cuando una lectura falla.','The latest scan includes denied or incomplete categories. Previous data is preserved when a read fails.')}</p>`:''}`;
  document.getElementById('healthRefresh').onclick=refreshHealth;
  document.getElementById('healthSource').onchange=e=>{source=e.target.value;renderHealth();};
  document.getElementById('healthPeriod').onchange=e=>{period=Number(e.target.value);renderHealth();};
  document.getElementById('healthPair').onclick=async()=>{
    if(!confirm(text('Vincular dará al móvil acceso persistente para ENVIAR únicamente salud a tu Drive privado. Puedes revocarlo aquí. ¿Generar código?','Pairing gives this phone persistent access to UPLOAD health only to your private Drive. You can revoke it here. Generate a code?')))return;
    try{code=await request('healthCreatePair');renderHealth();}catch(error){status(error.message);}
  };
  document.getElementById('healthRevoke')?.addEventListener('click',async()=>{
    if(!confirm(text('¿Revocar la conexión del móvil? No se borrará ningún dato de salud.','Revoke the phone connection? No health data will be deleted.')))return;
    try{await request('healthRevokeDevice');device=null;code=null;renderHealth();}catch(error){status(error.message);}
  });
  if(!document.getElementById('tab-health')?.classList.contains('active'))return;
  const labels=visible.map(r=>date(r.date));
  const dataset=(key,label,color)=>({label,data:visible.map(r=>r.metrics[key]?.value??null),borderColor:color,backgroundColor:color+'66',borderWidth:2,pointRadius:2,spanGaps:false,tension:0.2});
  plot('healthSteps',labels,[dataset('steps',text('Pasos','Steps'),'#64ddc0')],'bar');
  plot('healthHeart',labels,[dataset('heartRate',text('Pulso medio','Mean heart rate'),'#ff7d98')]);
  plot('healthSleep',labels,[dataset('sleep',text('Horas dormidas','Sleeping hours'),'#aa93ff')],'bar');
  plot('healthOxygen',labels,[dataset('oxygenSaturation','SpO₂','#6abaff')]);
}
