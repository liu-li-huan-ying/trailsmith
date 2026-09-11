import { PAYMENT_DOMAINS } from './constants.js';
import { domainOf } from './search-engine-parser.js';

/**
 * 非网页协议：浏览器内部页、扩展自身页面、本地文件。
 * 这些既不是「浏览」，记录它们只会污染血缘树（尤其是扩展自己的 popup / 设置页）。
 */
const NON_WEB_SCHEME = /^(chrome|edge|brave|about|devtools|view-source|chrome-extension|moz-extension|file):/i;

function isPrivateOrLocal(url) {
  try {
    const h = new URL(url).hostname;
    if (h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' ||
        h.startsWith('192.168.') || h.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// 返回 { skip, sanitizedUrl?, sensitive? }
export function shouldSkip(url, title, config) {
  if (!url) return { skip: true, reason: 'no-url' };
  if (NON_WEB_SCHEME.test(url)) return { skip: true, reason: 'non-web' };
  if (isPrivateOrLocal(url)) return { skip: true, reason: 'private' };

  const lower = (url + ' ' + (title || '')).toLowerCase();
  if (/password|login|auth/.test(lower)) {
    try {
      const u = new URL(url);
      u.search = '';
      return { skip: false, sanitizedUrl: u.toString(), sensitive: true };
    } catch {
      return { skip: true, reason: 'auth' };
    }
  }

  const domain = domainOf(url);
  if (PAYMENT_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))) {
    return { skip: true, reason: 'payment' };
  }

  const blacklist = (config && config.blacklist) || [];
  if (blacklist.some((b) => domain === b || domain.endsWith('.' + b))) {
    return { skip: true, reason: 'blacklist' };
  }

  return { skip: false, sanitizedUrl: null, sensitive: false };
}
