/**
 * [INPUT]: 依赖 zod 的 UUID、strict object、联合与 infer 能力
 * [OUTPUT]: 对外提供 memo/PostgREST 正文与摘要行、关键词查询、关键词/相似检索 RPC 结果、回收站 RPC 结果、接口 body/param schema 及 infer 类型
 * [POS]: dto 层备忘录 HTTP/PostgREST 数据边界，分别校验轻量 tree、单篇正文、搜索与删除批次响应
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

const metadataSchema = z.record(z.string(), z.unknown());
const titleSchema = z.string().trim().min(1).max(500);
const sortOrderSchema = z.number().finite();

export const memoNodeRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  parent_id: z.uuid().nullable(),
  node_type: z.enum(["folder", "memo", "canvas"]),
  title: z.string(),
  sort_order: z.number(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  metadata: metadataSchema,
  revision: z.number().int().positive(),
  deleted_at: z.string().nullable(),
  deleted_root_id: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const memoContentRowSchema = z.object({
  node_id: z.uuid(),
  user_id: z.uuid(),
  content_mdx: z.string(),
  excerpt: z.string().nullable(),
  word_count: z.number().int().nonnegative(),
  metadata: metadataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const memoContentSummaryRowSchema = memoContentRowSchema.omit({
  content_mdx: true,
});

export const memoNodeRowsSchema = z.array(memoNodeRowSchema);
export const memoContentRowsSchema = z.array(memoContentRowSchema);
export const memoContentSummaryRowsSchema = z.array(
  memoContentSummaryRowSchema,
);
export const memoSortOrderRowsSchema = z.array(
  z.object({ sort_order: z.number() }),
);
export const memoTrashExcerptRowsSchema = z.array(
  z.object({
    node_id: z.uuid(),
    user_id: z.uuid(),
    excerpt: z.string().nullable(),
  }),
);

const rpcNotFoundSchema = z.object({ status: z.literal("not_found") });
const rpcNotRootSchema = z.object({ status: z.literal("not_root") });
const rpcBlockedSchema = z.object({
  status: z.literal("blocked_by_deleted_ancestor"),
});

export const softDeleteMemoRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("deleted"),
    node: memoNodeRowSchema,
  }),
  z.object({ status: z.literal("already_deleted") }),
  rpcNotFoundSchema,
]);

export const restoreMemoRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("restored"),
    nodes: memoNodeRowsSchema,
    contents: memoContentRowsSchema,
  }),
  z.object({ status: z.literal("already_active") }),
  rpcNotFoundSchema,
  rpcNotRootSchema,
  rpcBlockedSchema,
]);

export const permanentlyDeleteMemoRpcResultSchema = z.discriminatedUnion(
  "status",
  [
    z.object({
      status: z.literal("deleted"),
      deleted_count: z.number().int().nonnegative(),
    }),
    z.object({ status: z.literal("active_node") }),
    rpcNotFoundSchema,
    rpcNotRootSchema,
    rpcBlockedSchema,
  ],
);

export const emptyMemoTrashRpcResultSchema = z.object({
  status: z.literal("emptied"),
  deleted_count: z.number().int().nonnegative(),
});

const memoSearchHitSchema = z.object({
  node_id: z.uuid(),
  excerpt: z.string().nullable(),
});

const rpcInvalidSchema = z.object({
  status: z.literal("invalid"),
  error_code: z.string(),
});

export const memoSearchKeywordRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    hits: z.array(memoSearchHitSchema),
  }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

const memoRelatedHitSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  excerpt: z.string().nullable(),
  revision: z.number().int().positive(),
  matched_channels: z.array(z.string()),
  rank: z.number().int().positive(),
});

export const memoSearchRelatedRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    hits: z.array(memoRelatedHitSchema),
  }),
  rpcInvalidSchema,
  rpcNotFoundSchema,
]);

export type MemoRelatedSearchInput = z.infer<typeof memoRelatedSearchSchema>;
export type MemoSearchKeywordRpcResult = z.infer<
  typeof memoSearchKeywordRpcResultSchema
>;
export type MemoSearchRelatedRpcResult = z.infer<
  typeof memoSearchRelatedRpcResultSchema
>;

export const memoNodeIdParamSchema = z.object({
  nodeId: z.uuid(),
});

export const memoSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().min(1).max(200),
});

export const memoRelatedSearchSchema = z
  .object({
    query_text: z.string().trim().min(1).max(2000),
    source_node_id: z.uuid().nullable().optional(),
    exclude_node_ids: z.array(z.uuid()).max(50).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const createMemoFolderSchema = z
  .object({
    title: titleSchema,
    parent_id: z.uuid().nullable().optional(),
  })
  .strict();

export const createMemoSchema = z
  .object({
    title: titleSchema,
    parent_id: z.uuid().nullable().optional(),
    content_mdx: z.string().optional(),
    sort_order: sortOrderSchema.optional(),
  })
  .strict();

export const patchMemoSchema = z
  .object({
    content_mdx: z.string().optional(),
    title: titleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one memo field is required",
  });

export const renameMemoNodeSchema = z
  .object({
    title: titleSchema,
  })
  .strict();

export const moveMemoNodeSchema = z
  .object({
    parent_id: z.uuid().nullable().optional(),
    sort_order: sortOrderSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one move field is required",
  });

export type CreateMemoFolderInput = z.infer<
  typeof createMemoFolderSchema
>;
export type CreateMemoInput = z.infer<typeof createMemoSchema>;
export type PatchMemoInput = z.infer<typeof patchMemoSchema>;
export type RenameMemoNodeInput = z.infer<
  typeof renameMemoNodeSchema
>;
export type MoveMemoNodeInput = z.infer<typeof moveMemoNodeSchema>;
export type MemoSearchQuery = z.infer<typeof memoSearchQuerySchema>;
export type SoftDeleteMemoRpcResult = z.infer<
  typeof softDeleteMemoRpcResultSchema
>;
export type RestoreMemoRpcResult = z.infer<
  typeof restoreMemoRpcResultSchema
>;
export type PermanentlyDeleteMemoRpcResult = z.infer<
  typeof permanentlyDeleteMemoRpcResultSchema
>;
export type EmptyMemoTrashRpcResult = z.infer<
  typeof emptyMemoTrashRpcResultSchema
>;
