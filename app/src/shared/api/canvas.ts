/**
 * [INPUT]: 依赖 shared/api/client 的统一 Bearer 请求与同步 keepalive 发起能力，以及后端 Canvas V2 snake_case 契约
 * [OUTPUT]: 对外提供 Canvas V2 身份/节点/边/mutation/context 类型、含持久 text_scale 的自由文字协议、默认/空白入口、读取、统一人工/AI 提交和有界 pagehide 发送
 * [POS]: app/src/shared/api 的 Canvas V2 唯一 HTTP 边界；Canvas 载荷只有投影快照和原生文字，content_mdx 永不进入此模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { apiRequest, startApiKeepalive } from "./client";
import type { MemoTreeNode } from "./memo";

export type CanvasKind = "memo_default" | "standalone";
export type CanvasNodeKind = "memo_ref" | "native";
export type CanvasAuthor = "ai" | "user";
export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
  user_moved?: boolean;
};

export type Canvas = {
  node_id: string;
  user_id: string;
  canvas_kind: CanvasKind;
  origin_node_id: string | null;
  origin_revision: number | null;
  version: number;
  viewport: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CanvasNodeTarget = {
  node_id: string;
  title: string;
  revision: number;
  deleted_at: string | null;
  excerpt: string | null;
};

export type CanvasNode = {
  id: string;
  kind: CanvasNodeKind;
  target_node_id: string | null;
  snapshot_title: string | null;
  snapshot_excerpt: string | null;
  snapshot_revision: number | null;
  discovered_from_id: string | null;
  text: string | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  text_scale: number | null;
  created_by: CanvasAuthor;
  target: CanvasNodeTarget | null;
};

export type CanvasNodeRow = Omit<CanvasNode, "target" | "text_scale" | "x" | "y"> & {
  canvas_id: string;
  user_id: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type CanvasEdge = {
  id: string;
  source_id: string;
  target_id: string;
  rationale: string | null;
  created_by: CanvasAuthor;
};

export type CanvasEdgeRow = CanvasEdge & {
  canvas_id: string;
  user_id: string;
  created_at: string;
};

export type CanvasDetail = {
  canvas: Canvas;
  node: MemoTreeNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type CanvasEntryResult = {
  canvas: Canvas;
  node: MemoTreeNode;
  focus_node_id: string | null;
  created: boolean;
};

export type CanvasOperation =
  | {
      type: "add_memo";
      node_id: string;
      target_node_id: string;
      discovered_from_id?: string;
      source_node_id?: string;
      edge_id?: string;
      rationale?: string | null;
      x: number;
      y: number;
    }
  | {
      type: "create_text";
      node_id: string;
      text: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      text_scale?: number;
    }
  | {
      type: "update_node";
      node_id: string;
      x?: number;
      y?: number;
      text?: string;
      width?: number;
      height?: number;
      text_scale?: number;
    }
  | { type: "remove_node"; node_id: string }
  | {
      type: "upsert_edge";
      edge_id: string;
      source_id: string;
      target_id: string;
      rationale?: string | null;
    }
  | { type: "remove_edge"; edge_id: string }
  | { type: "set_viewport"; viewport: CanvasViewport };

export type CanvasMutationRequest = {
  protocol_version: 2;
  mutation_id: string;
  base_version: number;
  operations: CanvasOperation[];
};

export type CanvasExpansionMutationRequest = CanvasMutationRequest & {
  source_canvas_node_id: string;
  source_revision: number;
  corpus_version: number;
  request_id: string;
  completion_status: "complete" | "incomplete_due_to_capacity";
  candidate_revisions: Array<{ memo_id: string; revision: number }>;
};

export type CanvasMutationNotice = {
  index: number;
  type: string;
  reason: string;
  node_id?: string;
  edge_id?: string;
};

export type CanvasMutationResult = {
  mutation_id: string;
  intent_digest: string;
  version: number;
  upserted_nodes: CanvasNodeRow[];
  removed_node_ids: string[];
  upserted_edges: CanvasEdgeRow[];
  removed_edge_ids: string[];
  aliases: Array<{ client_id: string; node_id: string }>;
  noops: CanvasMutationNotice[];
  dropped: CanvasMutationNotice[];
  expansion_status: "complete" | "incomplete_due_to_capacity" | null;
};

export type CanvasExpansionContext = {
  canvas_version: number;
  corpus_version: number;
  source: {
    canvas_node_id: string;
    memo_id: string;
    title: string;
    excerpt: string | null;
    revision: number;
  };
  checkpoint: null | {
    source_revision: number;
    corpus_version: number;
    request_id: string;
    completion_status: "complete" | "incomplete_due_to_capacity";
    completed_at: string;
  };
  neighbor_memo_ids: string[];
};

/**
 * 入口 RPC 分别返回 canvases 行与 memo_nodes 行，但树只认后者。这里把身份补回
 * tree node，让"就地并入目录"的节点与整树读取得到的节点携带同一套事实——否则
 * 刚创建的默认画布会在搜索里被当成独立画布重复出现一次。
 */
