/**
 * [INPUT]: 依赖 shared/api 的轻量 MemoTreeNode 与 ApiError
 * [OUTPUT]: 对外提供 normalizeMemoTitle 规范化、findMemoTitleConflict 与 memoNodeTitleTaken 同级重名判据、isMemoTitleConflictError 服务端冲突识别
 * [POS]: shared/store 的命名规则纯策略，与 api/supabase/memo-naming.sql 的 memo_title_norm 同语义；它只负责即时反馈，并发下的最终真相永远是数据库唯一索引，因此各入口必须同时接住服务端冲突
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ApiError } from "../api/client";
import type { MemoTreeNode } from "../api/memo";

/**
 * 规范化是 memo_title_norm(text) 的镜像：首尾空白、连续空白折叠、拉丁大小写。
 * 中文没有大小写，故不需要额外分支。
 *
 * 与数据库对拉丁以外字符的折叠可能有极少数分歧（Postgres 的 lower() 依赖
 * collation，JS 的 toLowerCase() 依赖 Unicode 默认映射）。这不是缺陷：前端
 * 只负责让用户立刻看见"已存在同名"，判定重名的最终权力在唯一索引。
 */
export const normalizeMemoTitle = (title: string): string =>
  title.trim().replace(/\s+/gu, " ").toLowerCase();

const siblingsAt = (
  nodes: readonly MemoTreeNode[],
  parentId: string | null,
): readonly MemoTreeNode[] | null => {
  if (parentId === null) return nodes;

  for (const node of nodes) {
    if (node.id === parentId) return node.children;
    const found = siblingsAt(node.children, parentId);
    if (found !== null) return found;
  }

  return null;
};

export type MemoTitleConflictInput = {
  /** 正在改名的节点；新建对象传 null */
  nodeId: string | null;
  nodeType: MemoTreeNode["node_type"];
  nodes: readonly MemoTreeNode[];
  parentId: string | null;
  title: string;
};

/**
 * 同 user、同 parent、同 node_type、规范化标题相同即冲突。轻量树只装活跃节点，
 * 所以"回收站里的同名不阻塞新命名"是自然结果，与唯一索引排除 deleted_at 的
 * partial 条件一致。一篇笔记与它的默认 Canvas 同名合法，因为 node_type 不同。
 */
export const findMemoTitleConflict = ({
  nodeId,
  nodeType,
  nodes,
  parentId,
  title,
}: MemoTitleConflictInput): MemoTreeNode | null => {
  const normalized = normalizeMemoTitle(title);

  // 空标题由"名称不能为空"负责，不是重名
  if (normalized.length === 0) return null;

  return (siblingsAt(nodes, parentId) ?? []).find((sibling) =>
    sibling.id !== nodeId
    && sibling.node_type === nodeType
    && normalizeMemoTitle(sibling.title) === normalized) ?? null;
};

/**
 * 把「某个既有节点改名到 title」翻译成一次冲突判定。文件树重命名、标题编辑区
 * 与新建对话框共用它，避免三处各自拼一遍 parentId / node_type。
 */
export const memoNodeTitleTaken = (
  nodes: readonly MemoTreeNode[],
  node: MemoTreeNode | null,
  title: string,
): boolean =>
  node !== null
  && findMemoTitleConflict({
    nodeId: node.id,
    nodeType: node.node_type,
    nodes,
    parentId: node.parent_id,
    title,
  }) !== null;

/** 服务端唯一约束拒绝的稳定业务错误码 */
export const isMemoTitleConflictError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "MEMO_TITLE_CONFLICT";
