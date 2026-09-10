/**
 * [INPUT]: 依赖 Planner 类型化 plan、单篇 memo/AI Command API、账号权限设置与 tree/document Store 乐观事务
 * [OUTPUT]: 对外提供 executeMemoToolPlan，按 ID 读取单篇全文，或把写计划映射为内部原子命令并完成双 Store 对账
 * [POS]: AgentPanel 胖工具运行链的主线程协调器；Planner 只计算，本模块不裁决 RLS/revision，最终事实完全服从 api command
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  createAiCommand,
  getAiSettings,
  type AiCommand,
  type AiCommandOperation,
  type AiPermissionMode,
} from "../../shared/api/ai";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import type { MemoToolPlan } from "./memoToolPlanner";
import { getMemo } from "../../shared/api/memo";
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";

type CommandDraft = {
  expectedRevision: number | null;
  input: Record<string, unknown>;
  operation: AiCommandOperation;
  projectionInput: Record<string, unknown>;
  targetNodeId: string | null;
};

const commandDraft = (plan: MemoToolPlan): CommandDraft | null => {
  if (plan.kind === "read_tree" || plan.kind === "read_memo") return null;
  if (plan.kind === "create_folder" || plan.kind === "create_memo") {
    const input = {
      node_type: plan.kind === "create_folder" ? "folder" : "memo",
      ...plan.input,
    };
    return { expectedRevision: null, input, operation: "create_node", projectionInput: input, targetNodeId: null };
  }
  if (plan.kind === "rename_node") {
    const input = { title: plan.title };
    return { expectedRevision: plan.expectedRevision, input, operation: "rename_node", projectionInput: { node_id: plan.nodeId, ...input }, targetNodeId: plan.nodeId };
  }
  if (plan.kind === "delete_node") {
    return { expectedRevision: plan.expectedRevision, input: {}, operation: "trash_node", projectionInput: { node_id: plan.nodeId }, targetNodeId: plan.nodeId };
  }
  if (plan.kind === "edit_memo") {
    const input = { content_mdx: plan.contentMdx };
    return { expectedRevision: plan.expectedRevision, input, operation: "edit_memo", projectionInput: { node_id: plan.nodeId, ...input }, targetNodeId: plan.nodeId };
  }
  if (plan.op === "move") {
    const commandInput = { parent_id: plan.input.parent_id };
    return {
      expectedRevision: plan.expectedRevision,
      input: commandInput,
      operation: "move_node",
      projectionInput: { node_id: plan.nodeId, ...commandInput, planned_sort_order: plan.input.sort_order },
      targetNodeId: plan.nodeId,
    };
  }
  const reorderInput = {
    reference_node_id: plan.reference!.node_id,
    placement: plan.reference!.placement,
  };
  return {
    expectedRevision: plan.expectedRevision,
    input: reorderInput,
    operation: "reorder_node",
    projectionInput: { node_id: plan.nodeId, ...reorderInput, planned_sort_order: plan.input.sort_order },
    targetNodeId: plan.nodeId,
  };
};

const approvalFields = (
  mode: AiPermissionMode,
  manuallyApproved: boolean,
  operation: AiCommandOperation,
) => {
  if (manuallyApproved) return {
    approval_source: "manual" as const,
    risk: operation === "trash_node" ? "high" as const : "medium" as const,
    approval_reason: "用户已在本次工具审批卡中明确批准。",
  };
  if (mode === "full_access") return {
    approval_source: "full_access" as const,
    risk: operation === "trash_node" ? "high" as const : "low" as const,
    approval_reason: "用户已启用完全访问；版本检查、软删除和撤销保护仍然生效。",
  };
  if (mode === "ask") {
    throw new Error("当前权限要求人工确认，请重新发起这次操作。");
  }
  return {
    approval_source: "approval_agent" as const,
    risk: operation === "trash_node" ? "high" as const : "low" as const,
    approval_reason: "智能审批实验综合本轮意图、实际目标、修改参数和影响范围后批准。",
  };
};

export async function executeMemoToolPlan(input: {
  accessToken: string;
  manuallyApproved: boolean;
  plan: MemoToolPlan;
  threadId: string;
  toolCallId: string;
}): Promise<AiCommand | Record<string, unknown>> {
  if (input.plan.kind === "read_tree") {
    return input.plan.output;
  }
  if (input.plan.kind === "read_memo") {
    const detail = await getMemo(input.accessToken, input.plan.nodeId);
    return {
      content_mdx: detail.memo.content_mdx,
      id: detail.id,
      parent_id: detail.parent_id,
      revision: detail.revision,
      title: detail.title,
      updated_at: detail.memo.updated_at,
    };
  }
  const draft = commandDraft(input.plan)!;
  if (input.plan.kind === "edit_memo") {
    useMemoDocumentStore.getState().projectAiEdit(
      input.toolCallId,
      input.plan.nodeId,
      input.plan.contentMdx,
    );
  }
  useMemoTreeStore.getState().projectAiToolCall(
    input.toolCallId,
    draft.operation,
    draft.projectionInput,
  );
  try {
    const settings = await getAiSettings(input.accessToken);
    const command = await createAiCommand(input.accessToken, {
      thread_id: input.threadId,
      tool_call_id: input.toolCallId,
      operation: draft.operation,
      target_node_id: draft.targetNodeId,
      expected_revision: draft.expectedRevision,
      idempotency_key: `${input.threadId}:${input.toolCallId}`,
      input: draft.input,
      ...approvalFields(settings.permission_mode, input.manuallyApproved, draft.operation),
    });
    useMemoTreeStore.getState().reconcileAiCommand(command);
    useMemoDocumentStore.getState().reconcileAiCommand(command);
    return command;
  } catch (error) {
    useMemoTreeStore.getState().rollbackAiToolCall(input.toolCallId);
    useMemoDocumentStore.getState().rollbackAiEdit(input.toolCallId);
    throw error;
  }
}
