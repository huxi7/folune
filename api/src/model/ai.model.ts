/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型与 MemoTreeNode
 * [OUTPUT]: 对外提供无归档状态的 AI 会话、消息、引用、冻结上下文、账号权限、通用命令、整理 Run/Action 与事务结果领域类型
 * [POS]: model 层 AI Native V2 纯领域契约，分离持久化事实、模型审批建议与数据库可执行结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "./memo.model.ts";

export type AiMessageRole = "user" | "assistant";
export type AiMessageStatus =
  | "in_progress"
  | "complete"
  | "aborted"
  | "error";

export interface AiThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface AiMessageContextMemoSnapshot {
  memo_id: string;
  title: string;
  revision: number;
}

export interface AiMessageContextSnapshot {
  primary: AiMessageContextMemoSnapshot | null;
  references: AiMessageContextMemoSnapshot[];
}

export interface AiMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: AiMessageRole;
  parts: unknown[];
  position: number;
  status: AiMessageStatus;
  context_snapshot: AiMessageContextSnapshot | null;
  created_at: string;
  updated_at: string;
}

export interface AiThreadReference {
  thread_id: string;
  user_id: string;
  memo_id: string;
  created_at: string;
}

export type AiPermissionMode = "ask" | "auto_approve" | "full_access";

export interface AiUserSettings {
  user_id: string;
  permission_mode: AiPermissionMode;
  created_at: string;
  updated_at: string;
}

export interface AiUsageDaily {
  user_id: string;
  usage_date: string;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

// 服务端按 UTC 日的 token 额度门禁判定；daily_limit 由 api 配置注入，
// remaining/exceeded 供 chat 决定放行或拦截、供前端展示剩余额度。
export interface AiDailyUsageStatus {
  usage_date: string;
  total_tokens: number;
  daily_limit: number;
  remaining: number;
  exceeded: boolean;
}

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

export type AiApprovalSource = "manual" | "approval_agent" | "full_access";
export type AiRisk = "low" | "medium" | "high";

export interface AiCommand {
  id: string;
  user_id: string;
  thread_id: string | null;
  tool_call_id: string | null;
  operation: AiCommandOperation;
  target_node_id: string | null;
  expected_revision: number | null;
  idempotency_key: string;
  input: Readonly<Record<string, unknown>>;
  before_state: Readonly<Record<string, unknown>> | null;
  after_state: Readonly<Record<string, unknown>> | null;
  undo_result: Readonly<Record<string, unknown>> | null;
  status: AiCommandStatus;
  approval_source: AiApprovalSource | null;
  risk: AiRisk | null;
  approval_reason: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  undone_at: string | null;
}

export interface ResolvedMemoContext {
  memo_id: string;
  title: string;
  content_mdx: string;
  path: string;
  revision: number;
  updated_at: string;
  truncated: boolean;
}

export interface ResolvedAiContext {
  primary: ResolvedMemoContext | null;
  references: ResolvedMemoContext[];
  missing_reference_ids: string[];
}

export type OrganizeDestination =
  | { kind: "keep_current" }
  | { kind: "existing_folder"; folder_id: string }
  | {
      kind: "new_folder";
      parent_id: string | null;
      folder_title: string;
    };

export interface OrganizePlan {
  suggested_title: string;
  destination: OrganizeDestination;
  confidence: number;
  reason: string;
}

export type AiRunStatus =
  | "planning"
  | "awaiting_confirmation"
  | "applying"
  | "succeeded"
  | "rejected"
  | "failed"
  | "stale"
  | "undone";

export interface AiRunApplyResult {
  result_revision: number;
  memo: MemoTreeNode;
  created_folder: MemoTreeNode | null;
  target_path: string;
}

export interface AiRunUndoResult {
  memo: MemoTreeNode;
  removed_folder_id: string | null;
  folder_retained: boolean;
}

export interface AiRunResult extends AiRunApplyResult {
  undo?: AiRunUndoResult;
}

export interface AiRun {
  id: string;
  user_id: string;
  thread_id: string | null;
  run_type: "organize_memo";
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
}

export interface AiAction {
  id: string;
  user_id: string;
  run_id: string;
  sequence: number;
  action_type: "rename" | "move" | "create_folder";
  target_node_id: string;
  before_state: Readonly<Record<string, unknown>>;
  after_state: Readonly<Record<string, unknown>>;
  undone_at: string | null;
}
