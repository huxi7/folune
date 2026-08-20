/**
 * [INPUT]: 依赖 SuperNoteUIMessage 的 AI SDK 工具 part 状态机
 * [OUTPUT]: 对外提供末条 assistant 审批查找、单次响应投影、刷新恢复候选与工具结果投影纯函数
 * [POS]: AgentPanel 审批持久化的无副作用领域层，使 UI、API 同步与刷新恢复共享同一状态判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart } from "ai";

import type { SuperNoteUIMessage } from "../../shared/api/ai";

export type AgentToolPart = Extract<
  SuperNoteUIMessage["parts"][number],
  { toolCallId: string }
>;
export type ApprovalRequestedToolPart = Extract<
  SuperNoteUIMessage["parts"][number],
  { state: "approval-requested" }
>;
export type ApprovedPendingToolPart = Extract<
  SuperNoteUIMessage["parts"][number],
  { state: "approval-responded" }
>;

const lastAssistantMessage = (messages: readonly SuperNoteUIMessage[]) => {
  const message = messages.at(-1);
  return message?.role === "assistant" ? message : undefined;
};

export function findPendingApproval(
  messages: readonly SuperNoteUIMessage[],
): ApprovalRequestedToolPart | undefined {
  const message = lastAssistantMessage(messages);
  if (message === undefined) return undefined;

  return [...message.parts].reverse().find((part): part is ApprovalRequestedToolPart =>
    isToolUIPart(part) && part.state === "approval-requested"
  );
}

export function applyApprovalResponse(
  messages: readonly SuperNoteUIMessage[],
  approvalId: string,
  approved: boolean,
): SuperNoteUIMessage[] | undefined {
  const message = lastAssistantMessage(messages);
  if (message === undefined) return undefined;

  let changed = false;
  const parts = message.parts.map((part) => {
    if (
      changed
      || !isToolUIPart(part)
      || part.state !== "approval-requested"
      || part.approval.id !== approvalId
    ) {
      return part;
    }

    changed = true;
    return {
      ...part,
      approval: { ...part.approval, approved },
      state: "approval-responded" as const,
    };
  });

  return changed
    ? [...messages.slice(0, -1), { ...message, parts }]
    : undefined;
}

export function findApprovedPendingTools(
  messages: readonly SuperNoteUIMessage[],
): ApprovedPendingToolPart[] {
  const message = lastAssistantMessage(messages);
  if (message === undefined) return [];

  return message.parts.filter((part): part is ApprovedPendingToolPart =>
    isToolUIPart(part)
    && part.state === "approval-responded"
    && part.approval.approved
  );
}

export function applyToolOutput(
  messages: readonly SuperNoteUIMessage[],
  toolCallId: string,
  result:
    | { state: "output-available"; output: unknown }
    | { state: "output-error"; errorText: string },
): SuperNoteUIMessage[] | undefined {
  const message = lastAssistantMessage(messages);
  if (message === undefined) return undefined;

  let changed = false;
  const parts = message.parts.map((part) => {
    if (changed || !isToolUIPart(part) || part.toolCallId !== toolCallId) {
      return part;
    }

    changed = true;
    return (result.state === "output-available"
      ? { ...part, state: result.state, output: result.output }
      : { ...part, state: result.state, errorText: result.errorText }) as SuperNoteUIMessage["parts"][number];
  });

  return changed
    ? [...messages.slice(0, -1), { ...message, parts }]
    : undefined;
}
