export function isFilingUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && /^(www\.)?sec\.gov$/i.test(u.hostname) && /^\/Archives\/edgar\/data\/.*\.html?$/i.test(u.pathname) && !/(?:-index|\/index)\.html?$/i.test(u.pathname); } catch { return false; }
}
export function validateOptions(input) {
  return {paper: input.paper === 'a4' ? 'a4' : 'letter', orientation: input.orientation === 'landscape' ? 'landscape' : 'portrait', pagination: ['continuous','fitted'].includes(input.pagination) ? input.pagination : 'original', margin: [0.25,0.35,0.5].includes(Number(input.margin)) ? Number(input.margin) : 0.35, compact: input.compact === true};
}
export function dimensions(options) {
  const size = options.paper === 'a4' ? [8.2677,11.6929] : [8.5,11];
  return options.orientation === 'landscape' ? size.reverse() : size;
}
export function filename(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.html?$/i,'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,150) + '.pdf';
}
