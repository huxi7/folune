/**
 * [INPUT]: 依赖 zod 的 strict object、JSON、UUID、联合与 infer 能力
 * [OUTPUT]: 对外提供 AI threads/messages/refs/context/runs/settings/commands HTTP 与 PostgREST/RPC schema；聊天准备支持增量消息与稳定 assistant 续写
 * [POS]: dto 层 AI Native V2 数据边界，原样接纳 UIMessage.parts，同时严格限制冻结上下文、权限模式、命令种类、revision 与整理方案结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import { memoNodeRowSchema } from "./memo.dto.ts";

const titleSchema = z.string().trim().min(1).max(500);
const idempotencyKeySchema = z.string().trim().min(1).max(200);
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const aiThreadRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  last_message_at: z.string(),
});

export const aiThreadRowsSchema = z.array(aiThreadRowSchema);

export const aiMessageContextMemoSnapshotSchema = z.object({
  memo_id: z.uuid(),
  title: z.string(),
  revision: z.number().int().positive(),
});

export const aiMessageContextSnapshotSchema = z.object({
  primary: aiMessageContextMemoSnapshotSchema.nullable(),
  references: z.array(aiMessageContextMemoSnapshotSchema).max(5),
});

export const aiMessageRowSchema = z.object({
  id: z.string().min(1).max(200),
  thread_id: z.uuid(),
  user_id: z.uuid(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.unknown()),
  position: z.number().int().nonnegative(),
  status: z.enum(["in_progress", "complete", "aborted", "error"]),
  context_snapshot: aiMessageContextSnapshotSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const aiMessageRowsSchema = z.array(aiMessageRowSchema);

export const aiThreadReferenceRowSchema = z.object({
  thread_id: z.uuid(),
  user_id: z.uuid(),
  memo_id: z.uuid(),
  created_at: z.string(),
});

export const aiThreadReferenceRowsSchema = z.array(
  aiThreadReferenceRowSchema,
);

export const replaceAiThreadReferencesRpcSchema = z.object({
  status: z.enum([
    "replaced",
    "not_found",
    "too_many_references",
    "invalid_reference",
  ]),
  references: aiThreadReferenceRowsSchema.optional(),
});

export const createAiThreadSchema = z
  .object({ title: titleSchema.optional() })
  .strict();

export const patchAiThreadSchema = z
  .object({
    title: titleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one AI thread field is required",
  });

export const aiThreadIdParamSchema = z.object({ threadId: z.uuid() });
export const aiMessageIdParamSchema = z.object({
  threadId: z.uuid(),
  messageId: z.string().trim().min(1).max(200),
});
export const aiRunIdParamSchema = z.object({ runId: z.uuid() });

export const syncAiMessageSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.unknown()),
    status: z
      .enum(["in_progress", "complete", "aborted", "error"])
      .optional(),
    context_snapshot: aiMessageContextSnapshotSchema.nullable().optional(),
  })
  .passthrough();

export const syncAiMessagesSchema = z.array(syncAiMessageSchema).max(500);

/**
 * Chat 首次生成可携带完整历史，工具/审批续写只携带最后一条 assistant。
 * 服务端据此从已持久化会话重建模型输入，避免浏览器每轮重复上传整段对话。
 */
export const prepareAiChatSchema = z
  .object({
    thread_id: z.uuid(),
    active_memo_id: z.uuid().nullable(),
    reference_memo_ids: z.array(z.uuid()).max(5).default([]),
    expected_revisions: z.record(z.uuid(), z.number().int().positive()).default({}),
    include_thread_references: z.boolean().default(false),
    messages: z.array(syncAiMessageSchema).max(500).optional(),
    message: syncAiMessageSchema.optional(),
    response_message_id: z.string().trim().min(1).max(200),
  })
  .strict()
  .refine(
    (value) => (value.messages === undefined) !== (value.message === undefined),
    { message: "Exactly one of messages or message is required" },
  )
  .refine(
    (value) => value.messages === undefined || value.messages.length > 0,
    { message: "messages must not be empty" },
  );

export const replaceAiThreadReferencesSchema = z
  .object({ memo_ids: z.array(z.uuid()).max(5) })
  .strict();

export const resolveAiContextSchema = z
  .object({
    thread_id: z.uuid(),
    active_memo_id: z.uuid().nullable(),
    reference_memo_ids: z.array(z.uuid()).max(5).optional().default([]),
    expected_revisions: z.record(z.uuid(), z.number().int().positive())
      .optional()
      .default({}),
    include_thread_references: z.boolean().optional().default(true),
  })
  .strict();

