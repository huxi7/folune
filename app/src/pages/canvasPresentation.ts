/**
 * [INPUT]: 依赖 @xyflow/react 的 Edge/Node 类型（仅类型，运行时零依赖）与 shared/api/canvas 的 CanvasDetail 契约
 * [OUTPUT]: 对外提供 CANVAS_CARD_WIDTH、canvasCardTitle、toCanvasViewport/shouldRestoreCanvasViewport、toCanvasFlowNode/toCanvasFlow、nextCanvasCardPosition、resolveCanvasNodeId、canvasLayoutFromNodes 与 CanvasFlowNode/Data 类型
 * [POS]: app/src/pages 的画布表现策略边界，与 explorePresentation 同位；把服务端画布投影翻译成 React Flow 需要的形状，并在这里而不是组件里判断「能否晋升、锚点是否漂移、目标是否成了墓碑」。纯函数、不碰 React/DOM，故可单测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Edge, Node } from "@xyflow/react";

import type {
  CanvasCard,
  CanvasCardKind,
  CanvasDetail,
  CanvasViewport,
} from "../shared/api/canvas";

/** 卡片宽度固定，高度由内容决定；画布靠 pan/zoom 而不是靠卡片变形来适配 */
export const CANVAS_CARD_WIDTH = 260;

export const CANVAS_DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

export type CanvasFlowNodeData = {
  /** 摘录/引用成立时目标的 revision */
  anchoredRev: number | null;
  body: string | null;
  /** 目标正文在此之后被改过，卡片上的引文可能已不是最新 */
  drifted: boolean;
  kind: CanvasCardKind;
  /** 只有还没成为笔记的卡片才能晋升 */
  promotable: boolean;
  /** 目标在回收站里 */
  targetDeleted: boolean;
  targetNodeId: string | null;
  title: string;
  /** 目标已被永久删除，只剩墓碑 */
  tombstone: boolean;
};

export type CanvasFlowNode = Node<CanvasFlowNodeData, "canvasCard">;

const FALLBACK_TITLE = "摘录";

/** 卡片自己的文字没有标题字段，取首行并剥掉 Markdown 标题记号——与晋升时的取名规则同源 */
export const canvasCardTitle = (card: CanvasCard): string => {
  if (card.kind === "memo_ref") {
    return card.target?.title ?? "已删除的笔记";
  }

  const firstLine = (card.text ?? "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/u, "").trim())
    .find((line) => line.length > 0);

  return firstLine === undefined
    ? FALLBACK_TITLE
    : firstLine.slice(0, 60);
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** 视口来自数据库 jsonb，任何一项不可信就整体退回默认值，绝不把 NaN 交给 React Flow */
export const toCanvasViewport = (raw: unknown): CanvasViewport => {
  if (raw === null || typeof raw !== "object") {
    return CANVAS_DEFAULT_VIEWPORT;
  }

  const { x, y, zoom } = raw as Record<string, unknown>;

  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(zoom)) {
    return CANVAS_DEFAULT_VIEWPORT;
  }

  return { x, y, zoom: Math.min(2, Math.max(0.2, zoom)) };
};

/**
 * 只有用户亲手平移/缩放过的视口才值得恢复。早期版本会把首次 fitView 触发的
 * 程序化 onMoveEnd 也写进数据库，那批数值虽然合法，却是在错误容器尺寸下算出的，
 * 直接恢复会把整张图推到屏幕外。没有显式标记的旧值统一重新 fit 全图一次。
 */
export const shouldRestoreCanvasViewport = (raw: unknown): boolean =>
  raw !== null
  && typeof raw === "object"
  && (raw as Record<string, unknown>).user_moved === true
  && toCanvasViewport(raw) !== CANVAS_DEFAULT_VIEWPORT;

/** 单张卡片 → 单个节点；读取整张画布与新增一张卡片必须走同一条投影 */
export const toCanvasFlowNode = (card: CanvasCard): CanvasFlowNode => ({
  data: {
    anchoredRev: card.anchored_rev,
    body: card.kind === "memo_ref" ? card.target?.excerpt ?? null : card.text,
    drifted: card.kind === "memo_ref"
      && card.target !== null
      && card.anchored_rev !== null
      && card.target.revision !== card.anchored_rev,
    kind: card.kind,
    promotable: card.kind !== "memo_ref",
    targetDeleted: card.target?.deleted_at !== null
      && card.target?.deleted_at !== undefined,
    targetNodeId: card.target_node_id,
    title: canvasCardTitle(card),
    tombstone: card.kind === "memo_ref" && card.target === null,
  },
  id: card.id,
  position: { x: card.position_x, y: card.position_y },
  type: "canvasCard",
});

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
  nodes: detail.cards.map(toCanvasFlowNode),
  viewport: toCanvasViewport(detail.canvas.viewport),
});

/**
 * 新卡片的落点: 从原点按已有卡片数阶梯错开，确定性且永不与旧卡完全重合。
 * 不用视口中心是因为那需要容器尺寸，而落点本来就该由用户拖到他想要的位置。
 */
export const nextCanvasCardPosition = (
  cardCount: number,
): { x: number; y: number } => ({
  x: 32 + (cardCount % 4) * 28,
  y: 32 + cardCount * 24,
});

/**
 * 选中的树节点是不是一张画布。画布与笔记共用 /app/notes/:id 这一条路由，
 * 打开哪一种由节点自己的 node_type 决定——因此点树、刷新与分享链接都不需要
 * 第二套路由，也不需要在 Dashboard 里多存一份「当前画布」状态。
 */
export const resolveCanvasNodeId = (
  node: { id: string; node_type: string } | null,
): string | null => (node?.node_type === "canvas" ? node.id : null);

/** 拖拽后要回写的坐标；只取真实存在的有限值，避免把测量中的 NaN 落库 */
export const canvasLayoutFromNodes = (
  nodes: readonly { id: string; position: { x: number; y: number } }[],
): { id: string; x: number; y: number }[] =>
  nodes
    .filter((node) =>
      Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
    .map((node) => ({
      id: node.id,
      x: Math.round(node.position.x * 100) / 100,
      y: Math.round(node.position.y * 100) / 100,
    }));
