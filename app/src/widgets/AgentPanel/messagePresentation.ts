/**
 * [INPUT]: 依赖 AI SDK UIMessage 有序 parts 与工具 part 类型守卫
 * [OUTPUT]: 对外提供去重后的 processParts、稳定 finalText、整轮 commands 与反向撤销顺序，不改变有效 SDK 原始顺序
 * [POS]: AgentPanel 消息语义切分层，以最后一次工具调用为边界，把透明过程、最终正文和轻量结果动作分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart, type UIMessage } from "ai";

import type { AiCommand } from "../../shared/api/ai";

export type AgentMessagePresentation = {
  finalText: string;
  processParts: UIMessage["parts"];
  undoCommands: AiCommand[];
};

export const reverseCommandsForUndo = <Command>(
  commands: readonly Command[],
): Command[] => [...commands].reverse();

export function coalesceAssistantMessages<T extends UIMessage>(
  messages: readonly T[],
): T[] {
  const result: T[] = [];
  for (const message of messages) {
    const previous = result.at(-1);
    if (message.role === "assistant" && previous?.role === "assistant") {
      result[result.length - 1] = {
        ...previous,
        parts: [...previous.parts, ...message.parts],
      };
      continue;
    }
    result.push(message);
  }
  return result;
}

const readCommand = (part: UIMessage["parts"][number]): AiCommand | null => {
  if (!isToolUIPart(part) || part.state !== "output-available") return null;
  const output = part.output;
  if (output === null || typeof output !== "object" || Array.isArray(output)) return null;
  const command = output as Partial<AiCommand>;
  return typeof command.id === "string" && command.status === "succeeded"
    ? command as AiCommand
    : null;
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
  const visibleToolCalls = new Set<string>();
  const undoCommands = new Map<string, AiCommand>();

  message.parts.forEach((part, index) => {
    if (isToolUIPart(part)) {
      const command = readCommand(part);
      if (command !== null) undoCommands.set(command.id, command);
      if (!visibleToolCalls.has(part.toolCallId)) {
        visibleToolCalls.add(part.toolCallId);
        processParts.push(part);
      }
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
    undoCommands: [...undoCommands.values()],
  };
}
