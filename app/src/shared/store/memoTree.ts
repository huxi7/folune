/**
 * [INPUT]: 依赖 shared/api/memo 的 MemoTreeNode 领域契约
 * [OUTPUT]: 对外提供 findNode/findSiblings/insertNode/removeNode/replaceNode/updateNode/moveNodeInTree/isDescendant/sortNodes 与稀疏排序计算
 * [POS]: app/src/shared/store 的纯树算法内核；查询用线性栈，排序/删除保留未变子树引用，Store 与拖拽视图共享同一套父子、防环和 sort_order 规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../api/memo";

export const SORT_ORDER_GAP = 1000;

const numericSortOrder = (node: MemoTreeNode): number => {
  const value = Number(node.sort_order);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

export function sortNodes(nodes: readonly MemoTreeNode[]): MemoTreeNode[] {
  return nodes
    .map((node) => {
      const children = sortNodes(node.children);
      return children.every((child, index) => child === node.children[index])
        ? node
        : { ...node, children };
    })
    .sort((left, right) => {
      const orderDelta = numericSortOrder(left) - numericSortOrder(right);
      return orderDelta === 0 ? left.id.localeCompare(right.id) : orderDelta;
    });
}

export function findNode(
  nodes: readonly MemoTreeNode[],
  nodeId: string,
): MemoTreeNode | null {
  const pending = [...nodes].reverse();

  while (pending.length > 0) {
    const node = pending.pop();

    if (node === undefined) {
      continue;
    }

    if (node.id === nodeId) {
      return node;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]!);
    }
  }

  return null;
}

export function findSiblings(
  nodes: readonly MemoTreeNode[],
  parentId: string | null,
): readonly MemoTreeNode[] | null {
  if (parentId === null) {
    return nodes;
  }

  const parent = findNode(nodes, parentId);
  return parent?.node_type === "folder" ? parent.children : null;
}

export function appendSortOrder(
  siblings: readonly MemoTreeNode[],
): string {
  const maximum = siblings.reduce(
    (current, node) => Math.max(current, numericSortOrder(node)),
    0,
  );

  return String((Number.isFinite(maximum) ? maximum : 0) + SORT_ORDER_GAP);
}

export function prependSortOrder(
  siblings: readonly MemoTreeNode[],
): string {
  const first = sortNodes(siblings)[0];

  if (first === undefined) {
    return String(SORT_ORDER_GAP);
  }

  const firstOrder = numericSortOrder(first);
  const halved = firstOrder / 2;
  return String(halved < firstOrder ? halved : firstOrder - SORT_ORDER_GAP);
}

export function betweenSortOrders(
  previous: MemoTreeNode | undefined,
  next: MemoTreeNode | undefined,
): string {
  if (previous !== undefined && next !== undefined) {
    return String((numericSortOrder(previous) + numericSortOrder(next)) / 2);
  }

  if (previous !== undefined) {
    return String(numericSortOrder(previous) + SORT_ORDER_GAP);
  }

  if (next !== undefined) {
    return prependSortOrder([next]);
  }

  return String(SORT_ORDER_GAP);
}

/**
 * 只克隆「根 → 目标」这一条祖先路径, 其余子树保持原引用。
 *
 * 剪枝前: 凡有 children 的节点无条件重建, 即使目标不在该子树内 —— 于是
 * 正文草稿的每一个字符都触发全树 O(N) 克隆 + 全部可见行重渲染, 树越大
 * 打字越卡。剪枝后未命中的子树引用不变, 下游 memo 得以生效。
 */
export function updateNode(
  nodes: readonly MemoTreeNode[],
  targetId: string,
  updater: (node: MemoTreeNode) => MemoTreeNode,
): MemoTreeNode[] {
  let changed = false;

  const next = nodes.map((node) => {
    if (node.id === targetId) {
      changed = true;
      return updater(node);
    }

    if (node.children.length === 0) {
      return node;
    }

    const nextChildren = updateNode(node.children, targetId, updater);

    // 子树内没有命中目标时保持原引用, 不产生新对象
    if (nextChildren === node.children) {
      return node;
    }

    changed = true;
    return { ...node, children: nextChildren };
  });

  return changed ? next : (nodes as MemoTreeNode[]);
}

export function insertNode(
  nodes: readonly MemoTreeNode[],
  node: MemoTreeNode,
  parentId: string | null,
  sortOrder?: string,
): MemoTreeNode[] {
  const siblings = findSiblings(nodes, parentId);

  if (siblings === null) {
    return [...nodes];
  }

  const insertedNode: MemoTreeNode = {
    ...node,
    parent_id: parentId,
    sort_order: sortOrder ?? appendSortOrder(siblings),
  };

  if (parentId === null) {
    return sortNodes([...nodes, insertedNode]);
  }

  return updateNode(nodes, parentId, (parent) => ({
    ...parent,
    children: sortNodes([...parent.children, insertedNode]),
  }));
}

export function removeNode(
  nodes: readonly MemoTreeNode[],
  nodeId: string,
): MemoTreeNode[] {
  const nextNodes: MemoTreeNode[] = [];
  let changed = false;

  for (const node of nodes) {
    if (node.id === nodeId) {
      changed = true;
      continue;
    }

    const children = node.children.length === 0
      ? node.children
      : removeNode(node.children, nodeId);
    if (children !== node.children) changed = true;
    nextNodes.push(children === node.children ? node : { ...node, children });
  }

  return changed ? nextNodes : nodes as MemoTreeNode[];
}

export function replaceNode(
  nodes: readonly MemoTreeNode[],
  targetId: string,
  nextNode: MemoTreeNode,
  preserveChildren = false,
): MemoTreeNode[] {
  return updateNode(nodes, targetId, (currentNode) => ({
    ...nextNode,
    children: preserveChildren ? currentNode.children : nextNode.children,
  }));
}

export function isDescendant(
  nodes: readonly MemoTreeNode[],
  ancestorId: string,
  candidateId: string,
): boolean {
  const ancestor = findNode(nodes, ancestorId);

  if (ancestor === null) {
    return false;
  }

  return findNode(ancestor.children, candidateId) !== null;
}

export function moveNodeInTree(
  nodes: readonly MemoTreeNode[],
  nodeId: string,
  parentId: string | null,
  sortOrder?: string,
): MemoTreeNode[] {
  const node = findNode(nodes, nodeId);
  const parent = parentId === null ? null : findNode(nodes, parentId);

  if (
    node === null ||
    nodeId === parentId ||
    (parentId !== null && parent?.node_type !== "folder") ||
    (parentId !== null && isDescendant(nodes, nodeId, parentId))
  ) {
    return [...nodes];
  }

  const withoutNode = removeNode(nodes, nodeId);
  return insertNode(withoutNode, node, parentId, sortOrder);
}
