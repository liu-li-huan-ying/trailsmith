import { initTracker } from './tab-tracker.js';
import { STORAGE_KEYS, defaultConfig } from '../lib/constants.js';
import { getConfig, cleanupRetention, enforceQuota } from './storage-manager.js';
import { withLock } from './lock.js';

const MAINTENANCE_ALARM = 'trailsmith-maintenance';

initTracker();

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  if (!existing[STORAGE_KEYS.CONFIG]) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: defaultConfig() });
  }
  await runMaintenance();
  // 每小时一次：保留期清理 + 容量守卫（alarms 可跨 SW 休眠存活）
  chrome.alarms.create(MAINTENANCE_ALARM, { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === MAINTENANCE_ALARM) await runMaintenance();
});

async function runMaintenance() {
  // 清理同样是「读全表 → 改 → 写回」，必须与 tabs 事件的写入串行，
  // 否则一次清理可能把并发新增的记录整条抹掉。
  return withLock(async () => {
    try {
      const config = await getConfig();
      await cleanupRetention(config);
      await enforceQuota();
    } catch (e) {
      console.error('[TrailSmith] maintenance error', e);
    }
  });
}
