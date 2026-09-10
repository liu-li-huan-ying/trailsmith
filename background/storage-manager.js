import { STORAGE_KEYS, defaultConfig } from './constants.js';

async function getLocal(key, fallback) {
  const r = await chrome.storage.local.get(key);
  return r[key] ?? fallback;
}

async function setLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function getTrails() {
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  return Object.values(map);
}

export async function getTrail(id) {
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  return map[id] || null;
}

export async function saveTrail(record) {
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  map[record.id] = record;
  await setLocal(STORAGE_KEYS.TRAILS, map);
}

export async function deleteTrail(id) {
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  delete map[id];
  await setLocal(STORAGE_KEYS.TRAILS, map);
}

export async function getState() {
  return await getLocal(STORAGE_KEYS.STATE, {
    lastActiveMap: {},
    currentActiveTabId: null,
    chromeToTrail: {},
  });
}

export async function setState(state) {
  await setLocal(STORAGE_KEYS.STATE, state);
}

export async function getConfig() {
  const c = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  return c[STORAGE_KEYS.CONFIG] || defaultConfig();
}

export async function setConfig(config) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: config });
}

export async function cleanupRetention(config) {
  const days = config?.retentionDays ?? 7;
  if (!days) return; // 0 = 永久
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  let changed = false;
  for (const id of Object.keys(map)) {
    const r = map[id];
    if (r.closedAt && r.closedAt < cutoff) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) await setLocal(STORAGE_KEYS.TRAILS, map);
}
