/**
 * 全局串行锁（async mutex）。
 *
 * 为什么必须有：chrome.storage 没有事务，本扩展的每次写入都是
 * 「读出整个 key → 在内存里改 → 整体写回」。而 tabs 的事件
 * （onCreated / onUpdated / onActivated / onRemoved）会几乎同时触发，
 * 每个监听器内部都要完成一次这样的读-改-写。若两次交错，
 * 后写的那次会拿旧快照覆盖前一次成果 —— 实测症状：
 *   · 新标签的 chromeToTrail 映射被覆盖 → 关标签时找不到记录，
 *     closedAt 永远不写（"标签关了但没结算"）；
 *   · lastActiveMap / currentActiveTabId 被清空 → 活跃时长归零。
 *
 * 把每个「读-改-写」单元整体串到同一条队列上，交错即不可能发生。
 *
 * ⚠️ 锁不可重入：被锁住的操作内部不要再调用另一个加锁的操作。
 * storage-manager 里的函数都是无锁的构建块，安全。
 */
let tail = Promise.resolve();

export function withLock(fn) {
  const run = tail.then(fn, fn);
  // 队列推进不依赖结果：无论成败都继续，且不吞掉调用方拿到的异常
  tail = run.then(
    () => {},
    () => {}
  );
  return run;
}
