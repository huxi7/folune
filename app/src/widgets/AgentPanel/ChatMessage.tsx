/**
 * [INPUT]: 依赖 AI SDK UIMessage 文本/工具 part、互斥 AssistantActivity、design-system AI 消息组件与安全 MarkdownReadingView
 * [OUTPUT]: 对外提供用户气泡，以及 Thinking/Tool/Streaming 不叠加的 assistant 消息渲染
 * [POS]: AgentPanel 的消息适配层，把 SDK part 与已判定活动态映射为同一套生产设计系统组件
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
import type { AssistantActivity } from "./activityState";

type ChatMessageProps = {
  activity: AssistantActivity;
  message: UIMessage;
  onProgress?: () => void;
};

export function ChatMessage({
  activity,
  message,
  onProgress,
}: ChatMessageProps) {
  const textParts = message.parts.filter((part) => part.type === "text");
  const text = textParts.map((part) => part.text).join("\n\n");
  const toolParts = message.parts.filter(isToolUIPart);

  if (message.role === "user") {
    if (!text) {
      return null;
    }

    return (
      <article className="agent-chat-turn agent-user-message-layout">
        <p className="agent-message-author">你</p>
        <UserMessageBubble>
          <p>{text}</p>
        </UserMessageBubble>
      </article>
    );
  }

  if (message.role !== "assistant" || (!text && toolParts.length === 0 && activity === "none")) {
    return null;
  }

  return (
    <article className="agent-chat-turn">
      <AssistantMessage
        content={text}
        onProgress={onProgress}
        renderContent={(content) => <MarkdownReadingView content={content} />}
        streaming={activity === "streaming"}
      >
        {toolParts.map((part) => (
          <ToolCallBubble
            errorText={part.state === "output-error" ? part.errorText : undefined}
            input={part.input}
            key={part.toolCallId}
            name={getToolName(part)}
            output={part.state === "output-available" ? part.output : undefined}
            state={part.state}
          />
        ))}
      </AssistantMessage>
      {activity === "thinking" || activity === "streaming" ? (
        <ThinkingIndicator
          active={activity === "thinking"}
          label="备忘录助手正在思考"
        />
      ) : null}
    </article>
  );
}
