import { STORAGE_KEYS, defaultConfig } from '../lib/constants.js';

const $ = (s) => document.querySelector(s);

async function load() {
  const r = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  const cfg = r[STORAGE_KEYS.CONFIG] || defaultConfig();
  $('#enabled').checked = cfg.enabled;
  $('#preserveCodeBlocks').checked = cfg.preserveCodeBlocks;
  $('#normalizeQuotes').checked = cfg.normalizeQuotes;
  $('#fixSoftLineBreaks').checked = cfg.fixSoftLineBreaks;
  $('#skipInputFields').checked = cfg.skipInputFields;
  $('#retentionDays').value = String(cfg.retentionDays);
  $('#trackIncognito').checked = cfg.trackIncognito;
  $('#blacklist').value = (cfg.blacklist || []).join('\n');

  const box = $('#rules');
  box.innerHTML = '';
  (cfg.rules || []).forEach((rule) => {
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" data-rule="${rule.id}" ${rule.enabled ? 'checked' : ''} /> ${rule.name} <small>(${rule.description})</small>`;
    box.appendChild(lbl);
    box.appendChild(document.createElement('br'));
  });
}

async function save() {
  const r = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  const cfg = r[STORAGE_KEYS.CONFIG] || defaultConfig();
  cfg.enabled = $('#enabled').checked;
  cfg.preserveCodeBlocks = $('#preserveCodeBlocks').checked;
  cfg.normalizeQuotes = $('#normalizeQuotes').checked;
  cfg.fixSoftLineBreaks = $('#fixSoftLineBreaks').checked;
  cfg.skipInputFields = $('#skipInputFields').checked;
  cfg.retentionDays = parseInt($('#retentionDays').value, 10);
  cfg.trackIncognito = $('#trackIncognito').checked;
  cfg.blacklist = $('#blacklist').value.split('\n').map((s) => s.trim()).filter(Boolean);
  document.querySelectorAll('[data-rule]').forEach((cb) => {
    const rule = cfg.rules.find((x) => x.id === cb.dataset.rule);
    if (rule) rule.enabled = cb.checked;
  });
  await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: cfg });
  $('#status').textContent = '已保存';
  setTimeout(() => ($('#status').textContent = ''), 1500);
}

$('#save').addEventListener('click', save);
load();
