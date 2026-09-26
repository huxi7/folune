/**
 * [INPUT]: 依赖 active MemoTreeNode、shared/store 的 findNode/findSiblings/isDescendant 与 memoLibrary 的首个 memo 兜底规则
 * [OUTPUT]: 对外提供删除影响集合（区分"需要等 autosave flush"与"需要导航离开"）、移除前的同级槽位 getMemoTreeSlot，以及按槽位就近选择的路由落点
 * [POS]: app/src/pages 的删除编排纯逻辑，供删除与新建失败回退共享；落点先同级、再沿祖先链、最后才钻进旁边文件夹，网络/Store/autosave 副作用仍留在页面层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../shared/api/memo";
import { findNode, findSiblings, isDescendant } from "../shared/store/memoTree";
import { findFirstMemoId } from "../widgets/memoLibrary";

export type MemoDeletionImpact = {
  affectedMemoIds: Set<string>;
  /** 当前路由是一篇 memo 且被影响：必须先等它的 autosave required flush */
  affectsCurrentMemo: boolean;
  /** 当前路由对象被影响：必须导航离开，无论它是 memo 还是 canvas */
  affectsCurrentRoute: boolean;
};

export const getMemoDeletionImpact = (
  tree: readonly MemoTreeNode[],
  nodeId: string,
  currentNodeId: string | null,
): MemoDeletionImpact | null => {
  const target = findNode(tree, nodeId);

  if (target === null) {
    return null;
  }

  const affectedMemoIds = new Set<string>();
  const pending = [target];

  while (pending.length > 0) {
    const current = pending.pop();

    if (current === undefined) {
      continue;
    }

    if (current.node_type === "memo") {
      affectedMemoIds.add(current.id);
    }

    pending.push(...current.children);
  }

  // 画布没有草稿, 也没有编辑会话可等。把它当成 memo 会让"删除正在看的画布"
  // 卡在一个永远拿不到的编辑器上, 于是整个删除静默失败。
  const affectsCurrentRoute = currentNodeId !== null
    && (currentNodeId === nodeId || isDescendant(tree, nodeId, currentNodeId));

  return {
    affectedMemoIds,
    affectsCurrentMemo: affectsCurrentRoute
      && findNode(tree, currentNodeId as string)?.node_type === "memo",
    affectsCurrentRoute,
  };
};

/* ========================================================================== */
/* 落点: 被移除节点空出的那个槽位                                              */
/* ========================================================================== */

/**
 * 节点在同级中的位置。移除之后树里已经没有它, 只剩这个槽位能回答「用户刚才在哪」,
 * 所以必须在移除之前取下来。
 */
export type MemoTreeSlot = { index: number; parentId: string | null };

export const getMemoTreeSlot = (
  tree: readonly MemoTreeNode[],
  nodeId: string,
): MemoTreeSlot | null => {
  const node = findNode(tree, nodeId);
  if (node === null) return null;
  const index = findSiblings(tree, node.parent_id)?.findIndex((sibling) => sibling.id === nodeId) ?? -1;
  return index < 0 ? null : { index, parentId: node.parent_id };
};

const lastMemoId = (nodes: readonly MemoTreeNode[]): string | null => {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index] as MemoTreeNode;
    const found = node.node_type === "memo" ? node.id : lastMemoId(node.children);
    if (found !== null) return found;
  }
  return null;
};

/** deep=false 只认同级笔记; deep=true 才允许钻进同级文件夹 (那会撑开它) */
const nearestMemoId = (
  siblings: readonly MemoTreeNode[],
  afterStart: number,
  beforeStart: number,
  deep: boolean,
): string | null => {
  for (let index = afterStart; index < siblings.length; index += 1) {
    const node = siblings[index] as MemoTreeNode;
    if (node.node_type === "memo") return node.id;
    const found = deep ? findFirstMemoId(node.children) : null;
    if (found !== null) return found;
  }
  for (let index = beforeStart; index >= 0; index -= 1) {
    const node = siblings[index] as MemoTreeNode;
    if (node.node_type === "memo") return node.id;
    const found = deep ? lastMemoId(node.children) : null;
    if (found !== null) return found;
  }
  return null;
};

/*
 * 落点必须是离用户刚才位置最近的笔记, 而不是整棵树的第一篇: 那会把选中、
 * 展开与滚动一起拽回树顶, 用户在文件夹里删一篇就被甩出这个文件夹。
 * 先沿祖先链只找同级笔记 (后一篇 → 前一篇 → 上一层), 它们必然已经可见;
 * 整条链都没有才允许钻进旁边的文件夹。
 */
const findNearbyMemoId = (
  tree: readonly MemoTreeNode[],
  slot: MemoTreeSlot,
): string | null => {
  for (const deep of [false, true]) {
    let cursor: MemoTreeSlot | null = slot;
    // 第一层的槽位已空 (节点已摘除), 上层的槽位上还站着祖先本身, 要跳过它
    let pivotWidth = 0;

    while (cursor !== null) {
      const siblings = findSiblings(tree, cursor.parentId) ?? [];
      const found = nearestMemoId(siblings, cursor.index + pivotWidth, cursor.index - 1, deep);
      if (found !== null) return found;
      cursor = cursor.parentId === null ? null : getMemoTreeSlot(tree, cursor.parentId);
      pivotWidth = 1;
    }
  }
  return null;
};

export const getPostDeletionDestination = (
  tree: readonly MemoTreeNode[],
  slot: MemoTreeSlot | null,
): { memoId: string | null; path: string } => {
  const memoId = (slot === null ? null : findNearbyMemoId(tree, slot))
    ?? findFirstMemoId(tree);

  return memoId === null
    ? { memoId: null, path: "/app" }
    : {
        memoId,
        path: `/app/notes/${encodeURIComponent(memoId)}`,
      };
};
