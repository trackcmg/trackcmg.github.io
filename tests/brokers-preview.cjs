// Local QA fixture. Synthetic state and a no-network cloud double; never uses real Drive data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:");
  if(pathname==='/js/cloud.js'){
    res.setHeader('Content-Type','text/javascript');
    return res.end("export function saveAndSync(){return Promise.resolve(true)} export function updateSyncStatus(){} export function hasPendingCloudChanges(){return false}");
  }
  if(pathname==='/'){
    const quote=price=>({price,chg:0,chgPct:0,open:price,high:price,low:price,prev:price,ts:[],hist:[]});
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/^---[\s\S]*?---\s*/,'').replace(/<script src="https:\/\/accounts.google.com[^>]*><\/script>/,'').replace('<script type="module" src="js/app-update.js"></script>','').replace('src="js/app.js"','src="tests/brokers-preview.js"').replace('</head>',`<script>localStorage.setItem('pf_p',${JSON.stringify(JSON.stringify({'DEMO.L':quote(2),'DEMO':quote(5)}))});localStorage.setItem('pf_fx',JSON.stringify({USD:0.9,GBP:1.2,CAD:0.65,JPY:0.006}));</script></head>`);
    res.setHeader('Content-Type','text/html');return res.end(html);
  }
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
server.listen(51570,'127.0.0.1',()=>console.log('Broker preview: http://127.0.0.1:'+server.address().port));
