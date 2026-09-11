import { STORAGE_KEYS } from '../lib/constants.js';
import {
  loadTrails,
  applyFilter,
  renderMetrics,
  renderTree,
  renderTimeline,
  inExtension,
} from '../lib/trail-view.js';
import { buildTree } from '../lib/tree-builder.js';

const $ = (s) => document.querySelector(s);

let view = 'tree';

async function refresh() {
  const range = parseInt($('#range').value, 10);
  const q = $('#search').value.trim();
  const trails = applyFilter(await loadTrails(), range, q);
  renderMetrics($('#metrics'), trails, buildTree(trails));
  if (view === 'timeline') renderTimeline($('#list'), trails, q);
  else renderTree($('#list'), trails, q);
}

/* ------------------------------------------------------------------
   交互
   ------------------------------------------------------------------ */
$('#search').addEventListener('input', refresh);
$('#range').addEventListener('change', refresh);
$('#view').addEventListener('change', (e) => {
  view = e.target.value;
  refresh();
});

$('#openOptions').addEventListener('click', () => {
  if (inExtension) chrome.runtime.openOptionsPage();
});

$('#export').addEventListener('click', async () => {
  const trails = await loadTrails();
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

/* 侧边栏是常驻的：一边浏览一边长出血缘，数据变了就地刷新 */
if (inExtension) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEYS.TRAILS]) refresh();
  });
}

refresh();
