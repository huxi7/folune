/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型与 memo.model 的 MemoContent/MemoNode
 * [OUTPUT]: 对外提供 Canvas、CanvasCard/CanvasCardTarget、CanvasEdge、CanvasDetail、CanvasSaveResult、CanvasPromotion 与布局更新结果类型
 * [POS]: model 层知识画布领域契约；画布的树身份仍是 MemoNode，此处只描述画布自己的视口、卡片与边。卡片引用笔记时只携带标题与既有摘要，正文永不进入画布载荷
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoContent, MemoNode } from "./memo.model.ts";

export type CanvasCardKind = "memo_ref" | "excerpt" | "native";

export type CanvasAuthor = "user" | "ai";

export interface Canvas {
  node_id: string;
  user_id: string;
  origin_node_id: string | null;
  origin_revision: number | null;
  viewport: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/** 被引用笔记的最小可渲染投影；deleted_at 非空表示它已在回收站，target 为 null 表示已被永久删除 */
export interface CanvasCardTarget {
  node_id: string;
  title: string;
  revision: number;
  deleted_at: string | null;
  excerpt: string | null;
}

export interface CanvasCard {
  id: string;
  kind: CanvasCardKind;
  target_node_id: string | null;
  anchored_rev: number | null;
  anchor: Readonly<Record<string, unknown>>;
  text: string | null;
  position_x: number;
  position_y: number;
  created_by: CanvasAuthor;
  target: CanvasCardTarget | null;
}

export interface CanvasEdge {
  id: string;
  source_id: string;
  target_id: string;
  rationale: string | null;
  created_by: CanvasAuthor;
}

export interface CanvasDetail {
  canvas: Canvas;
  node: MemoNode;
  cards: CanvasCard[];
  edges: CanvasEdge[];
}

export interface CanvasSaveResult {
  canvas: Canvas;
  node: MemoNode;
  /** 实际落库的关联卡片数 */
  card_count: number;
  /** 探索到保存之间已失联（被删除或就是中心自己）而跳过的候选数 */
  skipped_count: number;
}

export interface CanvasLayoutResult {
  canvas: Canvas;
  moved_count: number;
}

export interface CanvasPromotion {
  /** 幂等重放: 该卡片此前已晋升过，本次未创建新笔记 */
  already_promoted: boolean;
  card: CanvasCard;
  /** 重放且目标已被永久删除时为 null——那是墓碑，不是错误 */
  memo: MemoContent | null;
  node: MemoNode | null;
}
