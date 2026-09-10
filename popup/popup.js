import { STORAGE_KEYS } from '../lib/constants.js';
import { buildTree } from '../lib/tree-builder.js';
import { engineLabel } from '../lib/search-engine-parser.js';
import { formatDuration } from '../lib/time-utils.js';

const $ = (s) => document.querySelector(s);
const inExtension = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.runtime);

/* ------------------------------------------------------------------
   非扩展环境（本地预览 / 截图）下的示例数据，让页面可独立渲染
   ------------------------------------------------------------------ */
function sampleTrails() {
  const now = Date.now();
  const rec = (o) => ({ activeDuration: 0, switchCount: 0, closedAt: null, ...o });
  return [
    rec({
      id: 's1', chromeTabId: 1, parentId: null, domain: 'google.com', title: 'Google',
      url: 'https://www.google.com/search?q=rust+async+runtime',
      searchEngine: 'google', searchQuery: 'rust async runtime',
      openedAt: now - 52 * 6e4, closedAt: now - 40 * 6e4, activeDuration: 96e3, switchCount: 4,
    }),
    rec({
      id: 's2', chromeTabId: 2, parentId: 's1', domain: 'zhuanlan.zhihu.com',
      title: 'Rust 异步编程实践：从 Future 到 Runtime', url: 'https://zhuanlan.zhihu.com/p/000000',
      openedAt: now - 50 * 6e4, closedAt: now - 42 * 6e4, activeDuration: 154e3, switchCount: 2,
    }),
    rec({
      id: 's3', chromeTabId: 3, parentId: 's1', domain: 'tokio.rs', title: 'Tokio — 异步运行时',
      url: 'https://tokio.rs/', openedAt: now - 48 * 6e4, closedAt: now - 38 * 6e4,
      activeDuration: 421e3, switchCount: 6,
    }),
    rec({
      id: 's4', chromeTabId: 4, parentId: 's3', domain: 'github.com',
      title: 'tokio-rs/tokio: A runtime for writing reliable asynchronous applications',
      url: 'https://github.com/tokio-rs/tokio', openedAt: now - 44 * 6e4, closedAt: now - 36 * 6e4,
      activeDuration: 208e3, switchCount: 3,
    }),
    rec({
      id: 's5', chromeTabId: 5, parentId: null, domain: 'doc.rust-lang.org',
      title: 'Async Book — Rust 异步编程中文版', url: 'https://rust-lang.github.io/async-book/',
      openedAt: now - 22 * 6e4, activeDuration: 61e3, switchCount: 1,
    }),
    rec({
      id: 's6', chromeTabId: 6, parentId: 's5', domain: 'stackoverflow.com',
      title: 'How does async/await desugar in Rust?',
      url: 'https://stackoverflow.com/q/0000000', openedAt: now - 14 * 6e4,
      activeDuration: 37e3, switchCount: 2,
    }),
  ];
}

async function getTrails() {
  if (!inExtension) return sampleTrails();
  const r = await chrome.storage.local.get(STORAGE_KEYS.TRAILS);
  return Object.values(r[STORAGE_KEYS.TRAILS] || {});
}

function openUrl(url) {
  if (!url) return;
  if (inExtension) chrome.tabs.create({ url });
  else window.open(url, '_blank');
}

/* ------------------------------------------------------------------
   渲染工具
   ------------------------------------------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return safe.replace(re, '<mark class="mark">$1</mark>');
}

function applyFilter(trails, range, q) {
  const cutoff = range > 0 ? Date.now() - range * 864e5 : 0;
  const ql = q.toLowerCase();
  return trails.filter((t) => {
    if (cutoff && t.openedAt < cutoff) return false;
    if (ql) {
      const hay = `${t.title || ''} ${t.domain || ''} ${t.searchQuery || ''}`.toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
}

const MAGNIFIER =
  '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round"><circle cx="7" cy="7" r="4.2"/>' +
  '<path d="M10.2 10.2 13.6 13.6"/></svg>';

/* ------------------------------------------------------------------
   渲染
   ------------------------------------------------------------------ */
