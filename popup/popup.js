import { STORAGE_KEYS } from '../lib/constants.js';
import { loadTrails, applyFilter, renderMetrics, renderTree, inExtension } from '../lib/trail-view.js';
import { buildTree } from '../lib/tree-builder.js';
import { toMarkdown, toJSON, download, defaultName } from '../lib/exporter.js';

const $ = (s) => document.querySelector(s);
const version = inExtension ? chrome.runtime.getManifest().version : '';

/** 导出的是「当前所见」：与视图共用同一份过滤后的集合，避免所见非所得 */
let current = [];

async function refresh() {
  const range = parseInt($('#range').value, 10);
  const q = $('#search').value.trim();
  current = applyFilter(await loadTrails(), range, q);
  renderMetrics($('#metrics'), current, buildTree(current));
  renderTree($('#tree'), current, q);
  $('#export').disabled = !current.length;
  $('#exportMd').disabled = !current.length;
}

/* ------------------------------------------------------------------
   交互
   ------------------------------------------------------------------ */
$('#search').addEventListener('input', refresh);
$('#range').addEventListener('change', refresh);

$('#openOptions').addEventListener('click', () => {
  if (inExtension) chrome.runtime.openOptionsPage();
});

/* 侧边栏入口：sidePanel.open() 要求「用户手势」上下文，
   所以窗口 id 在页面加载时就取好，点击时不再 await 以免手势失效。 */
let winId = null;
if (inExtension && chrome.windows) {
  chrome.windows.getCurrent().then((w) => { winId = w.id; }).catch(() => {});
}

$('#openPanel').addEventListener('click', async () => {
  if (!inExtension || !chrome.sidePanel) return;
  try {
    await chrome.sidePanel.open({ windowId: winId ?? chrome.windows.WINDOW_ID_CURRENT });
    window.close();
  } catch (e) {
    console.warn('[TrailSmith] 侧边栏打开失败', e);
  }
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

refresh();
