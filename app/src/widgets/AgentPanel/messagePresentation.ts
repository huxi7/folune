/**
 * [INPUT]: 依赖 AI SDK UIMessage 有序 parts、Chat folune.phase 标记、工具类型守卫、当前处理阶段与已显示正文索引
 * [OUTPUT]: 对外提供去重后的 processParts、稳定 finalText/answerPartIndexes、整轮 commands 与反向撤销顺序，不改变有效 SDK 原始顺序
 * [POS]: AgentPanel 消息语义切分层，以工具所在 step 与后续 reasoning 为过程边界，旧历史兼容最后工具分区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isToolUIPart, type UIMessage } from "ai";

import { readToolCommands } from "./toolExecutionState";
import type { AiCommand } from "../../shared/api/ai";

export type AgentMessagePresentation = {
  answerPartIndexes: number[];
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

function hasVisibleText(part: UIMessage["parts"][number]) {
  return (part.type === "text" || part.type === "reasoning")
    && part.text.trim().length > 0;
}

export function deriveAgentMessagePresentation(
  message: UIMessage,
  processActive = false,
  publishedAnswerIndexes: readonly number[] = [],
): AgentMessagePresentation {
  const lastToolIndex = message.parts.findLastIndex(isToolUIPart);
  const lastStepIndex = message.parts.findLastIndex((part) => part.type === "step-start");
  const lastReasoningIndex = message.parts.findLastIndex((part) => part.type === "reasoning" && hasVisibleText(part));
  const toolStepEnd = lastToolIndex >= 0 && lastStepIndex >= 0
    ? message.parts.findIndex((part, index) => index > lastToolIndex && part.type === "step-start")
    : lastToolIndex;
  const processEnd = Math.max(
    processActive ? message.parts.length : -1,
    lastReasoningIndex,
    lastStepIndex,
    toolStepEnd === -1 && lastToolIndex >= 0 ? message.parts.length : toolStepEnd,
  );
  const processParts: UIMessage["parts"] = [];
  const finalTextParts: string[] = [];
  const answerPartIndexes: number[] = [];
  const publishedAnswers = new Set(publishedAnswerIndexes);
  const visibleToolCalls = new Set<string>();
  const undoCommands = new Map<string, AiCommand>();

  message.parts.forEach((part, index) => {
    if (isToolUIPart(part)) {
      if (part.state === "output-available") for (const command of readToolCommands(part.output)) {
        if (command.status === "succeeded") undoCommands.set(command.id, command);
      }
      if (!visibleToolCalls.has(part.toolCallId)) {
        visibleToolCalls.add(part.toolCallId);
        processParts.push(part);
      }
      return;
    }

    if (part.type === "data-tool-batch") {
      const hasFinalOutput = message.parts.some((tool) => isToolUIPart(tool) && tool.toolCallId === part.id && tool.state.startsWith("output-"));
      if (!hasFinalOutput && "data" in part) for (const command of readToolCommands(part.data)) {
        if (command.status === "succeeded" && !undoCommands.has(command.id)) undoCommands.set(command.id, command);
      }
      processParts.push(part); return;
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

    if (!publishedAnswers.has(index) && (index < processEnd || part.providerMetadata?.folune?.phase === "process")) {
      processParts.push(part);
      return;
    }

    finalTextParts.push(part.text);
    answerPartIndexes.push(index);
  });

  return {
    answerPartIndexes,
    finalText: finalTextParts.join("\n\n"),
    processParts,
    undoCommands: [...undoCommands.values()],
  };
}
