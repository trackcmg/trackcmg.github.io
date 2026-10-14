// Shared, pure health transformation. Never reads/writes financial state D.
export const HEALTH_TYPES = ['steps','distance','activeCalories','totalCalories','sleep','heartRate','restingHeartRate','oxygenSaturation','exercise','heartRateVariability','respiratoryRate','elevation','floors','weight','height','bodyFat','bodyTemperature','basalTemperature','vo2Max','speed','power','cyclingCadence','stepsCadence'];
export const HEALTH_TOTALS = ['steps','distance','activeCalories','totalCalories','elevation','floors'];
const HEALTH_UNITS = {steps:'steps',distance:'m',activeCalories:'kcal',totalCalories:'kcal',sleep:'h',heartRate:'bpm',restingHeartRate:'bpm',oxygenSaturation:'%',exercise:'min',heartRateVariability:'ms',respiratoryRate:'breaths/min',elevation:'m',floors:'floors',weight:'kg',height:'m',bodyFat:'%',bodyTemperature:'C',basalTemperature:'C',vo2Max:'ml/kg/min',speed:'m/s',power:'W',cyclingCadence:'rpm',stepsCadence:'steps/min'};
function healthAssert(ok, message) { if (!ok) throw new Error(message); }
function healthSource(s) { return typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(s); }
function healthInstant(s) { return typeof s === 'string' && /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s)); }
function healthFinite(v) { return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12; }
const healthDateFormatters=new Map();
export function healthDate(instant, zone) {
  if(!healthDateFormatters.has(zone))healthDateFormatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}));
  const parts = healthDateFormatters.get(zone).formatToParts(new Date(instant));
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export function validateHealthSnapshot(s) {
  healthAssert(s && s.format === 'trackcmg-health-probe' && s.schemaVersion === 1, 'unsupported_health_format');
  healthAssert(healthInstant(s.start) && healthInstant(s.end) && healthInstant(s.generatedAt), 'invalid_health_dates');
  healthAssert(Date.parse(s.start) < Date.parse(s.end) && Date.parse(s.end)-Date.parse(s.start) <= 8*86400000, 'invalid_health_window');
  healthAssert(Math.abs(Date.parse(s.generatedAt)-Date.parse(s.end)) < 3600000, 'invalid_health_generation');
  healthDate(s.end,s.timeZone); // Validate time zone, without silently falling back to UTC.
  healthAssert(Array.isArray(s.types) && s.types.length <= HEALTH_TYPES.length, 'invalid_health_types');
  const seen=new Set(); let records=0,samples=0;
  for (const bucket of s.types) {
    healthAssert(bucket && HEALTH_TYPES.includes(bucket.type) && !seen.has(bucket.type), 'invalid_health_type'); seen.add(bucket.type);
    healthAssert(['ok','permission_denied','truncated','serialization_error','read_error'].includes(bucket.status) || /^read_error_\d+$/.test(bucket.status), 'invalid_health_status');
    healthAssert(Array.isArray(bucket.records) && bucket.records.length<=20000, 'too_many_health_records');
    for (const r of bucket.records) {
      healthAssert(r && typeof r.id==='string' && r.id.length<=200 && healthSource(r.source), 'invalid_health_record');
      healthAssert(healthInstant(r.time || r.start) && (!r.end || healthInstant(r.end)), 'invalid_record_time');
      if (r.value !== undefined) healthAssert(healthFinite(r.value) && r.unit===HEALTH_UNITS[bucket.type], 'invalid_health_value');
      if (r.samples !== undefined) {
        healthAssert(Array.isArray(r.samples) && r.samples.length<=100000 && r.unit===HEALTH_UNITS[bucket.type], 'invalid_health_samples');
        for (const p of r.samples) healthAssert(p && healthInstant(p.time) && healthFinite(p.value), 'invalid_health_sample');
        samples+=r.samples.length;
      }
      if (r.stages !== undefined) {
        healthAssert(bucket.type==='sleep' && Array.isArray(r.stages) && r.stages.length<=10000, 'invalid_sleep_stages');
        for (const p of r.stages) healthAssert(p && healthInstant(p.start) && healthInstant(p.end) && Date.parse(p.end)>=Date.parse(p.start) && Number.isInteger(p.stageType) && p.stageType>=0 && p.stageType<=7, 'invalid_sleep_stage');
      }
      records++;
    }
  }
  healthAssert(records<=100000 && samples<=300000, 'health_snapshot_too_large');
  healthAssert(Array.isArray(s.dailyAggregates) && s.dailyAggregates.length<=500, 'daily_aggregates_required');
  for (const a of s.dailyAggregates) {
    healthAssert(a && HEALTH_TOTALS.includes(a.type) && healthSource(a.source) && ['ok','error'].includes(a.status), 'invalid_daily_aggregate');
    healthAssert(Array.isArray(a.days) && a.days.length<=8, 'invalid_aggregate_days');
    const dates=new Set();
    for(const d of a.days) {
      healthAssert(d && /^\d{4}-\d\d-\d\d$/.test(d.date) && !dates.has(d.date), 'invalid_aggregate_date'); dates.add(d.date);
      healthAssert(d.value===null || (healthFinite(d.value) && d.value>=0), 'invalid_aggregate_value');
    }
  }
  return s;
}
function healthUnion(intervals) {
  intervals.sort((a,b)=>a[0]-b[0]); let duration=0,end=-Infinity;
  for(const [a,b] of intervals) { if(b>end)duration+=b-Math.max(a,end); end=Math.max(end,b); }
  return duration;
}
export function normalizeHealth(s) {
  validateHealthSnapshot(s);
  const first=healthDate(s.start,s.timeZone),last=healthDate(s.end,s.timeZone);
  const rows=new Map(), seen=new Set(), clear=new Set(), warnings=[];
  const row=(date,source)=>{
    if(date<first || date>last)return null;
    const key=source+'|'+date;
    if(!rows.has(key))rows.set(key,{date,source,metrics:{}});
    return rows.get(key);
  };
  for(const a of s.dailyAggregates) {
    if(a.status!=='ok'){warnings.push(a.type+': aggregate unavailable');continue;}
    clear.add(a.type+'|'+a.source);
    for(const day of a.days) if(day.value!==null) {
      const dest=row(day.date,a.source);
      if(dest)dest.metrics[a.type]={value:day.value,unit:HEALTH_UNITS[a.type],method:'health_connect_aggregate'};
    }
  }
  const valueGroups=new Map(),sleepGroups=new Map(),exerciseGroups=new Map();
  for(const bucket of s.types) {
    if(bucket.status!=='ok') {warnings.push(bucket.type+': '+bucket.status);continue;}
    if(!HEALTH_TOTALS.includes(bucket.type))clear.add(bucket.type+'|*');
    // Empty successful reads remove stale values, but are NEVER treated as measured zeros.
    if(HEALTH_TOTALS.includes(bucket.type)) {
      if(bucket.records.length===0)clear.add(bucket.type+'|*');
      continue; // Never sum raw steps/calories across overlapping sources or intervals.
    }
    for(const r of bucket.records) {
      const id=bucket.type+'|'+r.source+'|'+r.id;
      if(seen.has(id))continue; seen.add(id);
      if(bucket.type==='sleep') {
        const key=r.source+'|'+healthDate(r.end,s.timeZone);
        if(!sleepGroups.has(key))sleepGroups.set(key,{source:r.source,date:healthDate(r.end,s.timeZone),sleep:[],bed:[]});
        const g=sleepGroups.get(key);
        g.bed.push([Date.parse(r.start),Date.parse(r.end)]);
        for(const p of r.stages||[])if([2,4,5,6].includes(p.stageType)) {
          const a=Math.max(Date.parse(r.start),Date.parse(p.start)),b=Math.min(Date.parse(r.end),Date.parse(p.end));
          if(b>a)g.sleep.push([a,b]);
        }
      } else if(bucket.type==='exercise') {
        const date=healthDate(r.start,s.timeZone),key=r.source+'|'+date;
        if(!exerciseGroups.has(key))exerciseGroups.set(key,{date,source:r.source,intervals:[],count:0});
        const g=exerciseGroups.get(key);g.count++;g.intervals.push([Date.parse(r.start),Date.parse(r.end)]);
      } else {
        for(const p of r.samples || [{time:r.time || r.start,value:r.value}]) {
          if(!healthFinite(p.value))continue;
          const date=healthDate(p.time,s.timeZone),key=r.source+'|'+date+'|'+bucket.type;
          if(!valueGroups.has(key))valueGroups.set(key,{date,source:r.source,type:bucket.type,n:0,sum:0,min:Infinity,max:-Infinity});
          const g=valueGroups.get(key);g.n++;g.sum+=p.value;g.min=Math.min(g.min,p.value);g.max=Math.max(g.max,p.value);
        }
      }
    }
  }
  for(const g of valueGroups.values()) {const dest=row(g.date,g.source);if(dest)dest.metrics[g.type]={value:g.sum/g.n,min:g.min,max:g.max,samples:g.n,unit:HEALTH_UNITS[g.type],method:'sample_mean'};}
  for(const g of sleepGroups.values()) {const dest=row(g.date,g.source);if(dest) {
    dest.metrics.inBed={value:healthUnion(g.bed)/3600000,unit:'h',method:'interval_union'};
    if(g.sleep.length)dest.metrics.sleep={value:healthUnion(g.sleep)/3600000,unit:'h',method:'sleep_stages',wakeDate:true};
  }}
  for(const g of exerciseGroups.values()) {const dest=row(g.date,g.source);if(dest)dest.metrics.exercise={value:healthUnion(g.intervals)/60000,sessions:g.count,unit:'min',method:'interval_union'};}
  return {rows:[...rows.values()],clear:[...clear],first,last,warnings};
}
export function mergeHealth(previous,snapshot) {
  const normalized=normalizeHealth(snapshot);
  if(previous?.updatedAt && Date.parse(previous.updatedAt)>=Date.parse(snapshot.generatedAt))return previous;
  const days=new Map((previous?.days||[]).map(r=>[r.source+'|'+r.date,JSON.parse(JSON.stringify(r))]));
  for(const r of days.values())if(r.date>=normalized.first && r.date<=normalized.last) {
    for(const k of normalized.clear) {
      const [type,source]=k.split('|');
      if(source==='*'||source===r.source){delete r.metrics[type];if(type==='sleep')delete r.metrics.inBed;}
    }
  }
  for(const r of normalized.rows) {
    const key=r.source+'|'+r.date,old=days.get(key);
    days.set(key,{date:r.date,source:r.source,metrics:{...(old?.metrics||{}),...r.metrics}});
  }
  return {schemaVersion:1,updatedAt:snapshot.generatedAt,timeZone:snapshot.timeZone,
    days:[...days.values()].filter(r=>Object.keys(r.metrics).length).sort((a,b)=>a.date.localeCompare(b.date)||a.source.localeCompare(b.source)),
    warnings:normalized.warnings,availability:snapshot.types.map(b=>({type:b.type,status:b.status,count:b.records.length})),
    latestSnapshot:snapshot};
}
