/**
 * [INPUT]: 依赖 zod 的 UUID/strict object/联合/infer 能力与 memo.dto 的 memoNodeRowSchema/memoContentRowSchema
 * [OUTPUT]: 对外提供画布保存/读取/布局/晋升四个 RPC 结果 schema、HTTP body/param schema 及 infer 类型
 * [POS]: dto 层知识画布数据边界；RPC 结果一律按 status 判别联合校验，HTTP 入参一律 strict，坐标与视口只接受有限数值
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { memoContentRowSchema, memoNodeRowSchema } from "./memo.dto.ts";

const metadataSchema = z.record(z.string(), z.unknown());
const coordinateSchema = z.number().finite();
const titleSchema = z.string().trim().min(1).max(500);

export const canvasRowSchema = z.object({
  node_id: z.uuid(),
  user_id: z.uuid(),
  origin_node_id: z.uuid().nullable(),
  origin_revision: z.coerce.number().int().positive().nullable(),
  viewport: metadataSchema,
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const canvasCardTargetSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  revision: z.coerce.number().int().positive(),
  deleted_at: z.string().nullable(),
  excerpt: z.string().nullable(),
});

/** 读取画布时的富卡片：带被引用笔记的最小投影 */
export const canvasCardSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["memo_ref", "excerpt", "native"]),
  target_node_id: z.uuid().nullable(),
  anchored_rev: z.coerce.number().int().positive().nullable(),
  anchor: metadataSchema,
  text: z.string().nullable(),
  // numeric 经 PostgREST 会以字符串出站，故统一 coerce
  position_x: z.coerce.number().finite(),
  position_y: z.coerce.number().finite(),
  created_by: z.enum(["user", "ai"]),
  target: canvasCardTargetSchema.nullable(),
});

/** 晋升返回的是 canvas_nodes 原始行，不含 target 投影 */
export const canvasCardRowSchema = canvasCardSchema.omit({ target: true }).extend({
  canvas_id: z.uuid(),
  user_id: z.uuid(),
  created_at: z.string(),
  metadata: metadataSchema,
  updated_at: z.string(),
});

export const canvasEdgeSchema = z.object({
  id: z.uuid(),
  source_id: z.uuid(),
  target_id: z.uuid(),
  rationale: z.string().nullable(),
  created_by: z.enum(["user", "ai"]),
});

const rpcNotFoundSchema = z.object({ status: z.literal("not_found") });
const rpcInvalidSchema = z.object({
  status: z.literal("invalid"),
  error_code: z.string().optional(),
});

export const saveCanvasRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("created"),
    canvas: canvasRowSchema,
    node: memoNodeRowSchema,
    card_count: z.number().int().nonnegative(),
    skipped_count: z.number().int().nonnegative(),
  }),
  z.object({ status: z.literal("origin_not_found") }),
  z.object({ status: z.literal("parent_not_found") }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

export const readCanvasRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    canvas: canvasRowSchema,
    node: memoNodeRowSchema,
    cards: z.array(canvasCardSchema),
    edges: z.array(canvasEdgeSchema),
  }),
  rpcNotFoundSchema,
]);

export const canvasLayoutRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("updated"),
    canvas: canvasRowSchema,
    moved_count: z.number().int().nonnegative(),
  }),
  rpcNotFoundSchema,
]);

export const promoteCanvasNodeRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("promoted"),
    card: canvasCardRowSchema,
    node: memoNodeRowSchema,
    memo: memoContentRowSchema,
  }),
  z.object({
    status: z.literal("already_promoted"),
    card: canvasCardRowSchema,
    memo: memoContentRowSchema.nullable(),
    node: memoNodeRowSchema.nullable(),
  }),
  z.object({ status: z.literal("parent_not_found") }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

/** 保存探索结果：一次请求带上全部候选与它们在舞台上的落点 */
export const saveCanvasSchema = z.object({
  title: titleSchema,
  parent_id: z.uuid().nullable().optional(),
  origin_node_id: z.uuid(),
  viewport: metadataSchema.optional(),
  items: z.array(z.object({
    node_id: z.uuid(),
    revision: z.number().int().positive().optional(),
    reason: z.string().max(500).optional(),
    confidence: z.number().min(0).max(1).optional(),
    excerpt: z.string().max(2000).optional(),
    matched_channels: z.array(z.string().max(40)).max(8).optional(),
    x: coordinateSchema.optional(),
    y: coordinateSchema.optional(),
  })).max(50),
}).strict();

/**
 * 往画布上放一张卡片。excerpt 来自某一篇笔记（必须指出是哪一篇），
 * native 是用户直接写在画布上的文字；两者都是「将来可以晋升成笔记」的东西。
 */
export const createCanvasCardSchema = z.object({
  kind: z.enum(["excerpt", "native"]),
  text: z.string().trim().min(1).max(20000),
  source_node_id: z.uuid().optional(),
  anchored_rev: z.number().int().positive().optional(),
  anchor: metadataSchema.optional(),
  x: coordinateSchema.optional(),
  y: coordinateSchema.optional(),
}).strict().refine(
  (input) => input.kind === "native" || input.source_node_id !== undefined,
  { error: "excerpt card requires source_node_id", path: ["source_node_id"] },
);

export const canvasLayoutSchema = z.object({
  viewport: metadataSchema.optional(),
  cards: z.array(z.object({
    id: z.uuid(),
    x: coordinateSchema,
    y: coordinateSchema,
  })).max(200).optional(),
}).strict();

export const promoteCanvasNodeSchema = z.object({
  parent_id: z.uuid().nullable().optional(),
  title: titleSchema.optional(),
}).strict();

export const canvasNodeIdParamSchema = z.object({ nodeId: z.uuid() });
export const canvasCardIdParamSchema = z.object({ cardId: z.uuid() });

export type CanvasCardRow = z.infer<typeof canvasCardRowSchema>;
export type CreateCanvasCardInput = z.infer<typeof createCanvasCardSchema>;
export type SaveCanvasInput = z.infer<typeof saveCanvasSchema>;
export type CanvasLayoutInput = z.infer<typeof canvasLayoutSchema>;
export type PromoteCanvasNodeInput = z.infer<typeof promoteCanvasNodeSchema>;
export type SaveCanvasRpcResult = z.infer<typeof saveCanvasRpcResultSchema>;
export type ReadCanvasRpcResult = z.infer<typeof readCanvasRpcResultSchema>;
export type CanvasLayoutRpcResult = z.infer<typeof canvasLayoutRpcResultSchema>;
export type PromoteCanvasNodeRpcResult = z.infer<
  typeof promoteCanvasNodeRpcResultSchema
>;
