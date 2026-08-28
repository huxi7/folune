/**
 * [INPUT]: 依赖 shared/api 的轻量 MemoTreeNode（含画布身份）与 ApiError，以及 memoTree 的 updateNode 路径克隆
 * [OUTPUT]: 对外提供 normalizeMemoTitle 规范化、findMemoTitleConflict 与 memoNodeTitleTaken 同级重名判据、canRenameMemoNode 可改名判据、isMemoTitleConflictError 服务端冲突识别与 withDefaultCanvasTitles 默认画布标题跟随
 * [POS]: shared/store 的命名规则纯策略，与 api/supabase/memo-naming.sql 的 memo_title_norm 同语义；它只负责即时反馈，并发下的最终真相永远是数据库唯一索引，因此各入口必须同时接住服务端冲突
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ApiError } from "../api/client";
import type { MemoTreeNode } from "../api/memo";
import { updateNode } from "./memoTree";

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

/**
 * 默认 Canvas 是来源笔记的空间视图，名称跟随笔记且不可独立编辑，所以文件树的
 * 三个重命名入口（双击 / F2 / 右键）都不对它开放。数据层的 anchor 触发器同样
 * 会把改名回落回来源标题——UI 只是不去做注定被驳回的事。
 */
export const canRenameMemoNode = (node: MemoTreeNode): boolean =>
  node.canvas?.kind !== "memo_default";

/** 服务端唯一约束拒绝的稳定业务错误码 */
export const isMemoTitleConflictError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "MEMO_TITLE_CONFLICT";

/**
 * 数据库 memo_nodes_sync_default_canvas_title 触发器的客户端镜像：默认 Canvas 的
 * 标题永远等于来源笔记的标题。服务端已经在同一事务里改好了，这一层只让本地树
 * 立刻显示同一个事实，而不是等下一次整树读取才追上。
 *
 * 只有真的存在不一致时才动树：命中的画布逐个走 updateNode（只克隆祖先路径），
 * 其余引用保持不变——标题输入是逐字符调用的，全树重建会让打字变卡。
 */
export const withDefaultCanvasTitles = (
  nodes: readonly MemoTreeNode[],
): MemoTreeNode[] => {
  const memoTitles = new Map<string, string>();
  const defaultCanvases: MemoTreeNode[] = [];

  const visit = (list: readonly MemoTreeNode[]): void => {
    for (const node of list) {
      if (node.node_type === "memo") {
        memoTitles.set(node.id, node.title);
      } else if (node.canvas?.kind === "memo_default") {
        defaultCanvases.push(node);
      }

      visit(node.children);
    }
  };

  visit(nodes);

  return defaultCanvases.reduce((current, canvas) => {
    const originId = canvas.canvas?.origin_node_id ?? null;
    const originTitle = originId === null ? undefined : memoTitles.get(originId);

    return originTitle === undefined || originTitle === canvas.title
      ? current
      : updateNode(current, canvas.id, (node) => ({
        ...node,
        title: originTitle,
      }));
  }, nodes as MemoTreeNode[]);
};
