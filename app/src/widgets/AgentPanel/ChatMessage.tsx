/**
 * [INPUT]: 依赖 AI SDK UIMessage 有序文本/reasoning/工具 parts、过程/正文分区、工具人话展示、可折叠过程容器与按词流式的 design-system AI 消息组件
 * [OUTPUT]: 对外提供无冗余身份标题的用户气泡、历史 assistant 回复，以及跨 submitted/空 SSE message/首个内容保持同一 ThinkingIndicator 实例的 LiveAssistantTurn
 * [POS]: AgentPanel 消息适配层，把 SDK 原始 part 流转换为 SuperNote 轻量 Agent 回复；实时槽位不改变工具执行或持久化语义，且不因空 assistant 占位重置等待动效
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";

import {
  AssistantMessage,
  ThinkingIndicator,
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

type AssistantMessageContentProps = {
  activity: AssistantActivity;
  finalText: string;
  onProgress?: () => void;
  processParts: UIMessage["parts"];
};

type LiveAssistantTurnProps = {
  activity: AssistantActivity;
  message?: UIMessage;
  onProgress?: () => void;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function AssistantMessageContent({
  activity,
  finalText,
  onProgress,
  processParts,
}: AssistantMessageContentProps) {
  const responseActive = activity !== "none";
  const hasProcess = processParts.length > 0;

  return (
    <AssistantMessage
      content={finalText}
      onProgress={onProgress}
      process={hasProcess ? (
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
      renderContent={(content, streamingText) => (
        <MarkdownReadingView
          content={content}
          streamingText={streamingText}
        />
      )}
      streaming={activity === "streaming"}
    />
  );
}

function getAssistantPresentation(message: UIMessage) {
  const presentation = deriveAgentMessagePresentation(message);

  return presentation.finalText || presentation.processParts.length > 0
    ? presentation
    : undefined;
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

  const presentation = getAssistantPresentation(message);

  if (!presentation) {
    return null;
  }

  return (
    <article className="agent-chat-turn">
      <AssistantMessageContent
        activity={activity}
        finalText={presentation.finalText}
        onProgress={onProgress}
        processParts={presentation.processParts}
      />
    </article>
  );
}

export function LiveAssistantTurn({
  activity,
  message,
  onProgress,
}: LiveAssistantTurnProps) {
  const presentation = message ? getAssistantPresentation(message) : undefined;

  return (
    <article className="agent-chat-turn">
      {presentation ? (
        <AssistantMessageContent
          activity={activity}
          finalText={presentation.finalText}
          onProgress={onProgress}
          processParts={presentation.processParts}
        />
      ) : (
        <ThinkingIndicator
          active
          className="agent-live-thinking"
          label="备忘录助手正在思考"
        />
      )}
    </article>
  );
}
