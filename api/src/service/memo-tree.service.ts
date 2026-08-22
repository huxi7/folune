/**
 * [INPUT]: 依赖可信 AuthUser、memo 领域节点/正文/摘要与 HttpError
 * [OUTPUT]: 对外提供正文摘要投影、单篇详情投影及 owner-safe 轻量 memo tree 组装
 * [POS]: service 层 memo 读取结构内核；只负责结构与契约校验，不访问 repository 或处理写事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  MemoContent,
  MemoContentSummary,
  MemoDetailNode,
  MemoNode,
  MemoTreeNode,
} from "../model/memo.model.ts";

const assertOwnedNode = (authUser: AuthUser, node: MemoNode): MemoNode => {
  if (node.user_id !== authUser.id) {
    throw new HttpError(
      403,
      "MEMO_NODE_ACCESS_DENIED",
      "Memo node does not belong to the authenticated user",
    );
  }

  return node;
};

const assertOwnedSummary = (
  authUser: AuthUser,
  summary: MemoContentSummary,
): MemoContentSummary => {
  if (summary.user_id !== authUser.id) {
    throw new HttpError(
      403,
      "MEMO_ACCESS_DENIED",
      "Memo content does not belong to the authenticated user",
    );
  }

  return summary;
};

export const toMemoContentSummary = (
  content: MemoContent,
): MemoContentSummary => {
  const { content_mdx: _contentMdx, ...summary } = content;
  return summary;
};

export const toMemoDetailNode = (
  node: MemoNode,
  memo: MemoContent,
): MemoDetailNode => ({
  ...node,
  children: [],
  memo,
});

export const toMemoTreeNode = (
  node: MemoNode,
  memo: MemoContentSummary | null,
): MemoTreeNode => ({
  ...node,
  children: [],
  memo,
});

export const buildMemoTree = (
  authUser: AuthUser,
  nodes: MemoNode[],
  summaries: MemoContentSummary[],
  detachedRootId?: string,
): MemoTreeNode[] => {
  const summaryByNodeId = new Map<string, MemoContentSummary>();

  for (const summary of summaries) {
    assertOwnedSummary(authUser, summary);
    summaryByNodeId.set(summary.node_id, summary);
  }

  const treeById = new Map<string, MemoTreeNode>();

  for (const node of nodes) {
    assertOwnedNode(authUser, node);
    const summary = summaryByNodeId.get(node.id) ?? null;

    if (node.node_type === "folder" && summary !== null) {
      throw new HttpError(
        502,
        "MEMO_TREE_INVALID",
        "Folder node unexpectedly has memo content",
      );
    }

    if (node.node_type === "memo" && summary === null) {
      throw new HttpError(
        502,
        "MEMO_TREE_INVALID",
        "Memo node is missing its content summary",
      );
    }

    treeById.set(node.id, toMemoTreeNode(node, summary));
  }

  const roots: MemoTreeNode[] = [];

  for (const node of nodes) {
    const treeNode = treeById.get(node.id);
    if (treeNode === undefined) {
      throw new HttpError(502, "MEMO_TREE_INVALID", "Memo tree contains an invalid node");
    }
    if (node.parent_id === null || node.id === detachedRootId) {
      roots.push(treeNode);
      continue;
    }
    const parent = treeById.get(node.parent_id);
    if (parent === undefined || parent.node_type !== "folder") {
      throw new HttpError(502, "MEMO_TREE_INVALID", "Memo tree contains an invalid parent");
    }
    parent.children.push(treeNode);
  }

  const visited = new Set<string>();
  const activePath = new Set<string>();
  const visit = (node: MemoTreeNode): void => {
    if (activePath.has(node.id)) {
      throw new HttpError(502, "MEMO_TREE_INVALID", "Memo tree contains a cycle");
    }
    if (visited.has(node.id)) return;
    activePath.add(node.id);
    node.children.forEach(visit);
    activePath.delete(node.id);
    visited.add(node.id);
  };

  roots.forEach(visit);
  if (visited.size !== nodes.length) {
    throw new HttpError(502, "MEMO_TREE_INVALID", "Memo tree contains unreachable nodes");
  }

  return roots;
};
