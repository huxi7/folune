/**
 * [INPUT]: 依赖 AI Run 结果、MemoNode/MemoTreeNode 与 memoTree 不可变算法
 * [OUTPUT]: 对外提供 reconcileAiRunTree，把 apply/undo 的服务端节点结果局部合并进 active tree
 * [POS]: shared/store 的 AI 整理纯归并内核，保留唯一 Store 中的正文/children，不触发整树刷新或网络请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRun } from "../api/ai";
import type { MemoNode, MemoTreeNode } from "../api/memo";
import {
  findNode,
  insertNode,
  moveNodeInTree,
  removeNode,
  sortNodes,
  updateNode,
} from "./memoTree";

const folderTreeNode = (folder: MemoNode): MemoTreeNode => ({
  ...folder,
  children: [],
  memo: null,
});

const mergeMemoNode = (
  nodes: readonly MemoTreeNode[],
  memo: MemoNode,
): MemoTreeNode[] => {
  if (findNode(nodes, memo.id) === null) return [...nodes];
  const moved = moveNodeInTree(
    nodes,
    memo.id,
    memo.parent_id,
    memo.sort_order,
  );
  return sortNodes(updateNode(moved, memo.id, (current) => ({
    ...current,
    ...memo,
    children: current.children,
    memo: current.memo,
  })));
};

export const reconcileAiRunTree = (
  nodes: readonly MemoTreeNode[],
  run: AiRun,
): MemoTreeNode[] => {
  const result = run.result;
  if (result === null) return [...nodes];

  if (run.status === "undone" && result.undo !== undefined) {
    const restored = mergeMemoNode(nodes, result.undo.memo);
    return result.undo.removed_folder_id === null
      ? restored
      : removeNode(restored, result.undo.removed_folder_id);
  }

  let next = [...nodes];
  if (
    result.created_folder !== null &&
    findNode(next, result.created_folder.id) === null
  ) {
    next = insertNode(
      next,
      folderTreeNode(result.created_folder),
      result.created_folder.parent_id,
      result.created_folder.sort_order,
    );
  }
  return mergeMemoNode(next, result.memo);
};
