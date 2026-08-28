/**
 * [INPUT]: 依赖 @xyflow/react 的 Edge/Node 类型（仅类型）与 shared/api/canvas 的 Canvas V2 投影
 * [OUTPUT]: 对外提供固定 280x360 纵向 memo 卡片尺寸、含持久 text_scale 的空间文字投影、标题/视口容错、最近空位、路由类型解析与坐标回写纯函数
 * [POS]: app/src/pages 的 Canvas 表现策略边界；服务端快照在此翻译为受控 React Flow 形状，组件不再猜测墓碑、漂移或几何默认值
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Edge, Node } from "@xyflow/react";

import type {
  CanvasDetail,
  CanvasNode,
  CanvasNodeKind,
  CanvasViewport,
} from "../shared/api/canvas";

/**
 * memo_ref 卡片是一张纵向笔记预览纸，尺寸固定在此，不散落到组件或样式里。
 * 只作用于 memo_ref: native 空间文字的宽高与 text_scale 是用户数据，永不被这里覆盖。
 */
export const CANVAS_MEMO_WIDTH = 280;
export const CANVAS_MEMO_HEIGHT = 360;
export const CANVAS_TEXT_WIDTH = 240;
export const CANVAS_TEXT_HEIGHT = 120;
export const CANVAS_DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

export type CanvasFlowNodeData = {
  body: string | null;
  createdBy: "ai" | "user";
  discoveredFromId: string | null;
  drifted: boolean;
  kind: CanvasNodeKind;
  snapshotRevision: number | null;
  targetDeleted: boolean;
  targetNodeId: string | null;
  textHeight: number | null;
  textScale: number;
  textWidth: number | null;
  title: string;
  tombstone: boolean;
};
export type CanvasFlowNode = Node<CanvasFlowNodeData, "canvasNode">;

const FALLBACK_TEXT_TITLE = "自由文字";

export const canvasNodeTitle = (node: CanvasNode): string => {
  if (node.kind === "memo_ref") {
    return node.target?.title ?? node.snapshot_title ?? "已删除的笔记";
  }

  const firstLine = (node.text ?? "")
    .split("\n")
    .map((line: string) => line.replace(/^#+\s*/u, "").trim())
    .find((line: string) => line.length > 0);

  return firstLine === undefined
    ? FALLBACK_TEXT_TITLE
    : firstLine.slice(0, 60);
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const toCanvasViewport = (raw: unknown): CanvasViewport => {
  if (raw === null || typeof raw !== "object") {
    return CANVAS_DEFAULT_VIEWPORT;
  }
  const { x, y, zoom } = raw as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(zoom)) {
    return CANVAS_DEFAULT_VIEWPORT;
  }
  return {
    x,
    y,
    zoom: Math.min(2, Math.max(0.2, zoom)),
    ...((raw as Record<string, unknown>).user_moved === true
      ? { user_moved: true }
      : {}),
  };
};

export const shouldRestoreCanvasViewport = (raw: unknown): boolean =>
  raw !== null
  && typeof raw === "object"
  && (raw as Record<string, unknown>).user_moved === true
  && isFiniteNumber((raw as Record<string, unknown>).x)
  && isFiniteNumber((raw as Record<string, unknown>).y)
  && isFiniteNumber((raw as Record<string, unknown>).zoom);

export const toCanvasFlowNode = (node: CanvasNode): CanvasFlowNode => {
  const width = node.kind === "memo_ref"
    ? CANVAS_MEMO_WIDTH
    : node.width ?? CANVAS_TEXT_WIDTH;
  const height = node.kind === "memo_ref"
    ? CANVAS_MEMO_HEIGHT
    : node.height ?? CANVAS_TEXT_HEIGHT;

  return {
    data: {
      body: node.kind === "memo_ref"
        ? node.target?.excerpt ?? node.snapshot_excerpt
        : node.text,
      createdBy: node.created_by,
      discoveredFromId: node.discovered_from_id,
      drifted: node.kind === "memo_ref"
        && node.target !== null
        && node.snapshot_revision !== null
        && node.target.revision !== node.snapshot_revision,
      kind: node.kind,
      snapshotRevision: node.snapshot_revision,
      targetDeleted: node.target?.deleted_at !== null
        && node.target?.deleted_at !== undefined,
      targetNodeId: node.target_node_id,
      textHeight: node.kind === "native" ? height : null,
      textScale: node.kind === "native" ? node.text_scale ?? 1 : 1,
      textWidth: node.kind === "native" ? width : null,
      title: canvasNodeTitle(node),
      tombstone: node.kind === "memo_ref" && node.target_node_id === null,
    },
    id: node.id,
    position: { x: node.x, y: node.y },
    style: { height, width },
    type: "canvasNode",
  };
};

export const toCanvasFlow = (
  detail: CanvasDetail,
): { edges: Edge[]; nodes: CanvasFlowNode[]; viewport: CanvasViewport } => ({
  edges: detail.edges.map((edge) => ({
    data: { rationale: edge.rationale },
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: "cord",
  })),
  nodes: detail.nodes.map(toCanvasFlowNode),
  viewport: toCanvasViewport(detail.canvas.viewport),
});

/** 视口中心附近的确定性落点；碰撞规避由 canvasIncrementalLayout 统一负责。 */
export const nextCanvasTextPosition = (
  nodeCount: number,
): { x: number; y: number } => ({
  x: 32 + (nodeCount % 4) * 28,
  y: 32 + nodeCount * 24,
});

export const resolveCanvasNodeId = (
  node: { id: string; node_type: string } | null,
): string | null => (node?.node_type === "canvas" ? node.id : null);

export const canvasPositionOperation = (
  node: { id: string; position: { x: number; y: number } },
): {
  type: "update_node";
  node_id: string;
  x: number;
  y: number;
} | null => {
  if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
    return null;
  }
  return {
    node_id: node.id,
    type: "update_node",
    x: Math.round(node.position.x * 100) / 100,
    y: Math.round(node.position.y * 100) / 100,
  };
};
