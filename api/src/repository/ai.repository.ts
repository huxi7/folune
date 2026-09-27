/**
 * [INPUT]: 依赖唯一 supabase-rest 适配器、AI DTO 行/RPC 校验、请求期用户 JWT 与领域输入
 * [OUTPUT]: 对外提供 owner-scoped threads/messages/refs/settings/commands 与状态机 RPC；设置初始化只插入缺失行，显式修改才覆盖，消息支持全量与定点写入
 * [POS]: repository 层 AI Native V2 PostgREST 访问器，只表达持久化操作与返回校验，不判断会话标题、上下文优先级或模型审批风险
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  aiCommandRowsSchema,
  aiCommandRpcResultSchema,
  aiMessageRowsSchema,
  aiRunRowsSchema,
  aiRunRpcResultSchema,
  aiThreadReferenceRowsSchema,
  aiThreadRowsSchema,
  aiUsageDailyRowsSchema,
  aiUserSettingsRowsSchema,
  incrementAiUsageResultSchema,
  replaceAiThreadReferencesRpcSchema,
  type AiCommandRpcResult,
  type AiPermissionMode,
  type CreateAiCommandInput,
  type AiRunRpcResult,
  type OrganizePlanInput,
  type SyncAiMessageInput,
} from "../dto/ai.dto.ts";
import {
  createPostgrestQuery,
  supabaseRest,
} from "../lib/supabase-rest.ts";
import type {
  AiCommand,
  AiMessage,
  AiRun,
  AiThread,
  AiThreadReference,
  AiUsageDaily,
  AiUserSettings,
} from "../model/ai.model.ts";

const invalidStoragePayload = (resource: string): HttpError =>
  new HttpError(
    502,
    "SUPABASE_REST_ERROR",
    `Supabase REST returned invalid ${resource} data`,
  );

const parseThreads = (payload: unknown): AiThread[] => {
  const parsed = aiThreadRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI thread");
  return parsed.data;
};

const parseMessages = (payload: unknown): AiMessage[] => {
  const parsed = aiMessageRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI message");
  return parsed.data;
};

type AiMessageIdentity = { id: string; updated_at: string };

const parseMessageIdentity = (payload: unknown): AiMessageIdentity | null => {
  const row = Array.isArray(payload) ? payload[0] : undefined;
  if (row === undefined || row === null || typeof row !== "object") {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (typeof record["id"] !== "string" || typeof record["updated_at"] !== "string") {
    throw invalidStoragePayload("AI message identity");
  }
  return { id: record["id"], updated_at: record["updated_at"] };
};

const parseReferences = (payload: unknown): AiThreadReference[] => {
  const parsed = aiThreadReferenceRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI reference");
  return parsed.data;
};

const parseRuns = (payload: unknown): AiRun[] => {
  const parsed = aiRunRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI run");
  return parsed.data as AiRun[];
};

const parseSettings = (payload: unknown): AiUserSettings[] => {
  const parsed = aiUserSettingsRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI settings");
  return parsed.data;
};

const parseUsage = (payload: unknown): AiUsageDaily[] => {
  const parsed = aiUsageDailyRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI usage");
  return parsed.data;
};

const parseCommands = (payload: unknown): AiCommand[] => {
  const parsed = aiCommandRowsSchema.safeParse(payload ?? []);
  if (!parsed.success) throw invalidStoragePayload("AI command");
  return parsed.data;
};

const parseCommandRpc = (payload: unknown): AiCommandRpcResult => {
  const parsed = aiCommandRpcResultSchema.safeParse(payload);
  if (!parsed.success) throw invalidStoragePayload("AI command RPC");
  return parsed.data;
};

const parseRunRpc = (payload: unknown): AiRunRpcResult => {
  const parsed = aiRunRpcResultSchema.safeParse(payload);
  if (!parsed.success) throw invalidStoragePayload("AI run RPC");
  return parsed.data;
};

const threadQuery = (userId: string, threadId?: string): string =>
  createPostgrestQuery({
    select: "*",
    eq: {
      user_id: userId,
      ...(threadId === undefined ? {} : { id: threadId }),
    },
    limit: threadId === undefined ? undefined : 1,
  });

type PersistedMessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: SyncAiMessageInput["role"];
  parts: unknown[];
  position: number;
  status: NonNullable<SyncAiMessageInput["status"]>;
  context_snapshot: SyncAiMessageInput["context_snapshot"];
};

const upsertMessageRows = async (
  rows: readonly PersistedMessageRow[],
  accessToken: string,
  returnRepresentation: boolean,
): Promise<AiMessage[]> => {
  if (rows.length === 0) return [];
  const query = createPostgrestQuery({
    onConflict: ["thread_id", "id"],
  });
  const payload = await supabaseRest<unknown>(`ai_messages${query}`, {
    accessToken,
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
    ...(returnRepresentation ? { returnRepresentation: true } : {}),
  });
  return returnRepresentation ? parseMessages(payload) : [];
};

export const aiRepository = {
  async findSettings(
    userId: string,
    accessToken: string,
  ): Promise<AiUserSettings | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId },
      limit: 1,
    });
    return parseSettings(
      await supabaseRest<unknown>(`ai_user_settings${query}`, { accessToken }),
    )[0] ?? null;
  },

  async createSettingsIfMissing(
    userId: string,
    accessToken: string,
  ): Promise<AiUserSettings | null> {
    const query = createPostgrestQuery({ onConflict: ["user_id"] });
    const payload = await supabaseRest<unknown>(`ai_user_settings${query}`, {
      accessToken,
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ user_id: userId, permission_mode: "full_access" }),
      returnRepresentation: true,
    });
    return parseSettings(payload)[0] ?? null;
  },

  async upsertSettings(
    userId: string,
    permissionMode: AiPermissionMode,
    accessToken: string,
  ): Promise<AiUserSettings | null> {
    const query = createPostgrestQuery({ onConflict: ["user_id"] });
    const payload = await supabaseRest<unknown>(`ai_user_settings${query}`, {
      accessToken,
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        permission_mode: permissionMode,
      }),
      returnRepresentation: true,
    });
    return parseSettings(payload)[0] ?? null;
  },

  async findTodayUsage(
    userId: string,
    usageDate: string,
    accessToken: string,
  ): Promise<AiUsageDaily | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, usage_date: usageDate },
      limit: 1,
    });
    return parseUsage(
      await supabaseRest<unknown>(`ai_usage_daily${query}`, { accessToken }),
    )[0] ?? null;
  },

  // 只增不减的当日累加；RPC 内部开 GUC 写窗口，返回累加后的当日总量。
  async incrementUsage(
    userId: string,
    tokens: number,
    accessToken: string,
  ): Promise<number> {
    const parsed = incrementAiUsageResultSchema.safeParse(
      await supabaseRest<unknown>("rpc/increment_ai_usage_daily", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ p_user_id: userId, p_tokens: tokens }),
      }),
    );
    if (!parsed.success) throw invalidStoragePayload("AI usage RPC");
    return parsed.data;
  },

  async createThread(
    userId: string,
    title: string,
    accessToken: string,
  ): Promise<AiThread | null> {
    const payload = await supabaseRest<unknown>("ai_threads", {
      accessToken,
      method: "POST",
      body: JSON.stringify({ user_id: userId, title }),
      returnRepresentation: true,
    });
    return parseThreads(payload)[0] ?? null;
  },

  async listThreads(
    userId: string,
    accessToken: string,
  ): Promise<AiThread[]> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId },
      order: [
        { column: "last_message_at", ascending: false },
        { column: "id", ascending: true },
      ],
    });
    return parseThreads(
      await supabaseRest<unknown>(`ai_threads${query}`, { accessToken }),
    );
  },

  async findThread(
    userId: string,
    threadId: string,
    accessToken: string,
  ): Promise<AiThread | null> {
    return parseThreads(
      await supabaseRest<unknown>(`ai_threads${threadQuery(userId, threadId)}`, {
        accessToken,
      }),
    )[0] ?? null;
  },

  async updateThread(
    userId: string,
    threadId: string,
    input: Partial<
      Pick<
        AiThread,
        "title" | "last_message_at"
      >
    >,
    accessToken: string,
  ): Promise<AiThread | null> {
    const payload = await supabaseRest<unknown>(
      `ai_threads${threadQuery(userId, threadId)}`,
      {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
        returnRepresentation: true,
      },
    );
    return parseThreads(payload)[0] ?? null;
  },

  async updateDefaultTitle(
    userId: string,
    threadId: string,
    title: string,
    accessToken: string,
  ): Promise<AiThread | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: threadId, title: "新会话" },
    });
    const payload = await supabaseRest<unknown>(`ai_threads${query}`, {
      accessToken,
      method: "PATCH",
      body: JSON.stringify({ title }),
      returnRepresentation: true,
    });
    return parseThreads(payload)[0] ?? null;
  },

  async deleteThread(
    userId: string,
    threadId: string,
    accessToken: string,
  ): Promise<AiThread | null> {
    const payload = await supabaseRest<unknown>(
      `ai_threads${threadQuery(userId, threadId)}`,
      { accessToken, method: "DELETE", returnRepresentation: true },
    );
    return parseThreads(payload)[0] ?? null;
  },

  async listMessages(
    userId: string,
    threadId: string,
    accessToken: string,
  ): Promise<AiMessage[]> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, thread_id: threadId },
      order: [
        { column: "position", ascending: true },
        { column: "created_at", ascending: true },
        { column: "id", ascending: true },
      ],
    });
    return parseMessages(
      await supabaseRest<unknown>(`ai_messages${query}`, { accessToken }),
    );
  },

  async updateMessage(
    userId: string,
    threadId: string,
    messageId: string,
    input: Pick<SyncAiMessageInput, "parts" | "status" | "context_snapshot">,
    accessToken: string,
  ): Promise<AiMessageIdentity | null> {
    const query = createPostgrestQuery({
      select: ["id", "updated_at"],
      eq: {
        user_id: userId,
        thread_id: threadId,
        id: messageId,
        role: "assistant",
      },
      limit: 1,
    });
    const payload = await supabaseRest<unknown>(`ai_messages${query}`, {
      accessToken,
      method: "PATCH",
      body: JSON.stringify(input),
      returnRepresentation: true,
    });
    return parseMessageIdentity(payload);
  },

  async upsertMessages(
    userId: string,
    threadId: string,
    messages: readonly SyncAiMessageInput[],
    accessToken: string,
    options: { returnRepresentation?: boolean } = {},
  ): Promise<AiMessage[]> {
    const rows = messages.map((message, position) => ({
      id: message.id,
      thread_id: threadId,
      user_id: userId,
      role: message.role,
      parts: message.parts,
      position,
      status: message.status ?? "complete",
      context_snapshot: message.context_snapshot ?? null,
    }));
    const returnRepresentation = options.returnRepresentation ?? true;
    return upsertMessageRows(
      rows,
      accessToken,
      returnRepresentation,
    );
  },

  async upsertMessagesAt(
    userId: string,
    threadId: string,
    messages: readonly { message: SyncAiMessageInput; position: number }[],
    accessToken: string,
    options: { returnRepresentation?: boolean } = {},
  ): Promise<AiMessage[]> {
    const rows = messages.map(({ message, position }) => ({
      id: message.id,
      thread_id: threadId,
      user_id: userId,
      role: message.role,
      parts: message.parts,
      position,
      status: message.status ?? "complete",
      context_snapshot: message.context_snapshot ?? null,
    }));
    const returnRepresentation = options.returnRepresentation ?? true;
    return upsertMessageRows(
      rows,
      accessToken,
      returnRepresentation,
    );
  },

  async listReferences(
    userId: string,
    threadId: string,
    accessToken: string,
  ): Promise<AiThreadReference[]> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, thread_id: threadId },
      order: [
        { column: "created_at", ascending: true },
        { column: "memo_id", ascending: true },
      ],
    });
    return parseReferences(
      await supabaseRest<unknown>(`ai_thread_refs${query}`, { accessToken }),
    );
  },

  async replaceReferences(
    userId: string,
    threadId: string,
    memoIds: readonly string[],
    accessToken: string,
  ): Promise<AiThreadReference[]> {
    const payload = await supabaseRest<unknown>(
      "rpc/replace_ai_thread_references",
      {
      accessToken,
      method: "POST",
        body: JSON.stringify({
          p_user_id: userId,
          p_thread_id: threadId,
          p_memo_ids: memoIds,
        }),
      },
    );
    const parsed = replaceAiThreadReferencesRpcSchema.safeParse(payload);

    if (!parsed.success) throw invalidStoragePayload("AI reference RPC");
    if (parsed.data.status === "not_found") {
      throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
    }
    if (parsed.data.status === "too_many_references") {
      throw new HttpError(
        400,
        "AI_REFERENCE_LIMIT_EXCEEDED",
        "An AI thread can reference at most five memos",
      );
    }
    if (parsed.data.status === "invalid_reference") {
      throw new HttpError(
        404,
        "AI_REFERENCE_NOT_FOUND",
        "One or more memo references were not found",
      );
    }

    return parsed.data.references ?? [];
  },

  async findRun(
    userId: string,
    runId: string,
    accessToken: string,
  ): Promise<AiRun | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: runId },
      limit: 1,
    });
    return parseRuns(
      await supabaseRest<unknown>(`ai_runs${query}`, { accessToken }),
    )[0] ?? null;
  },

  async findCommand(
    userId: string,
    commandId: string,
    accessToken: string,
  ): Promise<AiCommand | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: commandId },
      limit: 1,
    });
    return parseCommands(
      await supabaseRest<unknown>(`ai_commands${query}`, { accessToken }),
    )[0] ?? null;
  },

  async createCommand(
    userId: string,
    input: CreateAiCommandInput,
    accessToken: string,
  ): Promise<AiCommandRpcResult> {
    return this.commandRpc("create_ai_command", {
      p_user_id: userId,
      p_thread_id: input.thread_id ?? null,
      p_tool_call_id: input.tool_call_id ?? null,
      p_operation: input.operation,
      p_target_node_id: input.target_node_id ?? null,
      p_expected_revision: input.expected_revision ?? null,
      p_idempotency_key: input.idempotency_key,
      p_input: input.input,
      p_approval_source: input.approval_source ?? null,
      p_risk: input.risk ?? null,
      p_approval_reason: input.approval_reason ?? null,
    }, accessToken);
  },

  async approveCommand(userId: string, commandId: string, accessToken: string) {
    return this.commandRpc("approve_ai_command", {
      p_user_id: userId,
      p_command_id: commandId,
    }, accessToken);
  },

  async rejectCommand(userId: string, commandId: string, accessToken: string) {
    return this.commandRpc("reject_ai_command", {
      p_user_id: userId,
      p_command_id: commandId,
    }, accessToken);
  },

  async undoCommand(userId: string, commandId: string, accessToken: string) {
    return this.commandRpc("undo_ai_command", {
      p_user_id: userId,
      p_command_id: commandId,
    }, accessToken);
  },

  async commandRpc(
    functionName: string,
    body: Readonly<Record<string, unknown>>,
    accessToken: string,
  ): Promise<AiCommandRpcResult> {
    return parseCommandRpc(
      await supabaseRest<unknown>(`rpc/${functionName}`, {
        accessToken,
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  async createRun(
    userId: string,
    memoId: string,
    threadId: string | null,
    idempotencyKey: string,
    accessToken: string,
  ): Promise<AiRunRpcResult> {
    return this.runRpc("create_ai_organize_run", {
      p_user_id: userId,
      p_memo_id: memoId,
      p_thread_id: threadId,
      p_idempotency_key: idempotencyKey,
    }, accessToken);
  },

  async recordRunPlan(
    userId: string,
    runId: string,
    plan: OrganizePlanInput,
    requiresConfirmation: boolean,
    accessToken: string,
  ): Promise<AiRunRpcResult> {
    return this.runRpc("record_ai_organize_plan", {
      p_user_id: userId,
      p_run_id: runId,
      p_plan: plan,
      p_requires_confirmation: requiresConfirmation,
    }, accessToken);
  },

  async applyRun(userId: string, runId: string, accessToken: string) {
    return this.runRpc("apply_ai_organize_run", {
      p_user_id: userId,
      p_run_id: runId,
    }, accessToken);
  },

  async rejectRun(userId: string, runId: string, accessToken: string) {
    return this.runRpc("reject_ai_organize_run", {
      p_user_id: userId,
      p_run_id: runId,
    }, accessToken);
  },

  async undoRun(userId: string, runId: string, accessToken: string) {
    return this.runRpc("undo_ai_organize_run", {
      p_user_id: userId,
      p_run_id: runId,
    }, accessToken);
  },

  async failRun(
    userId: string,
    runId: string,
    errorCode: string,
    accessToken: string,
  ) {
    return this.runRpc("fail_ai_organize_run", {
      p_user_id: userId,
      p_run_id: runId,
      p_error_code: errorCode,
    }, accessToken);
  },

  async runRpc(
    functionName: string,
    body: Readonly<Record<string, unknown>>,
    accessToken: string,
  ): Promise<AiRunRpcResult> {
    return parseRunRpc(
      await supabaseRest<unknown>(`rpc/${functionName}`, {
        accessToken,
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },
};
