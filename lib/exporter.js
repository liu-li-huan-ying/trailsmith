/**
 * 导出层：把血缘记录序列化成 JSON / Markdown，并触发下载。
 *
 * 边界：`toMarkdown` / `toJSON` 是**纯函数**（不碰 DOM），可在 node 里直接 import 做单测；
 * `download` / `defaultName` 才需要浏览器。分开是为了让序列化逻辑可测。
 *
 * 下载走 Blob + <a download>，不引入 `downloads` 权限 —— 最小权限原则。
 */
import { buildTree } from './tree-builder.js';
import { engineLabel } from './search-engine-parser.js';
import { formatDuration, formatStamp } from './time-utils.js';

const EXT = 'TrailSmith';

/** Markdown 链接文本里需要转义的字符 */
function mdEscape(s) {
  return String(s == null ? '' : s).replace(/([\[\]\\`*_|])/g, '\\$1');
}

/** 行内展示名：搜索节点用搜索词，普通节点用标题 / URL 兜底 */
function displayTitle(n) {
  if (n.searchQuery) return n.searchQuery;
  return n.title || n.url || '无标题';
}

function nodeLine(n, depth) {
  const indent = '  '.repeat(depth);
  const title = mdEscape(displayTitle(n));
  // CommonMark 的尖括号形式：URL 里的空格与括号不会把链接截断
  const link = n.url ? `[${title}](<${n.url}>)` : title;
  const meta = n.searchQuery ? engineLabel(n.searchEngine) : n.domain || '';
  const bits = [meta, formatDuration(n.activeDuration)];
  if (!n.closedAt) bits.push('打开中');
  return `${indent}- ${link}${bits.filter(Boolean).length ? ` — ${bits.filter(Boolean).join(' · ')}` : ''}`;
}

function walk(nodes, depth, out) {
  for (const n of nodes) {
    out.push(nodeLine(n, depth));
    if (n.children && n.children.length) walk(n.children, depth + 1, out);
  }
  return out;
}

/**
 * 血缘树 → Markdown。带 YAML front-matter（对 Obsidian 友好），
 * 正文是用空格缩进的嵌套列表。
 */
export function toMarkdown(trails, version) {
  const roots = buildTree(trails);
  const lines = [
    '---',
    `generator: ${EXT}${version ? ' v' + version : ''}`,
    `exported_at: ${formatStamp(Date.now())}`,
    `records: ${trails.length}`,
    `chains: ${roots.length}`,
    '---',
    '',
    '# 浏览血缘',
    '',
  ];
  if (!roots.length) {
    lines.push('（暂无记录）');
    return lines.join('\n') + '\n';
  }
  walk(roots, 0, lines);
  return lines.join('\n') + '\n';
}

/** JSON 导出：保留全部字段，便于再导入或做数据分析 */
export function toJSON(trails) {
  return JSON.stringify(trails, null, 2);
}

export function defaultName(ext) {
  return `trailsmith-${formatStamp(Date.now()).slice(0, 10)}.${ext}`;
}

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // 立即 revoke 有概率赶在下载开始前把 URL 撤掉，延后一拍更稳
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
