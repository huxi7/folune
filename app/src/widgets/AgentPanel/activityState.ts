/**
 * [INPUT]: 依赖 AI SDK ChatStatus/UIMessage part、Chat folune.phase 标记与调用方整轮续写状态
 * [OUTPUT]: 对外提供互斥 AssistantActivity、胶囊 AgentPresence 状态、deriveAssistantActivity 与 hasAssistantContinuation 续写判定
 * [POS]: AgentPanel 的活动语义边界；网络 ready 不等于整轮完成，当前 step 工具优先于过渡文字
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart, type ChatStatus, type UIMessage } from "ai";

export type AssistantActivity = "none" | "thinking" | "streaming" | "tool";
export type AgentPresence = "idle" | "working" | "approval" | "complete" | "error";

export function hasAssistantContinuation(message: UIMessage): boolean {
  const lastStep = message.parts.findLastIndex((part) => part.type === "step-start");
  return message.parts.slice(lastStep + 1).some((part) => isToolUIPart(part)
    && part.state !== "input-streaming"
    && part.state !== "output-denied"
    && !(part.state === "approval-responded" && !part.approval.approved));
}

const ACTIVE_TOOL_STATES = new Set([
  "approval-requested",
  "approval-responded",
  "input-available",
  "input-streaming",
]);

function isActivityBearingPart(part: UIMessage["parts"][number]) {
  return isToolUIPart(part)
    || part.type === "step-start"
    || ((part.type === "text" || part.type === "reasoning") && part.text.trim().length > 0);
}

export function deriveAssistantActivity(
  status: ChatStatus,
  message?: UIMessage,
  continuing = false,
): AssistantActivity {
  if (status === "error" || (status === "ready" && !continuing)) {
    return "none";
  }

  if (status === "submitted" || message?.role !== "assistant") {
    return "thinking";
  }

  const lastStepIndex = message.parts.findLastIndex((part) => part.type === "step-start");
  const currentParts = message.parts.slice(lastStepIndex + 1);
  if (currentParts.some((part) => isToolUIPart(part) && ACTIVE_TOOL_STATES.has(part.state))) {
    return "tool";
  }
  // step-start 是 SDK 的真实边界；同一步含工具时，过渡文字仍属于处理过程。
  // 无 step 的旧历史沿用最后一个有效 part，避免吞掉既有正文。
  if (lastStepIndex >= 0 && currentParts.some(isToolUIPart)) {
    return "thinking";
  }

  const lastPart = message.parts.findLast(isActivityBearingPart);

  if (!lastPart || lastPart.type === "reasoning" || lastPart.type === "step-start") {
    return "thinking";
  }

  if (isToolUIPart(lastPart)) {
    return ACTIVE_TOOL_STATES.has(lastPart.state) ? "tool" : "thinking";
  }

  if (lastPart.type === "text" && lastPart.providerMetadata?.folune?.phase === "process") {
    return "thinking";
  }

  return "streaming";
}
