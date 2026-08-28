/**
 * [INPUT]: 依赖 active MemoTreeNode、shared/store 的 findNode/isDescendant 与 memoLibrary 的首个 memo 选择规则
 * [OUTPUT]: 对外提供删除影响集合（区分"需要等 autosave flush"与"需要导航离开"）与删除成功后的稳定路由目标计算
 * [POS]: app/src/pages 的删除编排纯逻辑，供 Dashboard 与测试共享，网络/Store/autosave 副作用仍留在页面层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../shared/api/memo";
import { findNode, isDescendant } from "../shared/store/memoTree";
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
