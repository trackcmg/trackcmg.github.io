// Explicit, read-only library audit. Private input/output live OUTSIDE the public repo.
// Only title, author, director and release year are used for public provider searches.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),input=process.argv[2],output=process.argv[3];
if(!input||!output)throw new Error('Usage: node tests/artwork-audit.cjs <private-backup.json> <private-audit.json>');
if(path.resolve(output).startsWith(root+path.sep))throw new Error('Audit output must remain outside the public repository');
const read=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const cachePath=path.join(path.dirname(output),'provider-responses.json');
let responses={};try{responses=JSON.parse(fs.readFileSync(cachePath,'utf8'));}catch{}
const lanes=new Map(),inflight=new Map();
async function providedJSON(url){
  if(responses[url])return responses[url];if(inflight.has(url))return inflight.get(url);
  const host=new URL(url).hostname,laneKey=host.endsWith('wikipedia.org')?'wiki':host;
  const lane=lanes.get(laneKey)||{tail:Promise.resolve(),last:0};lanes.set(laneKey,lane);
  const job=lane.tail.catch(()=>{}).then(async()=>{
    const delay=Math.max(0,(host==='openlibrary.org'?1100:350)-(Date.now()-lane.last));if(delay)await new Promise(r=>setTimeout(r,delay));lane.last=Date.now();
    const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'TrackCMG-library-audit/1.0 (https://trackcmg.github.io/)'}});
    if(!r.ok)throw new Error('Provider HTTP '+r.status);const json=await r.json();if(json.error)throw new Error(json.error.code||'API error');
    responses[url]=json;fs.writeFileSync(cachePath,JSON.stringify(responses));return json;
  });lane.tail=job;inflight.set(url,job);try{return await job;}finally{inflight.delete(url);}
}
const memory=new Map(),ctx=vm.createContext({URL,URLSearchParams,AbortController,console,fetch,setTimeout,clearTimeout,Date,esc:x=>x,t:x=>x,providedJSON,localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}});
vm.runInContext(read('artwork-model.js')+'\n'+read('artwork.js')+'\ngetJSON=providedJSON;this.M={searchArtwork,chooseArtwork,scoreArtwork,artworkKey,validArtwork};',ctx);
const data=JSON.parse(fs.readFileSync(input,'utf8')),jobs=[];
for(const [kind,key]of [['movie','movies'],['book','books'],['serie','series'],['game','games']])for(const [index,x]of (data[key]||[]).entries())jobs.push({kind,key,index,item:{title:x.title,translations:x.translations,author:x.author,director:x.director,year:x.year,years:x.years,releaseYear:x.releaseYear,developer:x.developer,artwork:x.artwork}});
const result={input:path.basename(input),at:new Date().toISOString(),items:[]};
let done=0,cursor=0;
function checkpoint(){fs.writeFileSync(output,JSON.stringify(result,null,2));}
async function worker(){while(cursor<jobs.length){const job=jobs[cursor++];let candidates=[],chosen=null,error=null;
  try{if(job.item.artwork===false){}else if(job.item.artwork&&ctx.M.validArtwork(job.item.artwork)){chosen=job.item.artwork;}else{candidates=await ctx.M.searchArtwork(job.kind,job.item);chosen=ctx.M.chooseArtwork(job.kind,job.item,candidates);}}catch(e){error=e.message;}
  result.items.push({kind:job.kind,key:job.key,index:job.index,title:job.item.title,identity:ctx.M.artworkKey(job.kind,job.item),chosen,candidates:candidates.slice(0,6).map(c=>({...c,score:ctx.M.scoreArtwork(job.kind,job.item,c)})),error});
  done++;checkpoint();if(done%10===0||done===jobs.length)console.log(JSON.stringify({done,total:jobs.length,matched:result.items.filter(x=>x.chosen).length}));
}}
Promise.all([worker(),worker(),worker()]).then(()=>{result.items.sort((a,b)=>a.key.localeCompare(b.key)||a.index-b.index);checkpoint();for(const key of ['movies','books','series','games']){const rows=result.items.filter(x=>x.key===key);console.log(JSON.stringify({key,total:rows.length,matched:rows.filter(x=>x.chosen).length,missing:rows.filter(x=>!x.chosen).map(x=>x.title)}));}}).catch(e=>{console.error(e);process.exitCode=1;});
