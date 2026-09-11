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
import { toMarkdown, toJSON, download, defaultName } from '../lib/exporter.js';

const $ = (s) => document.querySelector(s);
const version = inExtension ? chrome.runtime.getManifest().version : '';

let view = 'tree';
/** 导出的是「当前所见」：与视图共用同一份过滤后的集合 */
let current = [];

async function refresh() {
  const range = parseInt($('#range').value, 10);
  const q = $('#search').value.trim();
  current = applyFilter(await loadTrails(), range, q);
  renderMetrics($('#metrics'), current, buildTree(current));
  if (view === 'timeline') renderTimeline($('#list'), current, q);
  else renderTree($('#list'), current, q);
  $('#export').disabled = !current.length;
  $('#exportMd').disabled = !current.length;
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

function exportAs(kind) {
  if (!current.length) return;
  if (kind === 'md') {
    download(defaultName('md'), toMarkdown(current, version), 'text/markdown;charset=utf-8');
  } else {
    download(defaultName('json'), toJSON(current), 'application/json');
  }
}
$('#export').addEventListener('click', () => exportAs('json'));
$('#exportMd').addEventListener('click', () => exportAs('md'));

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
