import { STORAGE_KEYS, defaultConfig } from '../lib/constants.js';

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

/** MV3 下 chrome.storage.local 上限约 10MB */
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;

export async function trailBytes() {
  return await chrome.storage.local.getBytesInUse(STORAGE_KEYS.TRAILS);
}

/**
 * 占用超过 90% 时，从最旧的已关闭记录开始删，一次削 20%。
 * 不碰仍在打开的记录（closedAt === null）。返回删除条数。
 */
export async function enforceQuota() {
  const used = await trailBytes();
  if (used < STORAGE_QUOTA_BYTES * 0.9) return 0;
  const map = await getLocal(STORAGE_KEYS.TRAILS, {});
  const closed = Object.values(map)
    .filter((r) => r.closedAt)
    .sort((a, b) => a.closedAt - b.closedAt);
  const drop = Math.max(1, Math.ceil(closed.length * 0.2));
  for (const r of closed.slice(0, drop)) delete map[r.id];
  await setLocal(STORAGE_KEYS.TRAILS, map);
  return drop;
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
