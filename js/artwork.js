import { esc } from './life-schema.js';
import { t } from './i18n.js';
import { safeArtworkUrl, validArtwork, artworkTitles, artworkYear, artworkKey, chooseArtwork, scoreArtwork, titleSimilarity } from './artwork-model.js';

const CACHE_KEY = 'track_artwork_v2';
const DAY = 86400000;
let cache;
const pending = new Map();
let networkTail = Promise.resolve(), lastRequest = 0;
function readCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { cache = {}; }
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
  return cache;
}
function remember(key, value) {
  const c = readCache(); c[key] = {at: Date.now(), value};
  const entries = Object.entries(c).filter(([,v]) => v && Date.now() - v.at < 30 * DAY).sort((a,b) => b[1].at-a[1].at).slice(0,500);
  cache = Object.fromEntries(entries);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Artwork is disposable; never evict dashboard data. */ }
}
export function cachedArtwork(kind, item) {
  if (item.artwork === false) return null;
  if (item.artwork && validArtwork(item.artwork)) return item.artwork;
  const entry = readCache()[artworkKey(kind,item)];
  return entry && Date.now()-entry.at < (entry.value ? 30 : 1)*DAY && validArtwork(entry.value) ? entry.value : undefined;
}
// One bounded request at a time, <= 1/sec. Independent from Drive and quote updates.
function getJSON(url) {
  const job = networkTail.catch(() => {}).then(async () => {
    const delay = Math.max(0, 1100-(Date.now()-lastRequest));
    if (delay) await new Promise(r => setTimeout(r, delay));
    lastRequest = Date.now();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, {signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer'});
      if (!res.ok) throw new Error('Artwork HTTP ' + res.status);
      const json = await res.json();
      if (json.error) throw new Error('Artwork API unavailable');
      return json;
    } finally { clearTimeout(timeout); }
  });
  networkTail = job;
  return job;
}
function wikiURL(lang, params) {
  const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  u.search = new URLSearchParams({action:'query', format:'json', formatversion:'2', origin:'*',
    prop:'pageimages|description|info|langlinks', piprop:'thumbnail', pithumbsize:'420', pilicense:'any',
    inprop:'url', lllang:'en', lllimit:'max', ...params});
  return u.href;
}
const kindPattern = {book:/\bbook\b|novel|novela|libro|ensayo|treatise/i, movie:/\bfilm\b|pel[ií]cula/i, serie:/television|TV series|miniseries|serie de|serie televisiva/i, game:/video ?game|videojuego/i};
function wikiCandidate(page, alias = '') {
  if (!safeArtworkUrl(page.thumbnail?.source)) return null;
  // Prefer a genuine poster/box over cast photographs and wide banners.
  if (page.thumbnail.width / page.thumbnail.height > 1.12) return null;
  const url = new URL(page.thumbnail.source); url.search = '';
  return {provider:'wikipedia', title:page.title, alias, url:url.href, sourceUrl:page.fullurl,
    year:Number(page.description?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1] || page.title?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1]) || null};
}
async function searchWiki(kind, item, query, lang) {
  const hint = {en:{book:'book',movie:'film',serie:'television series',game:'video game'},es:{book:'libro',movie:'película',serie:'serie de televisión',game:'videojuego'}}[lang][kind];
  const year = artworkYear(kind,item);
  const json = await getJSON(wikiURL(lang, {generator:'search', gsrsearch:`${query} ${year || ''} ${hint}`, gsrnamespace:'0', gsrlimit:'5'}));
  const pages = (json.query?.pages || []).filter(p => !/^(List of|Anexo:|Lista de)/i.test(p.title) && (kindPattern[kind].test(p.description || '') || kindPattern[kind].test(p.title || '')));
  if (lang === 'en') return pages.map(p => wikiCandidate(p)).filter(Boolean);
  // Spanish Wikipedia often has no poster. Follow its English interwiki, not a cast photo.
  const linked = pages.map(p => ({p, en:p.langlinks?.find(l => l.lang==='en')?.title})).filter(x => x.en);
  if (!linked.length) return [];
  if(kind==='serie'){
    const best=linked.sort((a,b)=>scoreArtwork(kind,item,{title:b.p.title})-scoreArtwork(kind,item,{title:a.p.title}))[0];
    if(scoreArtwork(kind,item,{title:best.p.title})>=.65){
      const posters=await searchTV(best.en.replace(/\s*\([^)]*\)/g,''));
      if(posters.length)return posters.map(p=>({...p,alias:titleSimilarity(p.title,best.en)>=.8?best.p.title:''}));
    }
  }
  const en = await getJSON(wikiURL('en', {titles:linked.map(x => x.en).join('|'), redirects:'1'}));
  return (en.query?.pages || []).map(p => wikiCandidate(p, linked.find(x => x.en === p.title)?.p.title || '')).filter(Boolean);
}
async function searchTV(query) {
  const json=await getJSON('https://api.tvmaze.com/search/shows?'+new URLSearchParams({q:query}));
  return (Array.isArray(json)?json:[]).map(x=>x.show).filter(s=>safeArtworkUrl(s?.image?.medium)).slice(0,6).map(s=>({provider:'tvmaze',title:s.name,url:s.image.medium,sourceUrl:s.url,year:Number(s.premiered?.slice(0,4))||null}));
}
async function searchBooks(item, query) {
  const u = new URL('https://openlibrary.org/search.json');
  u.search = new URLSearchParams({title:query, ...(item.author ? {author:item.author} : {}),
    fields:'key,title,author_name,cover_i,first_publish_year', limit:'8'});
  const json = await getJSON(u.href);
  return (json.docs || []).filter(b => Number.isInteger(b.cover_i) && b.cover_i > 0).map(b => ({provider:'openlibrary', title:b.title,
    creator:(b.author_name || []).join(', '), year:b.first_publish_year || null,
    url:`https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg?default=false`, sourceUrl:'https://openlibrary.org' + (b.key.startsWith('/') ? b.key : '/works/'+b.key)}));
}
export async function searchArtwork(kind, item, query = '', manual = false) {
  const titles = query.trim() ? [query.trim().slice(0,300)] : artworkTitles(item);
  if (!titles.length) return [];
  let results = [];
  if (kind === 'book') {
    results = await searchBooks(item,titles[0]);
    if (!chooseArtwork(kind,item,results) && titles[1]) results.push(...await searchBooks(item,titles[1]));
    if (!chooseArtwork(kind,item,results)) results.push(...await searchWiki(kind,item,titles[0],'es'));
  } else {
    // English has box art; Spanish resolves localized titles through official interwiki links.
    results = kind==='serie'?await searchTV(titles[0]):await searchWiki(kind,item,titles[0],'en');
    if (manual || !chooseArtwork(kind,item,results)) results.push(...await searchWiki(kind,item,titles[0],'es'));
    if (!results.length && titles[1]) results.push(...await searchWiki(kind,item,titles[1],'en'));
  }
  return [...new Map(results.filter(validArtwork).map(c => [c.url,c])).values()].sort((a,b) => scoreArtwork(kind,item,b)-scoreArtwork(kind,item,a));
}
export function resolveArtwork(kind,item) {
  const stored = cachedArtwork(kind,item);
  if (stored !== undefined) return Promise.resolve(stored);
  const key = artworkKey(kind,item);
  if (!pending.has(key)) pending.set(key, searchArtwork(kind,item).then(results => {
    const chosen = chooseArtwork(kind,item,results); remember(key,chosen); return chosen;
  }).finally(() => pending.delete(key)));
  return pending.get(key);
}
export function coverMarkup(kind, item) {
  const art = cachedArtwork(kind,item);
  const initials = artworkTitles(item)[0]?.split(/\s+/).slice(0,2).map(x => x[0]).join('') || '—';
  return `<span class="cover-placeholder" aria-hidden="true"><span>${esc(initials)}</span><small>${esc(t('No cover'))}</small></span>${art ? `<img class="library-cover" src="${esc(art.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}`;
}
const imageFallbacks=new Map();
function imageFallback(kind,item) {
  if(kind!=='book'||item.artwork!=null)return Promise.resolve(null);
  const key=artworkKey(kind,item);
  if(!imageFallbacks.has(key))imageFallbacks.set(key,searchWiki(kind,item,artworkTitles(item)[0],'es').then(found=>{
    const art=chooseArtwork(kind,item,found);if(art)remember(key,art);return art;
  }).catch(()=>null).finally(()=>imageFallbacks.delete(key)));
  return imageFallbacks.get(key);
}
function paintArtwork(node,kind,item,art,onChange) {
  if(!node.isConnected)return;
  let img=node.querySelector('img');
  const added=!img;
  if(!img){img=document.createElement('img');img.className='library-cover';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';}
  const failed=async()=>{
    img.remove();node.dataset.coverState='image-error';
    if(node._fallbackTried)return;
    node._fallbackTried=true;
    const alternative=await imageFallback(kind,item);
    if(alternative&&node.isConnected)paintArtwork(node,kind,item,alternative,onChange);
  };
  img.onerror=failed;img.onload=()=>{node.dataset.coverState='ready';};
  if(added){img.src=art.url;node.append(img);}
  else if(img.complete&&!img.naturalWidth)failed();
  onChange?.(art);
}
export function loadArtwork(node,kind,item,onChange) {
  return resolveArtwork(kind,item).then(art=>{
    if(art)paintArtwork(node,kind,item,art,onChange);
    else node.dataset.coverState='no-match';
  }).catch(()=>{if(node.isConnected){node.dataset.coverState='unavailable';node.classList.add('cover-unavailable');}});
}
export function hydrateArtwork(root, kind, items) {
  root._artObserver?.disconnect();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.dataset.coverState=entry.isIntersecting?'visible':'waiting';
      if (!entry.isIntersecting || !entry.target.closest('.tab-content.active, .library-detail')) continue;
      observer.unobserve(entry.target);
      const node = entry.target, item = items.get(Number(node.dataset.libraryIndex));
      if (!item) continue;
      node.dataset.coverState='loading';
      loadArtwork(node,kind,item);
    }
  }, {rootMargin:'250px',threshold:.01});
  root._artObserver=observer;
  root.querySelectorAll('[data-artwork]').forEach(node => {
    if(node.querySelector('img')){
      const item=items.get(Number(node.dataset.libraryIndex)),art=item&&cachedArtwork(kind,item);
      if(art)paintArtwork(node,kind,item,art);
    }else observer.observe(node);
  });
}
// Changes are only committed by the surrounding form's Save button.
export function artworkEditor(form, kind, old, getItem) {
  let selection = old.artwork, request = 0, reset = false;
  const section = document.createElement('section'); section.className='artwork-editor'; section.dataset.noI18n='';
  section.innerHTML=`<div class="artwork-editor-head"><strong>${t('Cover')}</strong><div><button class="btn btn-sm" type="button" data-art-auto>${t('Automatic')}</button><button class="btn btn-sm" type="button" data-art-none>${t('No cover')}</button></div></div><div class="artwork-search"><input type="search" aria-label="${t('Search cover')}" placeholder="${t('Search cover')}" maxlength="300"><button class="btn" type="button" data-art-search>${t('Search')}</button></div><p class="artwork-message" role="status"></p><div class="artwork-results"></div>`;
  form.querySelector('.game-fields').after(section);
  const message=section.querySelector('.artwork-message'), results=section.querySelector('.artwork-results'), input=section.querySelector('input');
  const showSelection=()=>{
    message.textContent=selection===false?t('No cover'):selection?t('Selected cover')+': '+selection.title:t('Automatic cover lookup');
    const preview=selection===undefined&&!reset?cachedArtwork(kind,old):selection;
    results.innerHTML=preview && validArtwork(preview)?`<img class="artwork-selected" src="${esc(preview.url)}" alt="${esc(preview.title)}" referrerpolicy="no-referrer">`:'';
  };
  showSelection();
  section.querySelector('[data-art-auto]').onclick=()=>{request++;selection=undefined;reset=true;showSelection();};
  section.querySelector('[data-art-none]').onclick=()=>{request++;selection=false;showSelection();};
  async function search() {
    const id=++request, item=getItem();
    message.textContent=t('Searching covers…');results.replaceChildren();
    try {
      const found=await searchArtwork(kind,item,input.value,true);
      if(id!==request || !section.isConnected)return;
      message.textContent=t(found.length?'Choose a cover':'No matching cover. Try another title.');
      results.innerHTML=found.map((a,i)=>`<button type="button" class="artwork-option" data-cover-result="${i}"><img src="${esc(a.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(a.title)}${a.year?' · '+a.year:''}</span></button>`).join('');
      results.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{selection=found[Number(btn.dataset.coverResult)];showSelection();});
    } catch {if(id===request && section.isConnected)message.textContent=t('Cover service unavailable. Your data is safe; try again later.');}
  }
  section.querySelector('[data-art-search]').onclick=search;
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
  return next=>{
    if(selection===undefined) delete next.artwork; else next.artwork=selection;
    // A manual Automatic reset should also retry a previously missing match.
    if(selection===undefined&&reset){delete readCache()[artworkKey(kind,next)];try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache));}catch{}}
  };
}
