import {
  saveTrail,
  getTrail,
  getState,
  setState,
  getConfig,
  cleanupRetention,
} from './storage-manager.js';
import { parseSearch, domainOf } from './search-engine-parser.js';
import { shouldSkip } from './privacy-filter.js';

function newRecord(tab, parentId, sanitizedUrl) {
  const url = sanitizedUrl || tab.url || '';
  const { engine, query } = parseSearch(url);
  return {
    id: crypto.randomUUID(),
    chromeTabId: tab.id,
    url,
    title: tab.title || '',
    domain: domainOf(url),
    referrerUrl: null,
    parentId: parentId || null,
    searchQuery: query,
    searchEngine: engine,
    openedAt: Date.now(),
    closedAt: null,
    activeDuration: 0,
    switchCount: 0,
    windowId: tab.windowId ?? 0,
  };
}

export function initTracker() {
  chrome.tabs.onCreated.addListener(async (tab) => {
    try {
      const config = await getConfig();
      if (tab.incognito && !config.trackIncognito) return;
      const filter = shouldSkip(tab.url || '', tab.title || '', config);
      if (filter.skip) return;

      const state = await getState();
      let parentId = null;
      if (tab.openerTabId && state.chromeToTrail[tab.openerTabId]) {
        parentId = state.chromeToTrail[tab.openerTabId];
      }
      const rec = newRecord(tab, parentId, filter.sanitizedUrl);
      if (parentId) {
        const parent = await getTrail(parentId);
        if (parent) rec.referrerUrl = parent.url;
      }
      state.chromeToTrail[tab.id] = rec.id;
      await saveTrail(rec);
      await setState(state);
    } catch (e) {
      console.error('[TrailSmith] onCreated error', e);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (changeInfo.url == null && changeInfo.title == null) return;
    try {
      const state = await getState();
      const trailId = state.chromeToTrail[tabId];
      if (!trailId) return;
      const rec = await getTrail(trailId);
      if (!rec) return;
      if (changeInfo.url != null) {
        const config = await getConfig();
        const filter = shouldSkip(changeInfo.url, '', config);
        rec.url = filter.sanitizedUrl || changeInfo.url;
        rec.domain = domainOf(rec.url);
        const { engine, query } = parseSearch(rec.url);
        rec.searchEngine = engine;
        rec.searchQuery = query;
      }
      if (changeInfo.title != null) rec.title = changeInfo.title;
      await saveTrail(rec);
    } catch (e) {
      console.error('[TrailSmith] onUpdated error', e);
    }
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const state = await getState();
      const now = Date.now();
      const newTrailId = state.chromeToTrail[activeInfo.tabId] || null;
      const prev = state.currentActiveTabId;

      if (prev && prev !== newTrailId && state.lastActiveMap[prev] != null) {
        const rec = await getTrail(prev);
        if (rec) {
          rec.activeDuration += now - state.lastActiveMap[prev];
          await saveTrail(rec);
        }
      }
      if (newTrailId) {
        const rec = await getTrail(newTrailId);
        if (rec) {
          rec.switchCount = (rec.switchCount || 0) + 1;
          await saveTrail(rec);
        }
        state.lastActiveMap[newTrailId] = now;
      }
      state.currentActiveTabId = newTrailId;
      await setState(state);
    } catch (e) {
      console.error('[TrailSmith] onActivated error', e);
    }
  });

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const state = await getState();
      const trailId = state.chromeToTrail[tabId];
      if (!trailId) return;
      const rec = await getTrail(trailId);
      const now = Date.now();
      if (rec) {
        if (state.currentActiveTabId === trailId && state.lastActiveMap[trailId] != null) {
          rec.activeDuration += now - state.lastActiveMap[trailId];
        }
        rec.closedAt = now;
        await saveTrail(rec);
      }
      delete state.chromeToTrail[tabId];
      delete state.lastActiveMap[trailId];
      if (state.currentActiveTabId === trailId) state.currentActiveTabId = null;
      await setState(state);
    } catch (e) {
      console.error('[TrailSmith] onRemoved error', e);
    }
  });

  // 启动播种 + 过期清理
  (async () => {
    try {
      const config = await getConfig();
      await cleanupRetention(config);
      const state = await getState();
      const tabs = await chrome.tabs.query({ active: true });
      for (const t of tabs) {
        if (state.chromeToTrail[t.id]) {
          state.lastActiveMap[state.chromeToTrail[t.id]] = Date.now();
        }
      }
      if (tabs.length && state.chromeToTrail[tabs[0].id]) {
        state.currentActiveTabId = state.chromeToTrail[tabs[0].id];
      }
      await setState(state);
    } catch (e) {
      console.error('[TrailSmith] startup error', e);
    }
  })();
}
