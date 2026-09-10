(function () {
  const DEFAULT_NOISE = [
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

  let config = null;
  let bypassActive = false;

  function loadConfig(cb) {
    chrome.storage.sync.get('copysmithConfig', (r) => {
      config =
        r.copysmithConfig ||
        {
          enabled: true,
          rules: [
            { id: 'R001', enabled: true },
            { id: 'R002', enabled: true },
            { id: 'R003', enabled: true },
            { id: 'R004', enabled: true },
            { id: 'R005', enabled: true },
          ],
          normalizeQuotes: true,
          fixSoftLineBreaks: true,
          preserveCodeBlocks: true,
          skipInputFields: true,
          blacklist: [],
        };
      if (cb) cb();
    });
  }
  loadConfig();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.copysmithConfig) loadConfig();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) bypassActive = true;
  });
  document.addEventListener('keyup', (e) => {
    if (!(e.ctrlKey && e.shiftKey)) bypassActive = false;
  });

  function isInEditable(el) {
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
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

  function ruleOn(id) {
    const r = config && config.rules && config.rules.find((x) => x.id === id);
    return !!(r && r.enabled);
  }

  function removeNoise(text) {
    let out = text;
    for (const p of DEFAULT_NOISE) out = out.replace(p, '');
    return out;
  }
  function normalizeQuotes(text) {
    return text
      .replace(/"([^"]*)"/g, '“$1”')
      .replace(/'([^']*)'/g, '‘$1’');
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

    const code = config.preserveCodeBlocks && inCodeContext();
    let out = text;
    if (code) {
      out = compressBlankLines(out);
    } else {
      if (ruleOn('R001')) out = removeNoise(out);
      if (ruleOn('R002') && config.normalizeQuotes) out = normalizeQuotes(out);
      if (ruleOn('R003') && config.fixSoftLineBreaks) out = fixSoftLineBreaks(out);
      if (ruleOn('R005')) out = compressBlankLines(out);
    }

    if (out !== text && e.clipboardData) {
      e.clipboardData.setData('text/plain', out);
      e.preventDefault();
    }
  });
})();
