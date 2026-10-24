// Opt-in, read-only provider smoke test. Only public example titles are transmitted.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const mem=new Map(),ctx=vm.createContext({URL,URLSearchParams,AbortController,console,fetch,setTimeout,clearTimeout,Date,esc:x=>x,t:x=>x,localStorage:{getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v)}});
vm.runInContext(read('artwork-model.js')+'\n'+read('artwork.js')+'\nthis.M={searchArtwork,chooseArtwork,scoreArtwork};',ctx);
(async()=>{
  for(const [kind,item] of [['movie',{title:'Scarface',year:1983}],['book',{title:'Dune',author:'Frank Herbert',year:1965}],['serie',{title:'El pingüino',years:'2024'}],['game',{title:'Elden Ring',releaseYear:2022}]]){
    const results=await ctx.M.searchArtwork(kind,item),chosen=ctx.M.chooseArtwork(kind,item,results);
    console.log(JSON.stringify({kind,title:item.title,chosen:chosen?.title||null,url:chosen?.url||null,candidates:results.slice(0,3).map(c=>({title:c.title,year:c.year,alias:c.alias,score:ctx.M.scoreArtwork(kind,item,c)}))}));
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
