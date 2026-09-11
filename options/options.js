import {
  STORAGE_KEYS,
  RETENTION_CHOICES,
  DEFAULT_RULES,
  defaultConfig,
} from '../lib/constants.js';

const $ = (s) => document.querySelector(s);
const inExtension = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.runtime);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** 已存的规则与内置规则按 id 合并：内置新增的规则也会出现 */
function mergeRules(saved) {
  const byId = new Map((saved || []).map((r) => [r.id, r]));
  return DEFAULT_RULES.map((d) => ({ ...d, ...(byId.get(d.id) || {}) }));
}

function renderRetention(current) {
  $('#retention').innerHTML = RETENTION_CHOICES.map(
    (c) => `<label>
        <input type="radio" name="retention" value="${c.value}"${c.value === current ? ' checked' : ''} />
        <span>${c.label}</span>
      </label>`
  ).join('');
}

function updateRuleCount() {
  const boxes = [...document.querySelectorAll('[data-rule]')];
  const on = boxes.filter((b) => b.checked).length;
  $('#ruleCount').textContent = `${on} / ${boxes.length} 已启用`;
}

function renderRules(rules) {
  $('#rules').innerHTML = rules
    .map(
      (r) => `<div class="prow">
        <div class="prow-t">
          <span class="prow-n"><span class="rid">${esc(r.id)}</span>${esc(r.name)}</span>
          <span class="prow-d">${esc(r.description)}</span>
        </div>
        <label class="switch">
          <input type="checkbox" data-rule="${esc(r.id)}"${r.enabled ? ' checked' : ''} />
          <span class="track"></span>
        </label>
      </div>`
    )
    .join('');
  updateRuleCount();
}

function updateBlCount() {
  const n = $('#blacklist').value.split('\n').map((s) => s.trim()).filter(Boolean).length;
  $('#blCount').textContent = n ? `${n} 个域名` : '未设置';
}

/** Copy Smith 关闭时，把它支配的选项视觉降级 */
function syncEnabledDim() {
  const off = !$('#enabled').checked;
  $('#skipRow').classList.toggle('dim', off);
  $('#cardRules').classList.toggle('dim', off);
}

let flashTimer;
function flash(msg) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function load() {
  let cfg = defaultConfig();
  if (inExtension) {
    const r = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
    if (r[STORAGE_KEYS.CONFIG]) cfg = { ...cfg, ...r[STORAGE_KEYS.CONFIG] };
  }
  $('#enabled').checked = cfg.enabled !== false;
  $('#skipInputFields').checked = cfg.skipInputFields !== false;
  $('#trackIncognito').checked = !!cfg.trackIncognito;
  $('#blacklist').value = (cfg.blacklist || []).join('\n');
  renderRetention(cfg.retentionDays ?? 7);
  renderRules(mergeRules(cfg.rules));
  updateBlCount();
  syncEnabledDim();
}

async function save() {
  const picked = document.querySelector('input[name="retention"]:checked');
  const cfg = {
    enabled: $('#enabled').checked,
    skipInputFields: $('#skipInputFields').checked,
    hotkeyBypass: 'Ctrl+Shift+C',
    trackIncognito: $('#trackIncognito').checked,
    retentionDays: picked ? parseInt(picked.value, 10) : 7,
    blacklist: $('#blacklist').value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    rules: [...document.querySelectorAll('[data-rule]')].map((cb) => ({
      ...DEFAULT_RULES.find((r) => r.id === cb.dataset.rule),
      enabled: cb.checked,
    })),
  };
  if (inExtension) await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: cfg });
  flash('已保存');
}

$('#enabled').addEventListener('change', syncEnabledDim);
$('#rules').addEventListener('change', updateRuleCount);
$('#blacklist').addEventListener('input', updateBlCount);
$('#save').addEventListener('click', save);

/* 版本号以 manifest 为唯一事实源，别在 HTML 里硬编码（曾经就这么写错了一版） */
if (inExtension) {
  const v = document.querySelector('#ver');
  if (v) v.textContent = chrome.runtime.getManifest().version;
}

load();