export const aiPermissionModeSchema = z.enum([
  "ask",
  "auto_approve",
  "full_access",
]);

export const aiUserSettingsRowSchema = z.object({
  user_id: z.uuid(),
  permission_mode: aiPermissionModeSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const aiUserSettingsRowsSchema = z.array(aiUserSettingsRowSchema);

export const aiUsageDailyRowSchema = z.object({
  user_id: z.uuid(),
  usage_date: z.string(),
  total_tokens: z.coerce.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const aiUsageDailyRowsSchema = z.array(aiUsageDailyRowSchema);

// increment_ai_usage_daily 返回该用户当日累计值；PostgREST 对 bigint 可能回字符串，故 coerce。
export const incrementAiUsageResultSchema = z.coerce.number().int().nonnegative();

export const recordAiUsageSchema = z
  .object({ total_tokens: z.number().int().nonnegative().max(100_000_000) })
  .strict();

export const patchAiUserSettingsSchema = z
  .object({ permission_mode: aiPermissionModeSchema })
  .strict();

export const aiCommandOperationSchema = z.enum([
  "create_node",
  "rename_node",
  "move_node",
  "reorder_node",
  "trash_node",
  "edit_memo",
]);

export const aiCommandStatusSchema = z.enum([
  "pending_approval",
  "approved",
  "executing",
  "succeeded",
  "rejected",
  "failed",
  "stale",
  "undone",
]);

export const aiApprovalSourceSchema = z.enum([
  "manual",
  "approval_agent",
  "full_access",
]);

export const aiRiskSchema = z.enum(["low", "medium", "high"]);

export const aiCommandRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  thread_id: z.uuid().nullable(),
  tool_call_id: z.string().nullable(),
  operation: aiCommandOperationSchema,
  target_node_id: z.uuid().nullable(),
  expected_revision: z.number().int().positive().nullable(),
  idempotency_key: z.string(),
  input: jsonRecordSchema,
  before_state: jsonRecordSchema.nullable(),
  after_state: jsonRecordSchema.nullable(),
  undo_result: jsonRecordSchema.nullable(),
  status: aiCommandStatusSchema,
  approval_source: aiApprovalSourceSchema.nullable(),
  risk: aiRiskSchema.nullable(),
  approval_reason: z.string().nullable(),
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  applied_at: z.string().nullable(),
  undone_at: z.string().nullable(),
});

export const aiCommandRowsSchema = z.array(aiCommandRowSchema);

const commandBaseSchema = z.object({
  thread_id: z.uuid().nullable().optional(),
  tool_call_id: z.string().trim().min(1).max(200).nullable().optional(),
  idempotency_key: idempotencyKeySchema,
  approval_source: aiApprovalSourceSchema.nullable().optional(),
  risk: aiRiskSchema.nullable().optional(),
  approval_reason: z.string().trim().max(2000).nullable().optional(),
});

export const createAiCommandSchema = z.discriminatedUnion("operation", [
  commandBaseSchema.extend({
    operation: z.literal("create_node"),
    target_node_id: z.null().optional(),
    expected_revision: z.null().optional(),
    input: z.object({
      node_type: z.enum(["folder", "memo"]),
      title: titleSchema,
      parent_id: z.uuid().nullable(),
      content_mdx: z.string().optional(),
    }).strict(),
  }).strict(),
  commandBaseSchema.extend({
    operation: z.literal("rename_node"),
    target_node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    input: z.object({ title: titleSchema }).strict(),
  }).strict(),
  commandBaseSchema.extend({
    operation: z.literal("move_node"),
    target_node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    input: z.object({ parent_id: z.uuid().nullable() }).strict(),
  }).strict(),
  commandBaseSchema.extend({
    operation: z.literal("reorder_node"),
    target_node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    input: z.object({
      reference_node_id: z.uuid(),
      placement: z.enum(["before", "after"]),
    }).strict(),
  }).strict(),
  commandBaseSchema.extend({
    operation: z.literal("trash_node"),
    target_node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    input: z.object({}).strict(),
  }).strict(),
  commandBaseSchema.extend({
    operation: z.literal("edit_memo"),
    target_node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    input: z.object({ content_mdx: z.string() }).strict(),
  }).strict(),
]);

export const aiCommandIdParamSchema = z.object({ commandId: z.uuid() });

export const aiCommandRpcResultSchema = z.object({
  status: z.string(),
  command: aiCommandRowSchema.optional(),
});

export const organizeDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keep_current") }).strict(),
  z
    .object({
      kind: z.literal("existing_folder"),
      folder_id: z.uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("new_folder"),
      parent_id: z.uuid().nullable(),
      folder_title: titleSchema,
    })
    .strict(),
]);

