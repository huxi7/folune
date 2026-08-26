/**
 * [INPUT]: 依赖 config/env 的 BUSINESS_API_BASE_URL、调用方当前 Bearer JWT、Web fetch 与 zod
 * [OUTPUT]: 对外提供 thread/消息/冻结 context、轻量 tree、单篇正文、Canvas expansion 可信上下文、账号权限、命令与 Run 的 authenticated Business API client
 * [POS]: lib 层 chat→api 唯一业务边界，每次请求临时转发用户 JWT，统一解析信封且绝不记录或持久化凭据；canvas 可穿过资源校验，再由各模型投影显式过滤
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { UIMessage } from "ai";
import { z } from "zod";

import { env } from "@/config/env";
import {
  organizePlanSchema,
  type OrganizePlan,
} from "@/lib/organize-contracts";

const apiEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z.unknown(),
});

const resolvedMemoSchema = z.object({
  memo_id: z.uuid(),
  title: z.string(),
  content_mdx: z.string(),
  path: z.string(),
  revision: z.number().int().positive(),
  updated_at: z.string(),
  truncated: z.boolean(),
});

export const resolvedContextSchema = z.object({
  primary: resolvedMemoSchema.nullable(),
  references: z.array(resolvedMemoSchema),
  missing_reference_ids: z.array(z.uuid()),
});

const threadSchema = z.object({
  id: z.uuid(),
  title: z.string(),
}).passthrough();

export const aiPermissionModeSchema = z.enum([
  "ask",
  "auto_approve",
  "full_access",
]);

const aiSettingsSchema = z.object({
  user_id: z.uuid(),
  permission_mode: aiPermissionModeSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const aiCommandSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid().nullable(),
  tool_call_id: z.string().nullable(),
  operation: z.enum([
    "create_node",
    "rename_node",
    "move_node",
    "reorder_node",
    "trash_node",
    "edit_memo",
  ]),
  target_node_id: z.uuid().nullable(),
  expected_revision: z.number().int().positive().nullable(),
  idempotency_key: z.string(),
  input: z.record(z.string(), z.unknown()),
  before_state: z.record(z.string(), z.unknown()).nullable(),
  after_state: z.record(z.string(), z.unknown()).nullable(),
  undo_result: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum([
    "pending_approval",
    "approved",
    "executing",
    "succeeded",
    "rejected",
    "failed",
    "stale",
    "undone",
  ]),
  approval_source: z.enum(["manual", "approval_agent", "full_access"]).nullable(),
  risk: z.enum(["low", "medium", "high"]).nullable(),
  approval_reason: z.string().nullable(),
  error_code: z.string().nullable(),
  applied_at: z.string().nullable(),
  undone_at: z.string().nullable(),
}).passthrough();

export const aiRunSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid().nullable(),
  memo_id: z.uuid(),
  source_revision: z.number().int().positive(),
  status: z.enum([
    "planning",
    "awaiting_confirmation",
    "applying",
    "succeeded",
    "rejected",
    "failed",
    "stale",
    "undone",
  ]),
  idempotency_key: z.string(),
  plan: organizePlanSchema.nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error_code: z.string().nullable(),
}).passthrough();

const memoNodeSchema: z.ZodType<MemoTreeNode> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    parent_id: z.uuid().nullable(),
    node_type: z.enum(["canvas", "folder", "memo"]),
    title: z.string(),
    sort_order: z.number(),
    revision: z.number().int().positive(),
    deleted_at: z.string().nullable(),
    updated_at: z.string(),
    children: z.array(memoNodeSchema),
    memo: z.object({
      excerpt: z.string().nullable(),
      word_count: z.number().int().nonnegative(),
      updated_at: z.string(),
    }).passthrough().nullable(),
  }).passthrough(),
);

export const memoTreeSchema = z.array(memoNodeSchema);
const memoDetailSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  node_type: z.literal("memo"),
  title: z.string(),
  sort_order: z.number(),
  revision: z.number().int().positive(),
  deleted_at: z.string().nullable(),
  updated_at: z.string(),
  children: z.array(z.never()).max(0),
  memo: z.object({
    content_mdx: z.string(),
    updated_at: z.string(),
  }).passthrough(),
}).passthrough();

export const canvasExpansionContextSchema = z.object({
  canvas_version: z.number().int().nonnegative(),
  corpus_version: z.number().int().nonnegative(),
  source: z.object({
    canvas_node_id: z.uuid(),
    memo_id: z.uuid(),
    title: z.string(),
    excerpt: z.string().nullable(),
    revision: z.number().int().positive(),
  }),
  checkpoint: z.object({
    source_revision: z.number().int().positive(),
    corpus_version: z.number().int().nonnegative(),
    request_id: z.uuid(),
    completion_status: z.enum(["complete", "incomplete_due_to_capacity"]),
    completed_at: z.string(),
  }).nullable(),
  neighbor_memo_ids: z.array(z.uuid()),
});

export type ResolvedContext = z.infer<typeof resolvedContextSchema>;
export type AiPermissionMode = z.infer<typeof aiPermissionModeSchema>;
export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type AiCommand = z.infer<typeof aiCommandSchema>;
export type AiRun = z.infer<typeof aiRunSchema>;
export type CanvasExpansionContext = z.infer<typeof canvasExpansionContextSchema>;
export type MemoTreeNode = {
  id: string;
  parent_id: string | null;
  node_type: "canvas" | "folder" | "memo";
  title: string;
  sort_order: number;
  revision: number;
  deleted_at: string | null;
  updated_at: string;
  children: MemoTreeNode[];
  memo: ({ excerpt: string | null; word_count: number; updated_at: string } & Record<string, unknown>) | null;
} & Record<string, unknown>;

export class BusinessApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BusinessApiError";
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(
  path: string,
  accessToken: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${env.BUSINESS_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new BusinessApiError(
      502,
      "BUSINESS_API_UNAVAILABLE",
      "Business API is unavailable",
    );
  }

  const payload = apiEnvelopeSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!payload.success) {
    throw new BusinessApiError(
      502,
      "BUSINESS_API_INVALID_RESPONSE",
      "Business API returned an invalid response",
    );
  }
  if (!response.ok || payload.data.code !== "ok") {
    throw new BusinessApiError(response.status, payload.data.code, payload.data.message);
  }
  const parsed = schema.safeParse(payload.data.data);
  if (!parsed.success) {
    throw new BusinessApiError(
      502,
      "BUSINESS_API_INVALID_RESPONSE",
      "Business API returned invalid resource data",
    );
  }
  return parsed.data;
};

const relatedHitSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  excerpt: z.string().nullable(),
  revision: z.number().int().positive(),
  matched_channels: z.array(z.string()),
  rank: z.number().int().positive(),
}).passthrough();

const relatedHitsSchema = z.array(relatedHitSchema);

export type RelatedHit = z.infer<typeof relatedHitSchema>;

const syncMessageSchema = z.array(z.object({ id: z.string() }).passthrough());

export const businessApi = {
  getThread(threadId: string, accessToken: string) {
    return request(`/ai-threads/${threadId}`, accessToken, threadSchema);
  },

  syncMessages(
    threadId: string,
    messages: readonly UIMessage[],
    accessToken: string,
  ) {
    return request(
      `/ai-threads/${threadId}/messages`,
      accessToken,
      syncMessageSchema,
      { method: "PUT", body: JSON.stringify(messages) },
    );
  },

  resolveContext(
    threadId: string,
    activeMemoId: string | null,
    referenceMemoIds: readonly string[],
    expectedRevisions: Readonly<Record<string, number>>,
    accessToken: string,
  ) {
    return request("/ai-context/resolve", accessToken, resolvedContextSchema, {
      method: "POST",
      body: JSON.stringify({
        thread_id: threadId,
        active_memo_id: activeMemoId,
        reference_memo_ids: referenceMemoIds,
        expected_revisions: expectedRevisions,
        include_thread_references: false,
      }),
    });
  },

  getSettings(accessToken: string) {
    return request("/ai-settings", accessToken, aiSettingsSchema);
  },

  getMemoTree(accessToken: string) {
    return request("/memo-tree", accessToken, memoTreeSchema);
  },

  getMemo(nodeId: string, accessToken: string) {
    return request(`/memos/${encodeURIComponent(nodeId)}`, accessToken, memoDetailSchema);
  },

  getCanvasExpansionContext(
    canvasId: string,
    sourceCanvasNodeId: string,
    accessToken: string,
  ) {
    return request(
      `/canvases/${encodeURIComponent(canvasId)}/nodes/${encodeURIComponent(sourceCanvasNodeId)}/expansion-context`,
      accessToken,
      canvasExpansionContextSchema,
    );
  },

  createCommand(
    input: Readonly<Record<string, unknown>>,
    accessToken: string,
  ) {
    return request("/ai-commands", accessToken, aiCommandSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** 混合召回。查询文字走 body 而非 query string——它可能是一整段选中文字，且日志契约禁止记录 query string */
  searchRelatedMemos(
    input: {
      query_text: string;
      source_node_id: string | null;
      limit: number;
      exclude_node_ids: string[];
    },
    accessToken: string,
  ) {
    return request("/memo-search/related", accessToken, relatedHitsSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createRun(
    input: { memo_id: string; thread_id: string | null; idempotency_key: string },
    accessToken: string,
  ) {
    return request("/ai-runs", accessToken, aiRunSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  recordRunPlan(
    runId: string,
    plan: OrganizePlan,
    requiresConfirmation: boolean,
    accessToken: string,
  ) {
    return request(`/ai-runs/${runId}/plan`, accessToken, aiRunSchema, {
      method: "PATCH",
      body: JSON.stringify({
        plan,
        requires_confirmation: requiresConfirmation,
      }),
    });
  },

  applyRun(runId: string, accessToken: string) {
    return request(`/ai-runs/${runId}/apply`, accessToken, aiRunSchema, {
      method: "POST",
    });
  },

  failRun(runId: string, errorCode: string, accessToken: string) {
    return request(`/ai-runs/${runId}/fail`, accessToken, aiRunSchema, {
      method: "POST",
      body: JSON.stringify({ error_code: errorCode }),
    });
  },
};
