/**
 * [INPUT]: 依赖 shared/api/client 统一 Bearer 请求、AI SDK UIMessage 与 memo DTO mapper
 * [OUTPUT]: 对外提供 AI_TOOL_REQUEST_TIMEOUT_MS、FoluneUIMessage、首开 bootstrap、单会话 content、增量 assistant message PATCH、无归档状态的 AI thread/message/reference/settings/command CRUD、Run apply/reject/undo/get 类型与响应归一化、今日额度 getAiDailyUsage/AiDailyUsage
 * [POS]: app/src/shared/api 的 AI Native V2 HTTP 与消息契约边界；首开和会话切换分别使用聚合读取，工具权限读取、命令与单条结果落库以 45 秒响应期限退出，写请求不重放；真实写入只经 api/chat
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { UIMessage } from "ai";

import { apiRequest } from "./client";
import {
  mapMemoNodeDto,
  type MemoNodeDto,
} from "./memo.mapper";
import type { MemoNode } from "./memo";

export type AiContextMemoSnapshot = {
  memo_id: string;
  title: string;
  revision: number;
};

export type AiMessageContextSnapshot = {
  primary: AiContextMemoSnapshot | null;
  references: AiContextMemoSnapshot[];
};

export type FoluneUIMessageMetadata = {
  context?: {
    active_memo_id: string | null;
    reference_memo_ids: string[];
    revisions: Record<string, number>;
  };
  context_display?: AiMessageContextSnapshot;
  context_snapshot?: AiMessageContextSnapshot;
};

export type FoluneUIMessage = UIMessage<FoluneUIMessageMetadata>;

export type AiThreadReference = {
  thread_id: string;
  user_id: string;
  memo_id: string;
  created_at: string;
};

export type AiThread = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

export type AiThreadDetail = AiThread & {
  references: AiThreadReference[];
};

export type AiThreadBootstrap = {
  threads: AiThread[];
  selectedThread: AiThreadDetail | null;
  messages: AiMessage[];
};

export type AiThreadContent = Pick<AiThreadBootstrap, "messages" | "selectedThread"> & {
  selectedThread: AiThreadDetail;
};

export type AiMessage = FoluneUIMessage & {
  thread_id: string;
  user_id: string;
  position: number;
  status: "in_progress" | "complete" | "aborted" | "error";
  context_snapshot: AiMessageContextSnapshot | null;
  created_at: string;
  updated_at: string;
};

export type AiPermissionMode = "ask" | "auto_approve" | "full_access";

export type AiUserSettings = {
  user_id: string;
  permission_mode: AiPermissionMode;
  created_at: string;
  updated_at: string;
};

export type AiCommandOperation =
  | "create_node"
  | "rename_node"
  | "move_node"
  | "reorder_node"
  | "trash_node"
  | "edit_memo";

export type AiCommandStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "succeeded"
  | "rejected"
  | "failed"
  | "stale"
  | "undone";

export type AiCommand = {
  id: string;
  thread_id: string | null;
  tool_call_id: string | null;
  operation: AiCommandOperation;
  target_node_id: string | null;
  expected_revision: number | null;
  idempotency_key: string;
  input: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  undo_result: Record<string, unknown> | null;
  status: AiCommandStatus;
  approval_source: "manual" | "approval_agent" | "full_access" | null;
  risk: "low" | "medium" | "high" | null;
  approval_reason: string | null;
  error_code: string | null;
  updated_at: string;
  applied_at: string | null;
  undone_at: string | null;
};

export type CreateAiCommandInput = {
  thread_id: string;
  tool_call_id: string;
  operation: AiCommandOperation;
  target_node_id: string | null;
  expected_revision: number | null;
  idempotency_key: string;
  input: Record<string, unknown>;
  approval_source: "manual" | "approval_agent" | "full_access";
  risk: "low" | "medium" | "high";
  approval_reason: string;
};

export type OrganizeDestination =
  | { kind: "keep_current" }
  | { kind: "existing_folder"; folder_id: string }
  | { kind: "new_folder"; parent_id: string | null; folder_title: string };

export type OrganizePlan = {
  suggested_title: string;
  destination: OrganizeDestination;
  confidence: number;
  reason: string;
};

export type AiRunStatus =
  | "planning"
  | "awaiting_confirmation"
  | "applying"
  | "succeeded"
  | "rejected"
  | "failed"
  | "stale"
  | "undone";

export type AiRunResult = {
  result_revision: number;
  memo: MemoNode;
  created_folder: MemoNode | null;
  target_path: string;
  undo?: {
    memo: MemoNode;
    removed_folder_id: string | null;
    folder_retained: boolean;
  };
};

export type AiRun = {
  id: string;
  user_id: string;
  thread_id: string | null;
  memo_id: string;
  source_revision: number;
  status: AiRunStatus;
  idempotency_key: string;
  plan: OrganizePlan | null;
  result: AiRunResult | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  undone_at: string | null;
};

type AiRunResultDto = Omit<AiRunResult, "memo" | "created_folder" | "undo"> & {
  memo: MemoNodeDto;
  created_folder: MemoNodeDto | null;
  undo?: {
    memo: MemoNodeDto;
    removed_folder_id: string | null;
    folder_retained: boolean;
  };
};

export type AiRunDto = Omit<AiRun, "result"> & {
  result: AiRunResultDto | null;
};

export const mapAiRunDto = (run: AiRunDto): AiRun => {
  if (run.result === null) return { ...run, result: null };
  const { undo, ...result } = run.result;
  return {
    ...run,
    result: {
      ...result,
      memo: mapMemoNodeDto(result.memo),
      created_folder: result.created_folder === null
        ? null
        : mapMemoNodeDto(result.created_folder),
      ...(undo === undefined
        ? {}
        : { undo: { ...undo, memo: mapMemoNodeDto(undo.memo) } }),
    },
  };
};

export const createAiThread = (
  accessToken: string,
  title?: string,
): Promise<AiThread> =>
  apiRequest("/ai-threads", {
    body: JSON.stringify(title === undefined ? {} : { title }),
    method: "POST",
  }, accessToken);

export const listAiThreads = (
  accessToken: string,
): Promise<AiThread[]> =>
  apiRequest("/ai-threads", {}, accessToken);

const mapAiMessages = (messages: AiMessage[]): AiMessage[] =>
  messages.map((message) => ({
    ...message,
    metadata: {
      ...message.metadata,
      ...(message.context_snapshot === null
        ? {}
        : { context_snapshot: message.context_snapshot }),
    },
  }));

export const getAiThreadBootstrap = (
  accessToken: string,
  preferredThreadId?: string | null,
): Promise<AiThreadBootstrap> => {
  const query = preferredThreadId === undefined || preferredThreadId === null
    ? ""
    : `?selected_id=${encodeURIComponent(preferredThreadId)}`;
  return apiRequest<AiThreadBootstrap>(`/ai-threads/bootstrap${query}`, {}, accessToken)
    .then((bootstrap) => ({
      ...bootstrap,
      messages: mapAiMessages(bootstrap.messages),
    }));
};

export const getAiThreadContent = (
  accessToken: string,
  threadId: string,
): Promise<AiThreadContent> =>
  apiRequest<AiThreadContent>(
    `/ai-threads/${encodeURIComponent(threadId)}/content`,
    {},
    accessToken,
  ).then((content) => ({
    ...content,
    messages: mapAiMessages(content.messages),
  }));

export const getAiThread = (
  accessToken: string,
  threadId: string,
): Promise<AiThreadDetail> =>
  apiRequest(`/ai-threads/${encodeURIComponent(threadId)}`, {}, accessToken);

export const updateAiThread = (
  accessToken: string,
  threadId: string,
  input: Partial<Pick<AiThread, "title">>,
): Promise<AiThread> =>
  apiRequest(`/ai-threads/${encodeURIComponent(threadId)}`, {
    body: JSON.stringify(input),
    method: "PATCH",
  }, accessToken);

export const deleteAiThread = (
  accessToken: string,
  threadId: string,
): Promise<{ id: string; deleted: true }> =>
  apiRequest(`/ai-threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  }, accessToken);

export const listAiMessages = (
  accessToken: string,
  threadId: string,
): Promise<AiMessage[]> =>
  apiRequest<AiMessage[]>(
    `/ai-threads/${encodeURIComponent(threadId)}/messages`,
    {},
    accessToken,
  ).then(mapAiMessages);

export const syncAiMessages = (
  accessToken: string,
  threadId: string,
  messages: readonly FoluneUIMessage[],
): Promise<AiMessage[]> =>
  apiRequest(`/ai-threads/${encodeURIComponent(threadId)}/messages`, {
    body: JSON.stringify(messages),
    method: "PUT",
  }, accessToken);

/** 流式 assistant 已有稳定行时只 PATCH 这一行，避免重复上传整段会话。 */
export const syncAiMessage = (
  accessToken: string,
  threadId: string,
  message: FoluneUIMessage,
  signal: AbortSignal = AbortSignal.timeout(AI_TOOL_REQUEST_TIMEOUT_MS),
): Promise<Pick<AiMessage, "id" | "updated_at">> =>
  apiRequest<Pick<AiMessage, "id" | "updated_at">>(
    `/ai-threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(message.id)}`,
    {
      signal,
      body: JSON.stringify({
        id: message.id,
        parts: message.parts,
        role: message.role,
        status: "complete",
      }),
      method: "PATCH",
    },
    accessToken,
  );

