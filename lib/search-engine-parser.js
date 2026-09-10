const SEARCH_ENGINES = [
  { engine: 'google', label: 'Google', test: (u) => /(^|\.)google\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'bing', label: 'Bing', test: (u) => /(^|\.)bing\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'baidu', label: '百度', test: (u) => /(^|\.)baidu\./.test(u.hostname) && u.pathname.startsWith('/s'), param: 'wd' },
  { engine: 'duckduckgo', label: 'DuckDuckGo', test: (u) => /(^|\.)duckduckgo\./.test(u.hostname), param: 'q' },
  { engine: 'zhihu', label: '知乎', test: (u) => /(^|\.)zhihu\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
  { engine: 'github', label: 'GitHub', test: (u) => /(^|\.)github\./.test(u.hostname) && u.pathname.startsWith('/search'), param: 'q' },
];

/** 引擎 id → 展示名，未知时原样返回 */
export function engineLabel(engine) {
  const hit = SEARCH_ENGINES.find((e) => e.engine === engine);
  return hit ? hit.label : engine || '';
}

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
