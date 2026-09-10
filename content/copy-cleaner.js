/**
 * Copy Smith — 复制净化层（注入到每个页面）
 *
 * 设计约束：content script 以经典脚本注入，无法静态 import ESM，
 * 因此噪声正则与规则判定在本文件内自持一份，配置只从 storage.sync 读取。
 */
(function () {
  const FALLBACK_CONFIG = {
    enabled: true,
    skipInputFields: true,
    rules: [],
  };

  let config = FALLBACK_CONFIG;
  let bypassActive = false;

  function loadConfig(cb) {
    chrome.storage.sync.get('copysmithConfig', (r) => {
      if (r && r.copysmithConfig) config = r.copysmithConfig;
      if (cb) cb();
    });
  }
  loadConfig();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.copysmithConfig) loadConfig();
  });

  // Ctrl+Shift+C 期间强制原始复制
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) bypassActive = true;
  });
  document.addEventListener('keyup', (e) => {
    if (!(e.ctrlKey && e.shiftKey)) bypassActive = false;
  });

  function ruleOn(id) {
    const list = (config && config.rules) || [];
    const r = list.find((x) => x.id === id);
    // 旧配置缺规则时按默认开启处理，避免升级后静默失效
    return r ? !!r.enabled : true;
  }

  function isInEditable(el) {
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
    return !!el.isContentEditable;
  }

  function inCodeContext() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    return !!(node && node.closest && node.closest('pre, code'));
  }

  function isBlacklisted() {
    try {
      const host = new URL(location.href).hostname.replace(/^www\./, '');
      const bl = (config && config.blacklist) || [];
      return bl.some((b) => host === b || host.endsWith('.' + b));
    } catch {
      return false;
    }
  }

  // ---- 文本变换 ----
  const NOISE = [
    /关注我们.*?\n/g,
    /展开剩余\d+条?/g,
    /版权所有.*?\n/g,
    /转载请注明.*?\n/g,
    /点击上方.*?关注/g,
    /扫码.*?公众号/g,
    /广告\s*$/g,
    /^\s*[\d]+\s*评论\s*$/gm,
    /分享到.*?(?=\n|$)/g,
  ];

  function removeNoise(text) {
    let out = text;
    for (const p of NOISE) out = out.replace(p, '');
    return out;
  }

  function normalizeQuotes(text) {
    return text.replace(/"([^"]*)"/g, '“$1”').replace(/'([^']*)'/g, '‘$1’');
  }

  function fixSoftLineBreaks(text) {
    return text.replace(/([^。！？!?；;\n])\n([a-z\u4e00-\u9fa5])/g, '$1 $2');
  }

  function compressBlankLines(text) {
    return text.replace(/\n{3,}/g, '\n\n');
  }

  document.addEventListener('copy', (e) => {
    if (!config || !config.enabled) return;
    if (bypassActive) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (config.skipInputFields && isInEditable(sel.anchorNode)) return;
    if (isBlacklisted()) return;

    let text = '';
    if (e.clipboardData) text = e.clipboardData.getData('text/plain');
    if (!text) text = sel.toString();
    if (!text) return;

    let out = text;
    if (ruleOn('R004') && inCodeContext()) {
      out = compressBlankLines(out);
    } else {
      if (ruleOn('R001')) out = removeNoise(out);
      if (ruleOn('R002')) out = normalizeQuotes(out);
      if (ruleOn('R003')) out = fixSoftLineBreaks(out);
      if (ruleOn('R005')) out = compressBlankLines(out);
    }

    if (out !== text && e.clipboardData) {
      e.clipboardData.setData('text/plain', out);
      e.preventDefault();
    }
  });
})();