// 工具槽不能被失联请求永久占用；写请求超时不自动重放。
export const AI_TOOL_REQUEST_TIMEOUT_MS = 45_000;

export const getAiSettings = (accessToken: string): Promise<AiUserSettings> =>
  apiRequest("/ai-settings", { signal: AbortSignal.timeout(AI_TOOL_REQUEST_TIMEOUT_MS) }, accessToken);

export const updateAiSettings = (
  accessToken: string,
  permissionMode: AiPermissionMode,
): Promise<AiUserSettings> =>
  apiRequest("/ai-settings", {
    method: "PATCH",
    body: JSON.stringify({ permission_mode: permissionMode }),
  }, accessToken);

// 今日额度状态（按 UTC 日）：total_tokens/daily_limit/remaining 为底层 token 口径，
// 面板层再折算成对用户展示的「额度」；exceeded 是后端裁定的门禁真值，前端不可用折算后
// 的额度自行判定。accessToken 省略时由请求期读当前会话。
export type AiDailyUsage = {
  usage_date: string;
  total_tokens: number;
  daily_limit: number;
  remaining: number;
  exceeded: boolean;
};

export const getAiDailyUsage = (accessToken?: string): Promise<AiDailyUsage> =>
  apiRequest("/ai-usage", {}, accessToken);

