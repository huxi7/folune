/**
 * [INPUT]: 依赖 SuperNoteUIMessage 冻结上下文、AI SDK 有序文本/reasoning/工具 parts、ApprovalCard、过程分区与 design-system AI 消息组件
 * [OUTPUT]: 对外提供带真实引用/revision 的用户消息、来源/工具/审批/差异/撤销的 assistant 回复及稳定 LiveAssistantTurn
 * [POS]: AgentPanel 消息语义适配层，把原始 SDK parts 转成可信执行界面，不暴露 UUID、凭据或工具原始 JSON
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart } from "ai";

import type {
  AiCommand,
  AiMessageContextSnapshot,
  SuperNoteUIMessage,
} from "../../shared/api/ai";
import {
  AssistantMessage,
  ThinkingIndicator,
  ToolCallBubble,
  UserMessageBubble,
} from "../../shared/design-system/components";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { AgentProcessDisclosure } from "./AgentProcessDisclosure";
import { ApprovalCard } from "./ApprovalCard";
import type { AssistantActivity } from "./activityState";
import { deriveAgentMessagePresentation } from "./messagePresentation";
import { getAgentToolPresentation } from "./toolPresentation";

type ChatMessageProps = {
  activity: AssistantActivity;
  message: SuperNoteUIMessage;
  onApproval: (id: string, approved: boolean) => void;
  onProgress?: () => void;
  sources?: AiMessageContextSnapshot;
  onUndo: (command: AiCommand) => Promise<void>;
};

type AssistantMessageContentProps = {
  activity: AssistantActivity;
  finalText: string;
  onProgress?: () => void;
  processParts: SuperNoteUIMessage["parts"];
  onApproval: ChatMessageProps["onApproval"];
  onUndo: ChatMessageProps["onUndo"];
};

type LiveAssistantTurnProps = {
  activity: AssistantActivity;
  message?: SuperNoteUIMessage;
  onApproval?: ChatMessageProps["onApproval"];
  onProgress?: () => void;
  sources?: AiMessageContextSnapshot;
  onUndo?: ChatMessageProps["onUndo"];
};

function MessageSources({ sources }: { sources?: AiMessageContextSnapshot }) {
  if (sources === undefined
    || (sources.primary === null && sources.references.length === 0)) {
    return null;
  }

  return (
    <div className="agent-assistant-sources">
      <strong>来源</strong>
      {sources.primary ? (
        <span>{sources.primary.title}<small>v{sources.primary.revision}</small></span>
      ) : null}
      {sources.references.map((memo) => (
        <span key={memo.memo_id}>@{memo.title}<small>v{memo.revision}</small></span>
      ))}
    </div>
  );
}

function getMessageText(message: SuperNoteUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function AssistantMessageContent({
  activity,
  finalText,
  onApproval = () => undefined,
  onProgress,
  onUndo = async () => undefined,
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
              <div className="agent-tool-stack" key={part.toolCallId}>
                <ToolCallBubble details={presentation.details} icon={presentation.icon} live={responseActive} name={presentation.name} state={part.state} />
                <ApprovalCard onApproval={onApproval} onUndo={onUndo} part={part} />
              </div>
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

function getAssistantPresentation(message: SuperNoteUIMessage) {
  const presentation = deriveAgentMessagePresentation(message);

  return presentation.finalText || presentation.processParts.length > 0
    ? presentation
    : undefined;
}

export function ChatMessage({
  activity,
  message,
  onApproval,
  onProgress,
  sources,
  onUndo,
}: ChatMessageProps) {
  if (message.role === "user") {
    const text = getMessageText(message);

    if (!text) {
      return null;
    }

    return (
      <article className="agent-chat-turn agent-user-message-layout">
        {(() => {
          const snapshot = message.metadata?.context_snapshot ?? message.metadata?.context_display;
          if (!snapshot || (snapshot.primary === null && snapshot.references.length === 0)) return null;
          return <div className="agent-message-context">{snapshot.primary ? <span><strong>当前</strong>{snapshot.primary.title}<small>v{snapshot.primary.revision}</small></span> : null}{snapshot.references.map((memo) => <span key={memo.memo_id}>@{memo.title}<small>v{memo.revision}</small></span>)}</div>;
        })()}
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
      <MessageSources sources={sources} />
      <AssistantMessageContent
        activity={activity}
        finalText={presentation.finalText}
        onApproval={onApproval}
        onProgress={onProgress}
        onUndo={onUndo}
        processParts={presentation.processParts}
      />
    </article>
  );
}

export function LiveAssistantTurn({
  activity,
  message,
  onApproval = () => undefined,
  onProgress,
  sources,
  onUndo = async () => undefined,
}: LiveAssistantTurnProps) {
  const presentation = message ? getAssistantPresentation(message) : undefined;

  return (
    <article className="agent-chat-turn">
      <MessageSources sources={sources} />
      {presentation ? (
        <AssistantMessageContent
          activity={activity}
          finalText={presentation.finalText}
          onApproval={onApproval}
          onProgress={onProgress}
          onUndo={onUndo}
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
