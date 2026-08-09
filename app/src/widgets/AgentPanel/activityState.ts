/**
 * [INPUT]: 依赖 AI SDK ChatStatus/UIMessage part 与工具 part 类型守卫
 * [OUTPUT]: 对外提供互斥 AssistantActivity 与 deriveAssistantActivity 纯状态判定
 * [POS]: AgentPanel 的活动语义边界，把 SDK 流状态和最后一个可见 part 收敛为 thinking/streaming/tool/none
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart, type ChatStatus, type UIMessage } from "ai";

export type AssistantActivity = "none" | "thinking" | "streaming" | "tool";

const ACTIVE_TOOL_STATES = new Set([
  "approval-requested",
  "approval-responded",
  "input-available",
  "input-streaming",
]);

function isActivityBearingPart(part: UIMessage["parts"][number]) {
  return isToolUIPart(part)
    || part.type === "reasoning"
    || part.type === "step-start"
    || (part.type === "text" && part.text.length > 0);
}

export function deriveAssistantActivity(
  status: ChatStatus,
  message?: UIMessage,
): AssistantActivity {
  if (status !== "submitted" && status !== "streaming") {
    return "none";
  }

  if (status === "submitted" || message?.role !== "assistant") {
    return "thinking";
  }

  const lastPart = message.parts.findLast(isActivityBearingPart);

  if (!lastPart || lastPart.type === "reasoning" || lastPart.type === "step-start") {
    return "thinking";
  }

  if (isToolUIPart(lastPart)) {
    return ACTIVE_TOOL_STATES.has(lastPart.state) ? "tool" : "thinking";
  }

  return "streaming";
}
