const SEARCH_ENGINES = [
  { engine: 'google', test: (u) => /(^|\.)google\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'bing', test: (u) => /(^|\.)bing\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'baidu', test: (u) => /(^|\.)baidu\./.test(u.hostname) && u.pathname.startsWith('/s'), param: 'wd' },
  { engine: 'duckduckgo', test: (u) => /(^|\.)duckduckgo\./.test(u.hostname), param: 'q' },
  { engine: 'zhihu', test: (u) => /(^|\.)zhihu\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'github', test: (u) => /(^|\.)github\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
];

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function parseSearch(url) {
  if (!url) return { engine: null, query: null };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { engine: null, query: null };
  }
  for (const e of SEARCH_ENGINES) {
    if (e.test(u)) {
      const q = u.searchParams.get(e.param);
      if (q) return { engine: e.engine, query: q };
    }
  }
  return { engine: null, query: null };
}
