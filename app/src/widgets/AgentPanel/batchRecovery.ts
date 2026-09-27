/**
 * [INPUT]: 依赖末条 assistant 的工具审批状态与已保存批量检查点
 * [OUTPUT]: 提供可恢复批量候选；仅恢复末条消息中已有执行计划的工具，终态不重跑
 * [POS]: AgentPanel 刷新恢复的纯判定，不读取 Store 或启动副作用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isToolUIPart } from "ai";
import type { FoluneUIMessage } from "../../shared/api/ai";
import { findApprovedPendingTools, type AgentToolPart } from "./approvalState";

export function findRecoverableTools(messages: readonly FoluneUIMessage[]): AgentToolPart[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return [];
  const checkpointIds = new Set(last.parts.filter((part) => part.type === "data-tool-batch").map((part) => "id" in part ? part.id : undefined));
  return [...findApprovedPendingTools(messages), ...last.parts.filter((part): part is AgentToolPart => isToolUIPart(part) && part.state === "input-available" && checkpointIds.has(part.toolCallId))];
}
