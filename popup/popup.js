import { STORAGE_KEYS } from '../lib/constants.js';
import { buildTree } from '../lib/tree-builder.js';
import { formatDuration } from '../lib/time-utils.js';

const $ = (s) => document.querySelector(s);

async function getTrails() {
  const r = await chrome.storage.local.get(STORAGE_KEYS.TRAILS);
  return Object.values(r[STORAGE_KEYS.TRAILS] || {});
}

function applyFilter(trails, range, q) {
  const now = Date.now();
  const cutoff = range > 0 ? now - range * 86400000 : 0;
  const ql = q.toLowerCase();
  return trails.filter((t) => {
    if (cutoff && t.openedAt < cutoff) return false;
    if (ql) {
      const hay = (t.title + ' ' + t.domain + ' ' + (t.searchQuery || '')).toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderNode(node, depth) {
  const div = document.createElement('div');
  div.className = 'node';
  div.style.marginLeft = depth * 14 + 'px';

  const label = node.searchQuery
    ? `🔍 ${node.searchEngine}: "${node.searchQuery}"`
    : (node.title || node.domain || node.url || '(无标题)');
  const meta = `${node.domain} · ${formatDuration(node.activeDuration)}`;

  const a = document.createElement('div');
  a.className = 'node-label';
  a.innerHTML = `<span class="t">${escapeHtml(label)}</span><span class="m">${escapeHtml(meta)}</span>`;
  if (node.url) a.onclick = () => chrome.tabs.create({ url: node.url });
  div.appendChild(a);

  (node.children || []).forEach((c) => div.appendChild(renderNode(c, depth + 1)));
  return div;
}

function render(trails) {
  const roots = buildTree(trails);
  const tree = $('#tree');
  tree.innerHTML = '';

  const open = trails.filter((t) => !t.closedAt).length;
  $('#overview').innerHTML =
    `活跃标签: <b>${open}</b> 条　浏览链: <b>${roots.length}</b> 条　记录: <b>${trails.length}</b> 条`;

  if (!roots.length) {
    tree.innerHTML = '<p class="empty">暂无浏览记录</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  roots.forEach((r) => frag.appendChild(renderNode(r, 0)));
  tree.appendChild(frag);
}

async function refresh() {
  const range = parseInt($('#range').value, 10);
  const q = $('#search').value.trim();
  const trails = applyFilter(await getTrails(), range, q);
  render(trails);
}

$('#search').addEventListener('input', refresh);
$('#range').addEventListener('change', refresh);
$('#openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
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
  if (confirm('确定清空所有浏览记录？')) {
    await chrome.storage.local.remove(STORAGE_KEYS.TRAILS);
    await refresh();
  }
});

refresh();
