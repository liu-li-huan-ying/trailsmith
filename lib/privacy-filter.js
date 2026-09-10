import { PAYMENT_DOMAINS } from './constants.js';
import { domainOf } from './search-engine-parser.js';

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