export const getAiCommand = (
  accessToken: string,
  commandId: string,
): Promise<AiCommand> =>
  apiRequest(`/ai-commands/${encodeURIComponent(commandId)}`, {}, accessToken);

export const createAiCommand = (
  accessToken: string,
  input: CreateAiCommandInput,
  signal: AbortSignal = AbortSignal.timeout(AI_TOOL_REQUEST_TIMEOUT_MS),
): Promise<AiCommand> =>
  apiRequest("/ai-commands", {
    signal,
    method: "POST",
    body: JSON.stringify(input),
  }, accessToken);

export const undoAiCommand = (
  accessToken: string,
  commandId: string,
): Promise<AiCommand> =>
  apiRequest(`/ai-commands/${encodeURIComponent(commandId)}/undo`, {
    method: "POST",
  }, accessToken);

export const replaceAiThreadReferences = (
  accessToken: string,
  threadId: string,
  memoIds: readonly string[],
): Promise<AiThreadReference[]> =>
  apiRequest(`/ai-threads/${encodeURIComponent(threadId)}/references`, {
    body: JSON.stringify({ memo_ids: memoIds }),
    method: "PUT",
  }, accessToken);

export const getAiRun = async (
  accessToken: string,
  runId: string,
): Promise<AiRun> =>
  mapAiRunDto(await apiRequest<AiRunDto>(
    `/ai-runs/${encodeURIComponent(runId)}`,
    {},
    accessToken,
  ));

const postRunCommand = async (
  accessToken: string,
  runId: string,
  command: "apply" | "reject" | "undo",
): Promise<AiRun> =>
  mapAiRunDto(await apiRequest<AiRunDto>(
    `/ai-runs/${encodeURIComponent(runId)}/${command}`,
    { method: "POST" },
    accessToken,
  ));

export const applyAiRun = (accessToken: string, runId: string) =>
  postRunCommand(accessToken, runId, "apply");
export const rejectAiRun = (accessToken: string, runId: string) =>
  postRunCommand(accessToken, runId, "reject");
export const undoAiRun = (accessToken: string, runId: string) =>
  postRunCommand(accessToken, runId, "undo");
