/**
 * [INPUT]: 依赖 @xyflow/react 的 Edge/Node 类型（仅类型）与 shared/api/canvas 的 Canvas V2 投影
 * [OUTPUT]: 对外提供固定 memo 卡片尺寸、空间文字投影、UI-only motionState、节点/边对象身份对账、视口/选择判据、路由解析与手势级坐标回写纯函数
 * [POS]: app/src/pages 的 Canvas 表现策略边界；服务端快照在此翻译并增量对账为受控 React Flow 形状，未变化对象保持身份以兑现节点 memo，组件不再猜测墓碑、漂移或几何默认值
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

export type CanvasFlowMotionState = {
  delayMs: number;
  gestureId: string;
  kind: "edge-draw" | "node-enter" | "source-confirm";
  offsetX?: number;
  offsetY?: number;
};

export type CanvasFlowNodeData = {
  body: string | null;
  createdBy: "ai" | "user";
  discoveredFromId: string | null;
  drifted: boolean;
  kind: CanvasNodeKind;
  motionState?: CanvasFlowMotionState;
  paperTransitionActive?: boolean;
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
export type CanvasFlowEdgeData = {
  createdBy: "ai" | "user";
  motionState?: CanvasFlowMotionState;
  rationale: string | null;
};
export type CanvasFlowEdge = Edge<CanvasFlowEdgeData, "cord">;

const FALLBACK_TEXT_TITLE = "自由文字";

/*
 * 「这个节点还能不能拓展」只有这一处定义。卡片上的 available 是它在 flow data
 * 形状上的同一判据（读得出正文才提供阅读/AI/关联），键盘加速器读的是服务端文档
 * 形状, 所以判据必须在这里有名字, 而不是两边各写一遍三个与条件。
 */
export const canExpandFromNode = (node: CanvasNode): boolean =>
  node.kind === "memo_ref"
  && node.target_node_id !== null
  && (node.target?.deleted_at ?? null) === null;

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
      paperTransitionActive: false,
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
): { edges: CanvasFlowEdge[]; nodes: CanvasFlowNode[]; viewport: CanvasViewport } => ({
  edges: detail.edges.map((edge) => ({
    data: {
      createdBy: edge.created_by,
      rationale: edge.rationale,
    },
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: "cord",
  })),
  nodes: detail.nodes.map(toCanvasFlowNode),
  viewport: toCanvasViewport(detail.canvas.viewport),
});

const sameCanvasFlowNode = (
  current: CanvasFlowNode,
  projected: CanvasFlowNode,
): boolean =>
  current.id === projected.id
  && current.type === projected.type
  && current.position.x === projected.position.x
  && current.position.y === projected.position.y
  && current.style?.width === projected.style?.width
  && current.style?.height === projected.style?.height
  && current.data.body === projected.data.body
  && current.data.createdBy === projected.data.createdBy
  && current.data.discoveredFromId === projected.data.discoveredFromId
  && current.data.drifted === projected.data.drifted
  && current.data.kind === projected.data.kind
  && current.data.motionState?.gestureId === projected.data.motionState?.gestureId
  && current.data.motionState?.kind === projected.data.motionState?.kind
  && current.data.motionState?.delayMs === projected.data.motionState?.delayMs
  && current.data.motionState?.offsetX === projected.data.motionState?.offsetX
  && current.data.motionState?.offsetY === projected.data.motionState?.offsetY
  && Boolean(current.data.paperTransitionActive)
    === Boolean(projected.data.paperTransitionActive)
  && current.data.snapshotRevision === projected.data.snapshotRevision
  && current.data.targetDeleted === projected.data.targetDeleted
  && current.data.targetNodeId === projected.data.targetNodeId
  && current.data.textHeight === projected.data.textHeight
  && current.data.textScale === projected.data.textScale
  && current.data.textWidth === projected.data.textWidth
  && current.data.title === projected.data.title
  && current.data.tombstone === projected.data.tombstone;

/**
 * 文档每确认一次 mutation 都会产生新快照，但绝大多数卡片没有变化。保持这些节点
 * 的对象身份，React.memo 才真的能跳过它们；正在拖动的节点还必须优先保留 React
 * Flow 的瞬时坐标，避免无关回执把指针下的卡片弹回服务端旧位置。
 */
export const reconcileCanvasFlowNodes = (
  current: readonly CanvasFlowNode[],
  projected: readonly CanvasFlowNode[],
): CanvasFlowNode[] => {
  const currentById = new Map(current.map((node) => [node.id, node]));
  return projected.map((node) => {
    const previous = currentById.get(node.id);
    if (previous === undefined) return node;
    if (previous.dragging === true) {
      const next = {
        ...node,
        dragging: true,
        measured: previous.measured,
        position: previous.position,
        selected: previous.selected,
      };
      return sameCanvasFlowNode(previous, next) ? previous : next;
    }
    if (sameCanvasFlowNode(previous, node)) {
      return previous;
    }
    return {
      ...node,
      measured: previous.measured,
      selected: previous.selected,
    };
  });
};

