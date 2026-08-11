/**
 * [INPUT]: 依赖 AI SDK UIMessage 有序文本/reasoning/工具 parts、过程/正文分区、工具人话展示、可折叠过程容器与 design-system AI 消息组件
 * [OUTPUT]: 对外提供无冗余身份标题的用户气泡，以及真实顺序穿插过程文字/工具、完成后可折叠过程且最终正文始终独立的 assistant 回复
 * [POS]: AgentPanel 消息适配层，把 SDK 原始 part 流转换为 SuperNote 轻量 Agent 回复，不改变工具执行或持久化语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";

import {
  AssistantMessage,
  ToolCallBubble,
  UserMessageBubble,
} from "../../shared/design-system/components";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { AgentProcessDisclosure } from "./AgentProcessDisclosure";
import type { AssistantActivity } from "./activityState";
import { deriveAgentMessagePresentation } from "./messagePresentation";
import { getAgentToolPresentation } from "./toolPresentation";

type ChatMessageProps = {
  activity: AssistantActivity;
  message: UIMessage;
  onProgress?: () => void;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

export function ChatMessage({
  activity,
  message,
  onProgress,
}: ChatMessageProps) {
  if (message.role === "user") {
    const text = getMessageText(message);

    if (!text) {
      return null;
    }

    return (
      <article className="agent-chat-turn agent-user-message-layout">
        <UserMessageBubble>
          <p>{text}</p>
        </UserMessageBubble>
      </article>
    );
  }

  if (message.role !== "assistant") {
    return null;
  }

  const { finalText, processParts } = deriveAgentMessagePresentation(message);
  const responseActive = activity !== "none";
  const waitingForNextPart = activity === "thinking";
  const hasProcess = processParts.length > 0;
  const showProcess = hasProcess || waitingForNextPart;

  if (!finalText && !showProcess) {
    return null;
  }

  return (
    <article className="agent-chat-turn">
      <AssistantMessage
        content={finalText}
        onProgress={onProgress}
        process={showProcess ? (
          <AgentProcessDisclosure
            active={responseActive}
            activeLabel={activity === "tool" ? "正在处理" : "正在思考"}
          >
            {processParts.map((part, index) => {
              if (part.type === "text" || part.type === "reasoning") {
                return (
                  <div
                    className="agent-process-text"
                    data-kind={part.type}
                    key={`${part.type}-${index}`}
                  >
                    <MarkdownReadingView content={part.text} />
                  </div>
                );
              }

              if (!isToolUIPart(part)) {
                return null;
              }

              const toolName = getToolName(part);
              const presentation = getAgentToolPresentation(toolName, part);

              return (
                <ToolCallBubble
                  details={presentation.details}
                  icon={presentation.icon}
                  key={part.toolCallId}
                  live={responseActive}
                  name={presentation.name}
                  state={part.state}
                />
              );
            })}
          </AgentProcessDisclosure>
        ) : undefined}
        renderContent={(content) => <MarkdownReadingView content={content} />}
        streaming={activity === "streaming"}
      />
    </article>
  );
}
