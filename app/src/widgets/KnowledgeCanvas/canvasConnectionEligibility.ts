/**
 * [INPUT]: 依赖 CanvasDetail/CanvasNode 的节点与正式边事实，不访问 React、DOM、Store 或持久化实现
 * [OUTPUT]: 对外提供 isConnectableMemoNode 与 canvasConnectionEligibility，可区分缺失、自连、失效节点和重复关系
 * [POS]: KnowledgeCanvas 的连接判据唯一真相；点击与拖拽只消费结论，不得各自复制 if 分支
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CanvasDetail, CanvasNode } from "../../shared/api/canvas";

export type CanvasConnectionRejection =
  | "duplicate"
  | "missing-source"
  | "missing-target"
  | "self"
  | "source-unavailable"
  | "target-unavailable";

export type CanvasConnectionEligibility =
  | { valid: true; source: CanvasNode; target: CanvasNode }
  | { valid: false; reason: CanvasConnectionRejection };

export const isConnectableMemoNode = (node: CanvasNode | undefined): node is CanvasNode =>
  node?.kind === "memo_ref"
  && node.target_node_id !== null
  && node.target?.deleted_at !== undefined
  && node.target.deleted_at === null;

const edgePairKey = (sourceId: string, targetId: string): string =>
  sourceId < targetId ? `${sourceId}:${targetId}` : `${targetId}:${sourceId}`;

export function canvasConnectionEligibility(
  detail: CanvasDetail | null,
  sourceId: string,
  targetId: string,
): CanvasConnectionEligibility {
  const source = detail?.nodes.find((node) => node.id === sourceId);
  if (source === undefined) return { reason: "missing-source", valid: false };
  const target = detail?.nodes.find((node) => node.id === targetId);
  if (target === undefined) return { reason: "missing-target", valid: false };
  if (sourceId === targetId) return { reason: "self", valid: false };
  if (!isConnectableMemoNode(source)) {
    return { reason: "source-unavailable", valid: false };
  }
  if (!isConnectableMemoNode(target)) {
    return { reason: "target-unavailable", valid: false };
  }
  const pair = edgePairKey(sourceId, targetId);
  if (detail?.edges.some((edge) => edgePairKey(edge.source_id, edge.target_id) === pair)) {
    return { reason: "duplicate", valid: false };
  }
  return { source, target, valid: true };
}
