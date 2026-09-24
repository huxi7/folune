/**
 * [INPUT]: 依赖 FoluneUIMessage 的 AI SDK 有序 parts、覆盖工具续写间隙的整轮 activity、本轮读取快照的工具命名、过程分区与 design-system AI 消息组件
 * [OUTPUT]: 对外提供用户/assistant 回复、按真实 activity 退出的空回复占位、隔离披露/撤销状态的过程区及整轮结束后的撤销入口
 * [POS]: AgentPanel 消息语义适配层，只负责对话与过程；人工审批由 AgentConversation 固定在 Composer 上方，冻结上下文不进入对话视觉层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArrowUUpLeftIcon } from "../../shared/design-system/icons";
import { memo, useMemo, useState } from "react";
import { isToolUIPart } from "ai";

import type {
  AiCommand,
  FoluneUIMessage,
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
import { getAgentToolPresentations } from "./toolPresentation";

type ChatMessageProps = {
  activity: AssistantActivity;
  message: FoluneUIMessage;
  onProgress?: () => void;
  onUndo: (commands: readonly AiCommand[]) => Promise<void>;
};

type AssistantMessageContentProps = {
  activity: AssistantActivity;
  message: FoluneUIMessage;
  onProgress?: () => void;
  onUndo: ChatMessageProps["onUndo"];
};

type LiveAssistantTurnProps = {
  activity: AssistantActivity;
  message?: FoluneUIMessage;
  onProgress?: () => void;
  onUndo?: ChatMessageProps["onUndo"];
};

function getMessageText(message: FoluneUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function AssistantMessageContent({
  activity,
  message,
  onProgress,
  onUndo = async () => undefined,
}: AssistantMessageContentProps) {
  const [undoState, setUndoState] = useState<"idle" | "running" | "done">("idle");
  const [publishedAnswerIndexes, setPublishedAnswerIndexes] = useState<readonly number[]>([]);
  const responseActive = activity !== "none";
  const processActive = activity === "thinking" || activity === "tool";
  const { finalText, processParts, undoCommands, answerPartIndexes } = deriveAgentMessagePresentation(
    message, processActive, publishedAnswerIndexes,
  );
  // 已经给用户读到的正文不能再搬回折叠区；只保存 part 位置，文本仍以 SDK 最新值为准。
  if (answerPartIndexes.some((index) => !publishedAnswerIndexes.includes(index))) {
    setPublishedAnswerIndexes(answerPartIndexes);
  }
  const toolPresentations = useMemo(() => getAgentToolPresentations(message.parts), [message.parts]);
  const hasProcess = processParts.length > 0;

  return (
    <>
      <AssistantMessage
      content={finalText}
      onProgress={onProgress}
      process={hasProcess ? (
        <AgentProcessDisclosure
          active={processActive}
          autoExpand={publishedAnswerIndexes.length === 0}
          activeLabel={activity === "tool" ? "正在处理" : "正在思考"}
          onProgress={onProgress}
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

            const presentation = toolPresentations.get(part.toolCallId)!;

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
      {undoCommands.length > 0 && !responseActive ? (
        <div aria-label="回复操作" className="agent-response-actions">
          <Button
            className="agent-response-action"
            disabled={undoState !== "idle"}
            icon={ArrowUUpLeftIcon}
            onClick={() => {
              setUndoState("running");
              void onUndo(undoCommands)
                .then(() => setUndoState("done"))
                .catch(() => setUndoState("idle"));
            }}
            variant="ghost"
          >
            {undoState === "running" ? "正在撤销…" : undoState === "done" ? "已撤销" : "撤销"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function hasAssistantContent(message: FoluneUIMessage) {
  return message.parts.some((part) => isToolUIPart(part)
    || ((part.type === "text" || part.type === "reasoning") && part.text.trim().length > 0));
}

// memo 化: 历史回复在正文编辑时不应重跑 remark/rehype 全量解析。
// react-markdown 无自身 memo 且在 render 内执行 parse + runSync, 所以
// 拦截必须发生在这一层 —— 配合 AgentPanel 侧稳定化的 onProgress/onUndo
// 引用才生效 (根因 6)。
export const ChatMessage = memo(function ChatMessage({
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

  if (!hasAssistantContent(message)) {
    return null;
  }

  return (
    <article className="agent-chat-turn">
      <AssistantMessageContent
        key={message.id}
        activity={activity}
        message={message}
        onProgress={onProgress}
        onUndo={onUndo}
      />
    </article>
  );
});

export function LiveAssistantTurn({
  activity,
  message,
  onProgress,
  onUndo = async () => undefined,
}: LiveAssistantTurnProps) {
  if (activity === "none" && (!message || !hasAssistantContent(message))) return null;
  return (
    <article className="agent-chat-turn">
      {message && hasAssistantContent(message) ? (
        <AssistantMessageContent
          key={message?.id}
          activity={activity}
          message={message}
          onProgress={onProgress}
          onUndo={onUndo}
        />
      ) : (
        <ThinkingIndicator
          active={activity !== "none"}
          className="agent-live-thinking"
          label="备忘录助手正在思考"
        />
      )}
    </article>
  );
}
