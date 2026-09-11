/** 沿 parentId 上溯，判断 id 是否落在环上（tabId 复用竞态等异常下可能产生） */
function onCycle(id, byId) {
  let cur = byId.get(id)?.parentId;
  let guard = byId.size + 1;
  while (cur && guard-- > 0) {
    if (cur === id) return true;
    cur = byId.get(cur)?.parentId;
  }
  return false;
}

export function buildTree(records) {
  const byId = new Map();
  records.forEach((r) => byId.set(r.id, { ...r, children: [] }));

  const roots = [];
  for (const r of records) {
    const node = byId.get(r.id);
    if (!node) continue;
    // 父存在且自己不在环上 → 挂到父节点；否则提为根节点（断链，但不丢节点）
    if (r.parentId && byId.has(r.parentId) && !onCycle(r.id, byId)) {
      const parent = byId.get(r.parentId);
      if (!parent.children.includes(node)) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (n) => {
    n.children.sort((a, b) => a.openedAt - b.openedAt);
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => a.openedAt - b.openedAt);
  roots.forEach(sortRec);
  return roots;
}
