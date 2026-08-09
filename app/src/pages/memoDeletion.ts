/**
 * [INPUT]: 依赖 active MemoTreeNode、shared/store 的 findNode/isDescendant 与 memoLibrary 的首个 memo 选择规则
 * [OUTPUT]: 对外提供删除影响集合与删除成功后的稳定路由目标计算
 * [POS]: app/src/pages 的删除编排纯逻辑，供 Dashboard 与测试共享，网络/Store/autosave 副作用仍留在页面层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../shared/api/memo";
import { findNode, isDescendant } from "../shared/store/memoTree";
import { findFirstMemoId } from "../widgets/memoLibrary";

export type MemoDeletionImpact = {
  affectedMemoIds: Set<string>;
  affectsCurrentMemo: boolean;
};

export const getMemoDeletionImpact = (
  tree: readonly MemoTreeNode[],
  nodeId: string,
  currentMemoId: string | null,
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

  return {
    affectedMemoIds,
    affectsCurrentMemo: currentMemoId !== null &&
      (currentMemoId === nodeId || isDescendant(tree, nodeId, currentMemoId)),
  };
};

export const getPostDeletionDestination = (
  tree: readonly MemoTreeNode[],
): { memoId: string | null; path: string } => {
  const memoId = findFirstMemoId(tree);

  return memoId === null
    ? { memoId: null, path: "/app" }
    : {
        memoId,
        path: `/app/notes/${encodeURIComponent(memoId)}`,
      };
};