const withCanvasIdentity = (result: CanvasEntryResult): CanvasEntryResult => ({
  ...result,
  node: {
    ...result.node,
    canvas: {
      kind: result.canvas.canvas_kind,
      origin_node_id: result.canvas.origin_node_id,
    },
  },
});

export const getOrCreateMemoCanvas = async (
  accessToken: string | undefined,
  memoId: string,
): Promise<CanvasEntryResult> =>
  withCanvasIdentity(await apiRequest<CanvasEntryResult>(
    `/memos/${encodeURIComponent(memoId)}/canvas`,
    { method: "PUT" },
    accessToken,
  ));
export const createStandaloneCanvas = async (
  accessToken: string | undefined,
  input: { title?: string; parent_id?: string | null },
): Promise<CanvasEntryResult> =>
  withCanvasIdentity(await apiRequest<CanvasEntryResult>(
    "/canvases",
    {
      body: JSON.stringify({ protocol_version: 2, ...input }),
      method: "POST",
    },
    accessToken,
  ));

export const getCanvas = async (
  accessToken: string | undefined,
  canvasId: string,
  signal?: AbortSignal,
): Promise<CanvasDetail> =>
  await apiRequest<CanvasDetail>(
    `/canvases/${encodeURIComponent(canvasId)}`,
    { signal },
    accessToken,
  );

export const mutateCanvas = async (
  accessToken: string | undefined,
  canvasId: string,
  input: CanvasMutationRequest,
): Promise<CanvasMutationResult> =>
  await apiRequest<CanvasMutationResult>(
    `/canvases/${encodeURIComponent(canvasId)}`,
    { body: JSON.stringify(input), method: "PATCH" },
    accessToken,
  );

export const commitCanvasExpansion = async (
  accessToken: string | undefined,
  canvasId: string,
  input: CanvasExpansionMutationRequest,
): Promise<CanvasMutationResult> =>
  await apiRequest<CanvasMutationResult>(
    `/canvases/${encodeURIComponent(canvasId)}/expansions`,
    { body: JSON.stringify(input), method: "POST" },
    accessToken,
  );

export const getCanvasExpansionContext = async (
  accessToken: string | undefined,
  canvasId: string,
  nodeId: string,
): Promise<CanvasExpansionContext> =>
  await apiRequest<CanvasExpansionContext>(
    `/canvases/${encodeURIComponent(canvasId)}/nodes/${encodeURIComponent(nodeId)}/expansion-context`,
    {},
    accessToken,
  );

/**
 * 页面离开时仅发起、不确认。调用方必须保留 WAL，重开后靠同一 mutation_id
 * 的 receipt 对账；这个函数不会也不能宣称服务端已经保存。
 */
export const startCanvasMutationKeepalive = (
  accessToken: string,
  canvasId: string,
  input: CanvasMutationRequest,
): boolean =>
  startApiKeepalive(
    `/canvases/${encodeURIComponent(canvasId)}`,
    JSON.stringify(input),
    accessToken,
  );
