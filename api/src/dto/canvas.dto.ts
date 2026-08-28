/**
 * [INPUT]: 依赖 zod 的 UUID/strict object/判别联合能力与 memo.dto 的 memoNodeRowSchema
 * [OUTPUT]: 对外提供 Canvas V2 创建、读取、含自由文字持久缩放的统一 mutation、AI expansion、可信 context 与整树画布身份行的 HTTP/RPC schemas
 * [POS]: dto 层 Canvas V2 唯一协议边界；只承认 protocol_version=2、node_id 单一身份、有限几何与最多 100 个原子操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { memoNodeRowSchema } from "./memo.dto.ts";

const metadataSchema = z.record(z.string(), z.unknown());
const coordinateSchema = z.number().finite();
const titleSchema = z.string().trim().min(1).max(500);
const rationaleSchema = z.string().max(120).nullable().optional();
const nativeTextSchema = z.string().min(1).max(5000);
const widthSchema = z.number().finite().min(20).max(2880);
const heightSchema = z.number().finite().min(24).max(3840);
const textScaleSchema = z.number().finite().min(0.25).max(8);
const rpcNotFoundSchema = z.object({ status: z.literal("not_found") });
const rpcInvalidSchema = z.object({
  status: z.literal("invalid"),
  error_code: z.string().optional(),
});

const canvasTargetSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  revision: z.coerce.number().int().positive(),
  deleted_at: z.string().nullable(),
  excerpt: z.string().nullable(),
});

export const canvasEdgeSchema = z.object({
  id: z.uuid(),
  source_id: z.uuid(),
  target_id: z.uuid(),
  rationale: z.string().nullable(),
  created_by: z.enum(["user", "ai"]),
});

export const canvasV2RowSchema = z.object({
  node_id: z.uuid(),
  user_id: z.uuid(),
  origin_node_id: z.uuid().nullable(),
  origin_revision: z.coerce.number().int().positive().nullable(),
  viewport: metadataSchema,
  metadata: metadataSchema,
  canvas_kind: z.enum(["memo_default", "standalone"]),
  version: z.coerce.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const canvasNodeV2Schema = z.object({
  id: z.uuid(),
  kind: z.enum(["memo_ref", "native"]),
  target_node_id: z.uuid().nullable(),
  snapshot_title: z.string().nullable(),
  snapshot_excerpt: z.string().nullable(),
  snapshot_revision: z.coerce.number().int().positive().nullable(),
  discovered_from_id: z.uuid().nullable(),
  text: z.string().nullable(),
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
  width: z.coerce.number().finite().nullable(),
  height: z.coerce.number().finite().nullable(),
  text_scale: z.coerce.number().finite().min(0.25).max(8).nullable(),
  created_by: z.enum(["user", "ai"]),
  target: canvasTargetSchema.nullable(),
});

/** 整树读取只需要画布身份三个字段，不碰图内容 */
export const canvasIdentityRowSchema = z.object({
  canvas_kind: z.enum(["memo_default", "standalone"]),
  node_id: z.uuid(),
  origin_node_id: z.uuid().nullable(),
});
export const canvasIdentityRowsSchema = z.array(canvasIdentityRowSchema);
export type CanvasIdentityRow = z.infer<typeof canvasIdentityRowSchema>;

export const canvasEntryRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.enum(["created", "existing"]),
    canvas: canvasV2RowSchema,
    node: memoNodeRowSchema,
    focus_node_id: z.uuid().nullable(),
  }),
  z.object({ status: z.literal("memo_not_found") }),
  z.object({ status: z.literal("parent_not_found") }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

export const readCanvasV2RpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    canvas: canvasV2RowSchema,
    node: memoNodeRowSchema,
    nodes: z.array(canvasNodeV2Schema),
    edges: z.array(canvasEdgeSchema),
  }),
  rpcNotFoundSchema,
]);

const viewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().min(0.2).max(2),
  user_moved: z.boolean().optional(),
}).strict();

export const canvasOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_memo"),
    node_id: z.uuid(),
    target_node_id: z.uuid(),
    discovered_from_id: z.uuid().optional(),
    source_node_id: z.uuid().optional(),
    edge_id: z.uuid().optional(),
    rationale: rationaleSchema,
    x: coordinateSchema,
    y: coordinateSchema,
  }).strict(),
  z.object({
    type: z.literal("create_text"),
    node_id: z.uuid(),
    text: nativeTextSchema,
    x: coordinateSchema,
    y: coordinateSchema,
    width: widthSchema.optional(),
    height: heightSchema.optional(),
    text_scale: textScaleSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal("update_node"),
    node_id: z.uuid(),
    x: coordinateSchema.optional(),
    y: coordinateSchema.optional(),
    text: nativeTextSchema.optional(),
    width: widthSchema.optional(),
    height: heightSchema.optional(),
    text_scale: textScaleSchema.optional(),
  }).strict().refine(
    (value) => ["x", "y", "text", "width", "height", "text_scale"]
      .some((key) => key in value),
    { message: "update_node requires at least one field" },
  ),
  z.object({ type: z.literal("remove_node"), node_id: z.uuid() }).strict(),
  z.object({
    type: z.literal("upsert_edge"),
    edge_id: z.uuid(),
    source_id: z.uuid(),
    target_id: z.uuid(),
    rationale: rationaleSchema,
  }).strict(),
  z.object({ type: z.literal("remove_edge"), edge_id: z.uuid() }).strict(),
  z.object({ type: z.literal("set_viewport"), viewport: viewportSchema }).strict(),
]);

