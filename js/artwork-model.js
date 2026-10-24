// Optional artwork metadata. No keys, account identifiers or private API proxy.
export const ARTWORK_PROVIDERS = ['wikipedia', 'openlibrary', 'tvmaze'];
const IMAGE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org', 'covers.openlibrary.org', 'static.tvmaze.com'];
export function safeArtworkUrl(value, image = true) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    const allowed = image ? IMAGE_HOSTS.includes(u.hostname) : ['en.wikipedia.org', 'es.wikipedia.org', 'openlibrary.org', 'www.tvmaze.com', 'tvmaze.com'].includes(u.hostname);
    return allowed ? u.href : '';
  } catch { return ''; }
}
export function validArtwork(a) {
  return a == null || a === false || (!!a && typeof a === 'object' && !Array.isArray(a) &&
    ARTWORK_PROVIDERS.includes(a.provider) && !!safeArtworkUrl(a.url) && !!safeArtworkUrl(a.sourceUrl, false) &&
    typeof a.title === 'string' && a.title.length <= 500 &&
    (a.year == null || (Number.isInteger(a.year) && a.year >= -5000 && a.year <= 3000)));
}
export function artworkTitles(item) {
  return [...new Set([item.title, item.translations?.es?.title, item.translations?.en?.title].filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
}
export function normalizeTitle(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/nineteen eighty[- ]four/g,'1984')
    .replace(/\([^)]*\)/g, '').replace(/\biii\b/g, '3').replace(/\bii\b/g, '2').replace(/\bi\b/g, '1')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an|el|la|los|las|un|una) /, '').replace(/ 1$/, '');
}
export function titleSimilarity(a, b) {
  a = normalizeTitle(a); b = normalizeTitle(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const x = new Set(a.split(' ')), y = new Set(b.split(' '));
  return 2 * [...x].filter(t => y.has(t)).length / (x.size + y.size);
}
export function artworkYear(kind, item) {
  const y = String(kind === 'game' ? item.releaseYear || '' : item.year || item.years || '').match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return y ? Number(y[1]) : null;
}
export function scoreArtwork(kind, item, candidate) {
  const titles = artworkTitles(item);
  let score = Math.max(0, ...titles.flatMap(t => [titleSimilarity(t, candidate.title), titleSimilarity(t, candidate.alias || '')]));
  const year = artworkYear(kind, item);
  // A remake/sequel with the wrong year must not win just because its name matches.
  if (year && candidate.year) score += year === candidate.year ? .15 : -.55;
  if (kind === 'book' && item.author && candidate.creator) {
    const author = titleSimilarity(item.author, candidate.creator);
    score += author >= .6 ? .2 : -.25;
  }
  return score;
}
export function chooseArtwork(kind, item, candidates) {
  const ranked = candidates.filter(validArtwork).map(c => ({c, score: scoreArtwork(kind, item, c)})).sort((a,b) => b.score-a.score);
  const best = ranked[0];
  if (!best || best.score < .92 || (ranked[1] && best.score - ranked[1].score < .07 && best.c.url !== ranked[1].c.url)) return null;
  return best.c;
}
export function artworkKey(kind, item) {
  return JSON.stringify([kind, artworkTitles(item).sort(), artworkYear(kind, item), kind === 'book' ? item.author || '' : '']);
}
