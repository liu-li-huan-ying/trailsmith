/**
 * 血缘视图的共享层：读数据 + 画视图。
 *
 * 边界：本模块含 DOM 操作（与 lib/theme.css 同属「共享 UI」），供 popup 与
 * sidepanel 两个入口共用，避免同一套渲染逻辑各写一份。**不含**页面布局与
 * 交互绑定 —— 那是各页面自己的职责。
 */
import { STORAGE_KEYS } from './constants.js';
import { buildTree } from './tree-builder.js';
import { engineLabel } from './search-engine-parser.js';
import { formatDuration, formatClock, formatDay, dayKey } from './time-utils.js';

/** 扩展环境判定：本地预览 / 截图时 chrome.* 不存在，走示例数据 */
export const inExtension = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.runtime);

/* ------------------------------------------------------------------
   数据
   ------------------------------------------------------------------ */

/** 非扩展环境下的示例数据，让页面可独立渲染（预览 / 截图用） */
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

export async function loadTrails() {
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
   过滤
   ------------------------------------------------------------------ */

/** range 单位为天，0 = 全部 */
export function applyFilter(trails, range, q) {
  const cutoff = range > 0 ? Date.now() - range * 864e5 : 0;
  const ql = (q || '').toLowerCase();
  return trails.filter((t) => {
    if (cutoff && t.openedAt < cutoff) return false;
    if (ql) {
      const hay = `${t.title || ''} ${t.domain || ''} ${t.searchQuery || ''}`.toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
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

const MAGNIFIER =
  '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round"><circle cx="7" cy="7" r="4.2"/>' +
  '<path d="M10.2 10.2 13.6 13.6"/></svg>';

/* ------------------------------------------------------------------
   指标条
   ------------------------------------------------------------------ */

export function renderMetrics(el, trails, roots) {
  if (!el) return;
  const live = trails.filter((t) => !t.closedAt).length;
  const dwell = trails.reduce((s, t) => s + (t.activeDuration || 0), 0);
  const cells = [
    [trails.length, '记录'],
    [roots.length, '浏览链'],
    [live, '活跃'],
    [formatDuration(dwell), '停留'],
  ];
  el.innerHTML = cells
    .map(([v, k]) => `<div class="metric"><b>${esc(v)}</b><span>${k}</span></div>`)
    .join('');
}

/* ------------------------------------------------------------------
   单条记录的行体（树节点与时间轴行共用）
   ------------------------------------------------------------------ */

function nodeBody(node, q) {
  const isSearch = !!node.searchQuery;
  const title = isSearch ? node.searchQuery : node.title || node.url || '无标题';
  const meta = isSearch ? engineLabel(node.searchEngine) : node.domain || '';

  const mono = document.createElement('div');
  if (isSearch) {
    mono.className = 'mono eng';
    mono.innerHTML = MAGNIFIER;
  } else {
    mono.className = 'mono';
    mono.textContent = (node.domain || '').replace(/^www\./, '').charAt(0) || '?';
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
  return { mono, body };
}

/** 整行可点击 / 可键盘触发 → 重新打开该 URL */
function clickable(row, node) {
  row.tabIndex = 0;
  row.title = node.url || '';
  const go = () => openUrl(node.url);
  row.addEventListener('click', go);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });
}

function emptyState() {
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML =
    '<div class="t1">暂无浏览记录</div>' +
    '<div class="t2">开几个标签页逛逛，<br/>这里就会长出浏览血缘。</div>';
  return d;
}

/* ------------------------------------------------------------------
   视图 A：血缘树
   ------------------------------------------------------------------ */

function renderNode(node, q) {
  const wrap = document.createElement('div');
  wrap.className = 'node-wrap';

  const row = document.createElement('div');
  row.className = 'node';
  const { mono, body } = nodeBody(node, q);
  row.append(mono, body);
  clickable(row, node);
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

export function renderTree(el, trails, q) {
  const roots = buildTree(trails);
  el.innerHTML = '';
  if (!roots.length) {
    el.appendChild(emptyState());
    return roots;
  }
  const frag = document.createDocumentFragment();
  roots.forEach((r) => frag.appendChild(renderNode(r, q)));
  el.appendChild(frag);
  return roots;
}

/* ------------------------------------------------------------------
   视图 B：时间轴
   ------------------------------------------------------------------ */

/** 按 openedAt 升序平铺，同日归到一条日期分隔线之下；左侧只留时刻。
    同日记录里日期是冗余信息，按天分组后横向省下一列，纵向也有了节奏感。 */
export function renderTimeline(el, trails, q) {
  el.innerHTML = '';
  if (!trails.length) {
    el.appendChild(emptyState());
    return;
  }
  const sorted = [...trails].sort((a, b) => a.openedAt - b.openedAt);
  const frag = document.createDocumentFragment();
  let lastDay = null;

  for (const t of sorted) {
    const day = dayKey(t.openedAt);
    if (day !== lastDay) {
      lastDay = day;
      const head = document.createElement('div');
      head.className = 'tl-day';
      head.textContent = formatDay(t.openedAt);
      frag.appendChild(head);
    }

    const wrap = document.createElement('div');
    wrap.className = 'tl-row';

    const time = document.createElement('div');
    time.className = 'tl-time';
    time.textContent = formatClock(t.openedAt);

    const row = document.createElement('div');
    row.className = 'node';
    const { mono, body } = nodeBody(t, q);
    row.append(mono, body);
    clickable(row, t);

    wrap.append(time, row);
    frag.appendChild(wrap);
  }
  el.appendChild(frag);
}
