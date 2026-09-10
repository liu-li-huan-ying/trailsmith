export function buildTree(records) {
  const byId = new Map();
  records.forEach((r) => byId.set(r.id, { ...r, children: [] }));

  const roots = [];
  for (const r of records) {
    const node = byId.get(r.id);
    if (!node) continue;
    if (r.parentId && byId.has(r.parentId)) {
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