const sameCanvasFlowEdge = (
  current: CanvasFlowEdge,
  projected: CanvasFlowEdge,
): boolean =>
  current.id === projected.id
  && current.source === projected.source
  && current.target === projected.target
  && current.type === projected.type
  && current.data?.createdBy === projected.data?.createdBy
  && current.data?.motionState?.gestureId === projected.data?.motionState?.gestureId
  && current.data?.motionState?.kind === projected.data?.motionState?.kind
  && current.data?.motionState?.delayMs === projected.data?.motionState?.delayMs
  && current.data?.rationale === projected.data?.rationale;

/** 只替换关系事实或强调状态真正变化的边，选择一张卡片不再重建全部 Cord。 */
export const reconcileCanvasFlowEdges = (
  current: readonly CanvasFlowEdge[],
  projected: readonly CanvasFlowEdge[],
  selectedNodeIds: readonly string[],
): CanvasFlowEdge[] => {
  const selectedId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const currentById = new Map(current.map((edge) => [edge.id, edge]));
  return projected.map((edge) => {
    const className = selectedId !== null
      && (edge.source === selectedId || edge.target === selectedId)
      ? "canvas-edge-direct"
      : "canvas-edge-muted";
    const previous = currentById.get(edge.id);
    if (
      previous !== undefined
      && previous.className === className
      && sameCanvasFlowEdge(previous, edge)
    ) {
      return previous;
    }
    return {
      ...edge,
      className,
      selected: previous?.selected,
    };
  });
};

export type CanvasBounds = { height: number; width: number; x: number; y: number };

/** 节点包围盒；尺寸只来自本文件写入的 style，不依赖 React Flow 的测量时机 */
export const canvasNodesBounds = (
  nodes: readonly CanvasFlowNode[],
): CanvasBounds | null => {
  if (nodes.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const width = typeof node.style?.width === "number" ? node.style.width : 0;
    const height = typeof node.style?.height === "number" ? node.style.height : 0;
    left = Math.min(left, node.position.x);
    top = Math.min(top, node.position.y);
    right = Math.max(right, node.position.x + width);
    bottom = Math.max(bottom, node.position.y + height);
  }

  return { height: bottom - top, width: right - left, x: left, y: top };
};

/**
 * 成组外接框该占的矩形，null 表示这一刻不该有框。
 *
 * React Flow 自带的 NodesSelection 只活在"框选手势已结束、且还没有人碰过节点"
 * 这一小段时间里：框选途中它不画，抓住组里任意一张卡片开始拖它也立刻消失。于是
 * 用户看到的框忽明忽暗，只有松手那一瞬间才知道自己框住了谁。这里补上它缺席的
 * 两段——框选进行中，以及多选静止但 React Flow 已经放手——并在它自己画框时让
 * 位，因此同一时刻永远只有一个框，交接也不会看到框跳一下。
 *
 * 静止时的单选不成框：那时卡片自身的描边已经说清了命令对象，再套一个只贴着它的
 * 框只是噪音。框选途中相反，第一张被框住就要立刻成框，否则松手时框会凭空出现。
 */
export const canvasGroupSelectionBounds = (
  nodes: readonly CanvasFlowNode[],
  flow: { marqueeActive: boolean; ownGroupBoxVisible: boolean },
): CanvasBounds | null => {
  if (flow.ownGroupBoxVisible) return null;
  const selected = nodes.filter((node) => node.selected === true);
  if (selected.length < (flow.marqueeActive ? 1 : 2)) return null;
  return canvasNodesBounds(selected);
};

/**
 * 恢复用户视口前的可用性判据。视口是按当前设备的画布尺寸存下来的：把 1440 宽
 * 屏上的平移缩放原样搬到手机上，全部节点会落在可视区外，用户看到一张空画布。
 * 因此恢复之前先问一句"这个视口还看得见东西吗"，看不见就退回 fitView。
 */
export const canvasViewportShowsNodes = (
  bounds: CanvasBounds | null,
  viewport: CanvasViewport,
  size: { height: number; width: number },
): boolean => {
  if (bounds === null) return true;
  if (size.width <= 0 || size.height <= 0) return true;
  const left = bounds.x * viewport.zoom + viewport.x;
  const top = bounds.y * viewport.zoom + viewport.y;
  const right = left + bounds.width * viewport.zoom;
  const bottom = top + bounds.height * viewport.zoom;
  return right > 0 && left < size.width && bottom > 0 && top < size.height;
};

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

export type CanvasPositionOperation = {
  type: "update_node";
  node_id: string;
  x: number;
  y: number;
};

type CanvasDraggedNode = { id: string; position: { x: number; y: number } };

export const canvasPositionOperation = (
  node: CanvasDraggedNode,
): CanvasPositionOperation | null => {
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

/**
 * 坐标回写的单位是一次手势，不是一个节点。
 *
 * React Flow 的多选拖动只在指针下那一个节点上报事件，整组的最终坐标在同一次
 * 回调的第三个参数里。只回写其中一个，乐观投影随即把其余节点按旧文档弹回原处，
 * 用户看到的就是"松手那一刻组内相对位置散掉"。
 */
export const canvasPositionOperations = (
  nodes: readonly CanvasDraggedNode[],
): CanvasPositionOperation[] => nodes
  .map(canvasPositionOperation)
  .filter((operation): operation is CanvasPositionOperation => operation !== null);