function renderMetrics(trails, roots) {
  const live = trails.filter((t) => !t.closedAt).length;
  const dwell = trails.reduce((s, t) => s + (t.activeDuration || 0), 0);
  const cells = [
    [trails.length, '记录'],
    [roots.length, '浏览链'],
    [live, '活跃'],
    [formatDuration(dwell), '停留'],
  ];
  $('#metrics').innerHTML = cells
    .map(([v, k]) => `<div class="metric"><b>${esc(v)}</b><span>${k}</span></div>`)
    .join('');
}

function renderNode(node, q) {
  const wrap = document.createElement('div');
  wrap.className = 'node-wrap';

  const isSearch = !!node.searchQuery;
  const domain = node.domain || '';
  const title = isSearch ? node.searchQuery : node.title || node.url || '无标题';
  const meta = isSearch ? engineLabel(node.searchEngine) : domain;

  const row = document.createElement('div');
  row.className = 'node';
  row.tabIndex = 0;
  row.title = node.url || '';

  const mono = document.createElement('div');
  if (isSearch) {
    mono.className = 'mono eng';
    mono.innerHTML = MAGNIFIER;
  } else {
    mono.className = 'mono';
    mono.textContent = domain.replace(/^www\./, '').charAt(0) || '?';
  }

  const body = document.createElement('div');
  body.className = 'body';

  const titleEl = document.createElement('div');
  titleEl.className = 'node-t';
  titleEl.innerHTML = highlight(title, q);

  const metaEl = document.createElement('div');
  metaEl.className = 'node-m';
  metaEl.innerHTML =
    (!node.closedAt ? '<span class="dotlive" title="仍开着"></span>' : '') +
    `<span class="dom">${highlight(meta, q)}</span><span class="sep">·</span>` +
    `<span>${formatDuration(node.activeDuration)}</span>`;

  body.append(titleEl, metaEl);
  row.append(mono, body);

  const go = () => openUrl(node.url);
  row.addEventListener('click', go);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });

  wrap.appendChild(row);

  const kids = node.children || [];
  if (kids.length) {
    const box = document.createElement('div');
    box.className = 'kids';
    kids.forEach((k) => box.appendChild(renderNode(k, q)));
    wrap.appendChild(box);
  }
  return wrap;
}

function render(trails, q) {
  const roots = buildTree(trails);
  renderMetrics(trails, roots);

  const tree = $('#tree');
  tree.innerHTML = '';
  if (!roots.length) {
    tree.innerHTML =
      '<div class="empty"><div class="t1">暂无浏览记录</div>' +
      '<div class="t2">开几个标签页逛逛，<br/>这里就会长出浏览血缘。</div></div>';
    return;
  }
  const frag = document.createDocumentFragment();
  roots.forEach((r) => frag.appendChild(renderNode(r, q)));
  tree.appendChild(frag);
}

async function refresh() {
  const range = parseInt($('#range').value, 10);
  const q = $('#search').value.trim();
  const trails = applyFilter(await getTrails(), range, q);
  render(trails, q);
}

/* ------------------------------------------------------------------
   交互
   ------------------------------------------------------------------ */
$('#search').addEventListener('input', refresh);
$('#range').addEventListener('change', refresh);

$('#openOptions').addEventListener('click', () => {
  if (inExtension) chrome.runtime.openOptionsPage();
});

$('#export').addEventListener('click', async () => {
  const trails = await getTrails();
  const blob = new Blob([JSON.stringify(trails, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trailsmith-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

$('#clear').addEventListener('click', async () => {
  if (!confirm('确定清空所有浏览记录？此操作不可撤销。')) return;
  if (inExtension) await chrome.storage.local.remove(STORAGE_KEYS.TRAILS);
  await refresh();
});

refresh();