export const organizePlanSchema = z
  .object({
    suggested_title: titleSchema,
    destination: organizeDestinationSchema,
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export const aiRunStatusSchema = z.enum([
  "planning",
  "awaiting_confirmation",
  "applying",
  "succeeded",
  "rejected",
  "failed",
  "stale",
  "undone",
]);

const memoTreeResultNodeSchema = memoNodeRowSchema.extend({
  children: z.array(z.unknown()).optional().default([]),
  memo: z.unknown().nullable().optional().default(null),
});

export const aiRunResultSchema = z
  .object({
    result_revision: z.number().int().positive(),
    memo: memoTreeResultNodeSchema,
    created_folder: memoTreeResultNodeSchema.nullable(),
    target_path: z.string(),
    undo: z
      .object({
        memo: memoTreeResultNodeSchema,
        removed_folder_id: z.uuid().nullable(),
        folder_retained: z.boolean(),
      })
      .optional(),
  })
  .passthrough();

export const aiRunRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  thread_id: z.uuid().nullable(),
  run_type: z.literal("organize_memo"),
  memo_id: z.uuid(),
  source_revision: z.number().int().positive(),
  status: aiRunStatusSchema,
  idempotency_key: z.string(),
  plan: organizePlanSchema.nullable(),
  result: aiRunResultSchema.nullable(),
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  applied_at: z.string().nullable(),
  undone_at: z.string().nullable(),
});

export const aiRunRowsSchema = z.array(aiRunRowSchema);

export const createAiRunSchema = z
  .object({
    memo_id: z.uuid(),
    thread_id: z.uuid().nullable().optional(),
    idempotency_key: idempotencyKeySchema,
  })
  .strict();

export const recordAiRunPlanSchema = z
  .object({
    plan: organizePlanSchema,
    requires_confirmation: z.boolean(),
  })
  .strict();

export const failAiRunSchema = z
  .object({ error_code: z.string().trim().min(1).max(100) })
  .strict();

const rpcStatusSchema = z.string();
export const aiRunRpcResultSchema = z.object({
  status: rpcStatusSchema,
  run: aiRunRowSchema.optional(),
  run_status: aiRunStatusSchema.optional(),
  error_code: z.string().optional(),
});

export const createAiActionRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  run_id: z.uuid(),
  sequence: z.number().int().positive(),
  action_type: z.enum(["rename", "move", "create_folder"]),
  target_node_id: z.uuid(),
  before_state: jsonRecordSchema,
  after_state: jsonRecordSchema,
  undone_at: z.string().nullable(),
});

export type CreateAiThreadInput = z.infer<typeof createAiThreadSchema>;
export type PatchAiThreadInput = z.infer<typeof patchAiThreadSchema>;
export type SyncAiMessageInput = z.infer<typeof syncAiMessageSchema>;
export type PrepareAiChatInput = z.infer<typeof prepareAiChatSchema>;
export type ReplaceAiThreadReferencesInput = z.infer<
  typeof replaceAiThreadReferencesSchema
>;
export type ResolveAiContextInput = z.infer<typeof resolveAiContextSchema>;
export type AiPermissionMode = z.infer<typeof aiPermissionModeSchema>;
export type PatchAiUserSettingsInput = z.infer<typeof patchAiUserSettingsSchema>;
export type CreateAiCommandInput = z.infer<typeof createAiCommandSchema>;
export type AiCommandRpcResult = z.infer<typeof aiCommandRpcResultSchema>;
export type OrganizePlanInput = z.infer<typeof organizePlanSchema>;
export type CreateAiRunInput = z.infer<typeof createAiRunSchema>;
export type RecordAiRunPlanInput = z.infer<typeof recordAiRunPlanSchema>;
export type FailAiRunInput = z.infer<typeof failAiRunSchema>;
export type AiRunRpcResult = z.infer<typeof aiRunRpcResultSchema>;