export const createCanvasV2Schema = z.object({
  protocol_version: z.literal(2),
  title: titleSchema.default("未命名画布"),
  parent_id: z.uuid().nullable().optional(),
}).strict();

export const canvasMutationSchema = z.object({
  protocol_version: z.literal(2),
  mutation_id: z.uuid(),
  base_version: z.number().int().nonnegative(),
  operations: z.array(canvasOperationSchema).max(100),
}).strict();

export const canvasExpansionMutationSchema = canvasMutationSchema.extend({
  source_canvas_node_id: z.uuid(),
  source_revision: z.number().int().positive(),
  corpus_version: z.number().int().nonnegative(),
  request_id: z.uuid(),
  completion_status: z.enum(["complete", "incomplete_due_to_capacity"]),
  candidate_revisions: z.array(z.object({
    memo_id: z.uuid(),
    revision: z.number().int().positive(),
  }).strict()).max(5),
}).strict();

const mutationNoticeSchema = z.object({
  index: z.coerce.number().int().nonnegative(),
  type: z.string(),
  reason: z.string(),
  node_id: z.uuid().optional(),
  edge_id: z.uuid().optional(),
});

export const canvasMutationRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("applied"),
    mutation_id: z.uuid(),
    intent_digest: z.string().regex(/^[0-9a-f]{64}$/),
    version: z.coerce.number().int().nonnegative(),
    upserted_nodes: z.array(z.record(z.string(), z.unknown())),
    removed_node_ids: z.array(z.uuid()),
    upserted_edges: z.array(z.record(z.string(), z.unknown())),
    removed_edge_ids: z.array(z.uuid()),
    aliases: z.array(z.object({ client_id: z.uuid(), node_id: z.uuid() })),
    noops: z.array(mutationNoticeSchema),
    dropped: z.array(mutationNoticeSchema),
    expansion_status: z.enum(["complete", "incomplete_due_to_capacity"]).nullable(),
  }),
  z.object({
    status: z.literal("version_conflict"),
    mutation_id: z.uuid(),
    version: z.coerce.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal("mutation_id_reused"),
    mutation_id: z.uuid(),
    version: z.coerce.number().int().nonnegative(),
  }),
  z.object({ status: z.literal("source_revision_conflict") }),
  z.object({ status: z.literal("candidate_revision_conflict"), memo_id: z.uuid() }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

export const canvasExpansionContextRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    canvas_version: z.coerce.number().int().nonnegative(),
    corpus_version: z.coerce.number().int().nonnegative(),
    source: z.object({
      canvas_node_id: z.uuid(),
      memo_id: z.uuid(),
      title: z.string(),
      excerpt: z.string().nullable(),
      revision: z.coerce.number().int().positive(),
    }),
    checkpoint: z.object({
      source_revision: z.coerce.number().int().positive(),
      corpus_version: z.coerce.number().int().nonnegative(),
      request_id: z.uuid(),
      completion_status: z.enum(["complete", "incomplete_due_to_capacity"]),
      completed_at: z.string(),
    }).passthrough().nullable(),
    neighbor_memo_ids: z.array(z.uuid()),
  }),
  z.object({ status: z.literal("invalid_source") }),
  rpcNotFoundSchema,
]);

export const canvasNodeIdParamSchema = z.object({ nodeId: z.uuid() });
export const canvasV2NodeParamSchema = z.object({
  nodeId: z.uuid(),
  canvasId: z.uuid(),
});

export type CreateCanvasV2Input = z.infer<typeof createCanvasV2Schema>;
export type CanvasOperation = z.infer<typeof canvasOperationSchema>;
export type CanvasMutationInput = z.infer<typeof canvasMutationSchema>;
export type CanvasExpansionMutationInput = z.infer<typeof canvasExpansionMutationSchema>;
export type CanvasEntryRpcResult = z.infer<typeof canvasEntryRpcResultSchema>;
export type ReadCanvasV2RpcResult = z.infer<typeof readCanvasV2RpcResultSchema>;
export type CanvasMutationRpcResult = z.infer<typeof canvasMutationRpcResultSchema>;
export type CanvasExpansionContextRpcResult = z.infer<typeof canvasExpansionContextRpcResultSchema>;
