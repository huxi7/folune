/**
 * [INPUT]: 仅依赖 memo.model 的 MemoNode 领域类型
 * [OUTPUT]: 对外提供 Canvas V2 单一身份、含自由文字持久缩放的节点/边、创建回执、统一 mutation 回执与可信 expansion context 类型
 * [POS]: model 层 Canvas V2 领域契约；Canvas ID 始终等于 memo_nodes.id/canvases.node_id，载荷只有快照与摘要而无正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoNode } from "./memo.model.ts";

export type CanvasAuthor = "user" | "ai";
export type CanvasKind = "memo_default" | "standalone";

export interface CanvasTarget {
  node_id: string;
  title: string;
  revision: number;
  deleted_at: string | null;
  excerpt: string | null;
}

export interface CanvasEdge {
  id: string;
  source_id: string;
  target_id: string;
  rationale: string | null;
  created_by: CanvasAuthor;
}

export interface CanvasV2 {
  node_id: string;
  user_id: string;
  origin_node_id: string | null;
  origin_revision: number | null;
  viewport: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
  canvas_kind: CanvasKind;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasNodeV2 {
  id: string;
  kind: "memo_ref" | "native";
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
  target: CanvasTarget | null;
}

export interface CanvasDetailV2 {
  canvas: CanvasV2;
  node: MemoNode;
  nodes: CanvasNodeV2[];
  edges: CanvasEdge[];
}

export interface CanvasEntryResult {
  canvas: CanvasV2;
  node: MemoNode;
  focus_node_id: string | null;
  created: boolean;
}

export interface CanvasMutationNotice {
  index: number;
  type: string;
  reason: string;
  node_id?: string;
  edge_id?: string;
}

export interface CanvasMutationResultV2 {
  mutation_id: string;
  intent_digest: string;
  version: number;
  upserted_nodes: Readonly<Record<string, unknown>>[];
  removed_node_ids: string[];
  upserted_edges: Readonly<Record<string, unknown>>[];
  removed_edge_ids: string[];
  aliases: Array<{ client_id: string; node_id: string }>;
  noops: CanvasMutationNotice[];
  dropped: CanvasMutationNotice[];
  expansion_status: "complete" | "incomplete_due_to_capacity" | null;
}

export interface CanvasExpansionContext {
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
}
