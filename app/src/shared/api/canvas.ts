/**
 * [INPUT]: 依赖 shared/api/client 的统一 Bearer 请求能力与后端 canvases/canvas_nodes snake_case 响应契约
 * [OUTPUT]: 对外提供 Canvas/CanvasCard/CanvasEdge/CanvasDetail 类型与保存、读取、布局、新增卡片、晋升五个资源 API
 * [POS]: app/src/shared/api 的知识画布 HTTP 边界；载荷里只有卡片自己的文字与被引用笔记的标题/摘要，正文永不进入画布数据，因此画布视图不需要也拿不到 content_mdx
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { apiRequest } from "./client";
import type { MemoContent, MemoTreeNode } from "./memo";

export type CanvasCardKind = "excerpt" | "memo_ref" | "native";

export type CanvasViewport = { x: number; y: number; zoom: number };

export type Canvas = {
  node_id: string;
  user_id: string;
  origin_node_id: string | null;
  origin_revision: number | null;
  viewport: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** 被引用笔记的最小投影；deleted_at 非空表示在回收站，target 为 null 表示已被永久删除 */
export type CanvasCardTarget = {
  node_id: string;
  title: string;
  revision: number;
  deleted_at: string | null;
  excerpt: string | null;
};

export type CanvasCard = {
  id: string;
  kind: CanvasCardKind;
  target_node_id: string | null;
  anchored_rev: number | null;
  anchor: Record<string, unknown>;
  text: string | null;
  position_x: number;
  position_y: number;
  created_by: "ai" | "user";
  target: CanvasCardTarget | null;
};

export type CanvasEdge = {
  id: string;
  source_id: string;
  target_id: string;
  rationale: string | null;
  created_by: "ai" | "user";
};

export type CanvasDetail = {
  canvas: Canvas;
  node: MemoTreeNode;
  cards: CanvasCard[];
  edges: CanvasEdge[];
};

export type CanvasSaveResult = {
  canvas: Canvas;
  node: MemoTreeNode;
  card_count: number;
  skipped_count: number;
};

export type CanvasPromotion = {
  already_promoted: boolean;
  card: CanvasCard;
  memo: MemoContent | null;
  node: MemoTreeNode | null;
};

export type SaveCanvasItem = {
  confidence?: number;
  excerpt?: string;
  matched_channels?: string[];
  node_id: string;
  reason?: string;
  revision?: number;
  x?: number;
  y?: number;
};

/** accessToken 可省: 省略时 apiRequest 在请求期实时取 token，长会话功能应当走这条路 */
export const saveExplorationCanvas = async (
  accessToken: string | undefined,
  input: {
    items: SaveCanvasItem[];
    origin_node_id: string;
    parent_id?: string | null;
    title: string;
    viewport?: Record<string, unknown>;
  },
): Promise<CanvasSaveResult> =>
  await apiRequest<CanvasSaveResult>(
    "/canvases",
    { body: JSON.stringify(input), method: "POST" },
    accessToken,
  );

export const getCanvas = async (
  accessToken: string,
  canvasId: string,
  signal?: AbortSignal,
): Promise<CanvasDetail> =>
  await apiRequest<CanvasDetail>(
    `/canvases/${encodeURIComponent(canvasId)}`,
    { signal },
    accessToken,
  );

export const updateCanvasLayout = async (
  accessToken: string,
  canvasId: string,
  input: {
    cards?: { id: string; x: number; y: number }[];
    viewport?: Record<string, unknown>;
  },
): Promise<{ canvas: Canvas; moved_count: number }> =>
  await apiRequest<{ canvas: Canvas; moved_count: number }>(
    `/canvases/${encodeURIComponent(canvasId)}`,
    { body: JSON.stringify(input), method: "PATCH" },
    accessToken,
  );

export const createCanvasCard = async (
  accessToken: string,
  canvasId: string,
  input: {
    anchored_rev?: number;
    kind: "excerpt" | "native";
    source_node_id?: string;
    text: string;
    x?: number;
    y?: number;
  },
): Promise<CanvasCard> =>
  await apiRequest<CanvasCard>(
    `/canvases/${encodeURIComponent(canvasId)}/cards`,
    { body: JSON.stringify(input), method: "POST" },
    accessToken,
  );

export const promoteCanvasCard = async (
  accessToken: string,
  cardId: string,
  input: { parent_id?: string | null; title?: string } = {},
): Promise<CanvasPromotion> =>
  await apiRequest<CanvasPromotion>(
    `/canvas-cards/${encodeURIComponent(cardId)}/promote`,
    { body: JSON.stringify(input), method: "POST" },
    accessToken,
  );
