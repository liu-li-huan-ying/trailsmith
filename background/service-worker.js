import { initTracker } from './tab-tracker.js';
import { STORAGE_KEYS, defaultConfig } from './constants.js';

initTracker();

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  if (!existing[STORAGE_KEYS.CONFIG]) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: defaultConfig() });
  }
});
