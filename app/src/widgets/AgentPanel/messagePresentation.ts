/**
 * [INPUT]: 依赖 AI SDK UIMessage 有序 parts 与工具 part 类型守卫
 * [OUTPUT]: 对外提供 processParts/finalText 的纯展示分区，不改变 SDK 原始顺序
 * [POS]: AgentPanel 消息语义切分层，以最后一次工具调用为边界，把可折叠处理过程与稳定最终正文分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart, type UIMessage } from "ai";

export type AgentMessagePresentation = {
  finalText: string;
  processParts: UIMessage["parts"];
};

function hasVisibleText(part: UIMessage["parts"][number]) {
  return (part.type === "text" || part.type === "reasoning")
    && part.text.trim().length > 0;
}

export function deriveAgentMessagePresentation(
  message: UIMessage,
): AgentMessagePresentation {
  const lastToolIndex = message.parts.findLastIndex(isToolUIPart);
  const processParts: UIMessage["parts"] = [];
  const finalTextParts: string[] = [];

  message.parts.forEach((part, index) => {
    if (isToolUIPart(part)) {
      processParts.push(part);
      return;
    }

    if (part.type === "reasoning") {
      if (hasVisibleText(part)) {
        processParts.push(part);
      }
      return;
    }

    if (part.type !== "text" || !hasVisibleText(part)) {
      return;
    }

    if (index < lastToolIndex) {
      processParts.push(part);
      return;
    }

    finalTextParts.push(part.text);
  });

  return {
    finalText: finalTextParts.join("\n\n"),
    processParts,
  };
}
