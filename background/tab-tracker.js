import {
  saveTrail,
  getTrail,
  deleteTrail,
  getState,
  setState,
  getConfig,
  cleanupRetention,
} from './storage-manager.js';
import { parseSearch, domainOf } from '../lib/search-engine-parser.js';
import { shouldSkip } from '../lib/privacy-filter.js';
import { withLock } from './lock.js';

function newRecord(tab, parentId, url) {
  const u = url || '';
  const { engine, query } = parseSearch(u);
  return {
    id: crypto.randomUUID(),
    chromeTabId: tab.id,
    url: u,
    title: tab.title || '',
    domain: domainOf(u),
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

/** 把 URL 写回记录：重算域名与搜索上下文。命中隐私过滤则返回 false。 */
function applyUrl(rec, url, config) {
  const f = shouldSkip(url, rec.title || '', config);
  if (f.skip) return false;
  rec.url = f.sanitizedUrl || url;
  rec.domain = domainOf(rec.url);
  const { engine, query } = parseSearch(rec.url);
  rec.searchEngine = engine;
  rec.searchQuery = query;
  return true;
}

/**
 * 建档。onCreated 与 onUpdated 共用。
 *
 * 为什么两处都要能建：openerTabId 只在 onCreated 这一刻拿得到，是父链唯一来源，
 * 所以那时哪怕 URL 还没定也要先建占位；而 onCreated 的落盘是异步的（多次 storage 往返），
 * 快速加载的页面其 onUpdated('complete') 可能先到，那时 chromeToTrail 里还没这条记录，
 * 若直接 return 就永远补不上 URL 与标题。故 onUpdated 也走这里补建（它拿到的 tab 同样带 openerTabId）。
 */
async function createRecord(tab, state, config) {
  const rawUrl = tab.pendingUrl || tab.url || '';
  if (rawUrl && shouldSkip(rawUrl, tab.title || '', config).skip) return null;

  let parentId = null;
  if (tab.openerTabId && state.chromeToTrail[tab.openerTabId]) {
    parentId = state.chromeToTrail[tab.openerTabId];
  }
  const rec = newRecord(tab, parentId, rawUrl);
  if (parentId) {
    const parent = await getTrail(parentId);
    if (parent) rec.referrerUrl = parent.url;
  }
  state.chromeToTrail[tab.id] = rec.id;
  await saveTrail(rec);
  return rec;
}

/** 摘掉 tabId ↔ trailId 的双向映射。标签关闭时用，**不动记录本身**（历史要留）。 */
function clearMappings(trailId, tabId, state) {
  delete state.chromeToTrail[tabId];
  delete state.lastActiveMap[trailId];
  if (state.currentActiveTabId === trailId) state.currentActiveTabId = null;
}

/** 记录已不该存在（最终落到支付/登录/黑名单页）时彻底撤销，不留脏数据 */
async function dropRecord(trailId, tabId, state) {
  await deleteTrail(trailId);
  clearMappings(trailId, tabId, state);
}

export function initTracker() {
  chrome.tabs.onCreated.addListener((tab) =>
    withLock(async () => {
      try {
        const config = await getConfig();
        if (tab.incognito && !config.trackIncognito) return;
        const state = await getState();
        await createRecord(tab, state, config);
        await setState(state);
      } catch (e) {
        console.error('[TrailSmith] onCreated error', e);
      }
    })
  );

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    return withLock(async () => {
      try {
        const config = await getConfig();
        if (tab.incognito && !config.trackIncognito) return;
        const state = await getState();

        const trailId = state.chromeToTrail[tabId];
        let rec = trailId ? await getTrail(trailId) : null;

        if (!rec) {
          // 快页面竞态：onCreated 还没落盘，这里补建并顺带把活跃指针种上
          rec = await createRecord(tab, state, config);
          if (!rec) {
            await setState(state);
            return;
          }
          if (tab.active) {
            state.lastActiveMap[rec.id] = Date.now();
            state.currentActiveTabId = rec.id;
          }
          await setState(state);
          return;
        }

        // 占位记录（onCreated 时 URL 未知）在此补齐；changeInfo.url 缺失时退回 tab.url
        const nextUrl = changeInfo.url || (rec.url ? null : tab.url || null);
        if (nextUrl && !applyUrl(rec, nextUrl, config)) {
          await dropRecord(trailId, tabId, state);
          await setState(state);
          return;
        }
        // changeInfo 未必带 title（实测 complete 事件可能既无 url 也无 title），回退到 tab.title
        const nextTitle = changeInfo.title ?? tab.title;
        if (nextTitle) rec.title = nextTitle;
        await saveTrail(rec);
      } catch (e) {
        console.error('[TrailSmith] onUpdated error', e);
      }
    });
  });

  chrome.tabs.onActivated.addListener((activeInfo) =>
    withLock(async () => {
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
          delete state.lastActiveMap[prev];
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
    })
  );

  chrome.tabs.onRemoved.addListener((tabId) =>
    withLock(async () => {
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
        clearMappings(trailId, tabId, state);
        await setState(state);
      } catch (e) {
        console.error('[TrailSmith] onRemoved error', e);
      }
    })
  );

  // 启动播种 + 过期清理
  withLock(async () => {
    try {
      const config = await getConfig();
      await cleanupRetention(config);
      const state = await getState();
      const tabs = await chrome.tabs.query({ active: true });
      const now = Date.now();
      for (const t of tabs) {
        const id = state.chromeToTrail[t.id];
        if (id) state.lastActiveMap[id] = now;
      }
      if (tabs.length) {
        const first = state.chromeToTrail[tabs[0].id];
        if (first) state.currentActiveTabId = first;
      }
      await setState(state);
    } catch (e) {
      console.error('[TrailSmith] startup error', e);
    }
  });
}
