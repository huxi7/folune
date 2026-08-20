/**
 * [INPUT]: 依赖 SuperNoteUIMessage 的 AI SDK 有序文本/reasoning/工具 parts、过程分区与 design-system AI 消息组件
 * [OUTPUT]: 对外提供纯净用户消息、单一过程区及回复末尾轻量撤销的 assistant 回复
 * [POS]: AgentPanel 消息语义适配层，只负责对话与过程；人工审批由 AgentConversation 固定在 Composer 上方，冻结上下文不进入对话视觉层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArrowCounterClockwiseIcon } from "../../shared/design-system/icons";
import { useState } from "react";
import { getToolName, isToolUIPart } from "ai";

import type {
  AiCommand,
  SuperNoteUIMessage,
} from "../../shared/api/ai";
import {
  AssistantMessage,
  Button,
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
  message: SuperNoteUIMessage;
  onProgress?: () => void;
  onUndo: (commands: readonly AiCommand[]) => Promise<void>;
};

type AssistantMessageContentProps = {
  activity: AssistantActivity;
  finalText: string;
  onProgress?: () => void;
  processParts: SuperNoteUIMessage["parts"];
  undoCommands: AiCommand[];
  onUndo: ChatMessageProps["onUndo"];
};

type LiveAssistantTurnProps = {
  activity: AssistantActivity;
  message?: SuperNoteUIMessage;
  onProgress?: () => void;
  onUndo?: ChatMessageProps["onUndo"];
};

function getMessageText(message: SuperNoteUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function AssistantMessageContent({
  activity,
  finalText,
  onProgress,
  onUndo = async () => undefined,
  processParts,
  undoCommands,
}: AssistantMessageContentProps) {
  const [undoState, setUndoState] = useState<"idle" | "running" | "done">("idle");
  const responseActive = activity !== "none";
  const hasProcess = processParts.length > 0;

  return (
    <>
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
      {undoCommands.length > 0 ? (
        <div aria-label="回复操作" className="agent-response-actions">
          <Button
            className="agent-response-action"
            disabled={undoState !== "idle"}
            icon={ArrowCounterClockwiseIcon}
            onClick={() => {
              setUndoState("running");
              void onUndo(undoCommands)
                .then(() => setUndoState("done"))
                .catch(() => setUndoState("idle"));
            }}
            variant="ghost"
          >
            {undoState === "running" ? "正在撤销…" : undoState === "done" ? "已撤销" : "撤销本次操作"}
          </Button>
        </div>
      ) : null}
    </>
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
  onProgress,
  onUndo,
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
        onUndo={onUndo}
        processParts={presentation.processParts}
        undoCommands={presentation.undoCommands}
      />
    </article>
  );
}

export function LiveAssistantTurn({
  activity,
  message,
  onProgress,
  onUndo = async () => undefined,
}: LiveAssistantTurnProps) {
  const presentation = message ? getAssistantPresentation(message) : undefined;

  return (
    <article className="agent-chat-turn">
      {presentation ? (
        <AssistantMessageContent
          activity={activity}
          finalText={presentation.finalText}
          onProgress={onProgress}
          onUndo={onUndo}
          processParts={presentation.processParts}
          undoCommands={presentation.undoCommands}
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
