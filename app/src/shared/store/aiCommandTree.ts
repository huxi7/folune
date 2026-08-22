/**
 * [INPUT]: 依赖 AiCommand、memo DTO mapper 与 memoTree 的插入/移动/删除/更新纯算法
 * [OUTPUT]: 对外提供 reconcileAiCommandTree，把 succeeded/undone/stale 命令事实幂等归并到 active tree
 * [POS]: shared/store 的 AI 命令对账纯函数；不发请求、不保存审批状态，Store 负责 command_id 去重和投影回滚
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiCommand } from "../api/ai";
import { mapMemoNodeDto, type MemoNodeDto } from "../api/memo.mapper";
import type { MemoContent, MemoContentSummary, MemoTreeNode } from "../api/memo";
import {
  findNode,
  insertNode,
  moveNodeInTree,
  removeNode,
  sortNodes,
  updateNode,
} from "./memoTree";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const stateNode = (state: Record<string, unknown> | null): MemoTreeNode | null => {
  const node = record(state?.node);
  if (node === null) return null;
  const mapped = mapMemoNodeDto(node as MemoNodeDto);
  const content = record(state?.content) as MemoContent | null;
  const summary: MemoContentSummary | null = content === null
    ? null
    : (({ content_mdx: _contentMdx, ...rest }) => rest)(content);
  return {
    ...mapped,
    children: [],
    memo: mapped.node_type === "memo" ? summary : null,
  };
};

const mergeNode = (
  tree: readonly MemoTreeNode[],
  serverNode: MemoTreeNode,
): MemoTreeNode[] => {
  const current = findNode(tree, serverNode.id);
  if (current === null) {
    return sortNodes(insertNode(tree, serverNode, serverNode.parent_id, serverNode.sort_order));
  }
  let next = tree;
  if (current.parent_id !== serverNode.parent_id || current.sort_order !== serverNode.sort_order) {
    next = moveNodeInTree(next, serverNode.id, serverNode.parent_id, serverNode.sort_order);
  }
  return sortNodes(updateNode(next, serverNode.id, (node) => ({
    ...node,
    ...serverNode,
    children: node.children,
    memo: serverNode.memo ?? node.memo,
  })));
};

export const reconcileAiCommandTree = (
  tree: readonly MemoTreeNode[],
  command: AiCommand,
): MemoTreeNode[] => {
  if (command.status === "succeeded") {
    if (command.operation === "trash_node" && command.target_node_id !== null) {
      return removeNode(tree, command.target_node_id);
    }
    const node = stateNode(command.after_state);
    return node === null ? [...tree] : mergeNode(tree, node);
  }

  if (command.status !== "undone") return [...tree];
  const undo = command.undo_result;
  const removedId = typeof undo?.removed_node_id === "string"
    ? undo.removed_node_id
    : null;
  if (removedId !== null) return removeNode(tree, removedId);

  const restored = stateNode(undo);
  if (restored !== null) return mergeNode(tree, restored);

  const restoredNodes = Array.isArray(undo?.nodes) ? undo.nodes : [];
  const restoredContents = Array.isArray(undo?.contents) ? undo.contents : [];
  const contentById = new Map<string, MemoContentSummary>(
    restoredContents
      .map((value) => record(value) as MemoContent | null)
      .filter((value): value is MemoContent => value !== null)
      .map((value) => {
        const { content_mdx: _contentMdx, ...summary } = value;
        return [value.node_id, summary] as const;
      }),
  );
  let next = [...tree];
  for (const value of restoredNodes) {
    const nodeRecord = record(value);
    if (nodeRecord === null) continue;
    const node = mapMemoNodeDto(nodeRecord as MemoNodeDto);
    next = mergeNode(next, {
      ...node,
      children: [],
      memo: node.node_type === "memo" ? contentById.get(node.id) ?? null : null,
    });
  }
  return next;
};
