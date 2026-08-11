/**
 * [INPUT]: 依赖 @ai-sdk/react useChat、AI SDK 浏览器工具续写判定、@mastra/client-js 工具注册表、可取消庆祝执行器、Dashboard 草稿/删除协调边界、Kumo Button/Input、design-system Activity、memoChatTransport、Store 与 ChatMessage
 * [OUTPUT]: 对外提供按 UIMessage parts 渲染有序过程/工具/最终正文、遵循共享 48/32/16 Header 与 40px Composer 节奏、可经 Worker 执行客户端工具并停止 AI 流/活动礼花的 AgentPanel
 * [POS]: /app 右侧 AI 工作区；useChat 驱动完整 agent loop，停止命令收束 SSE 与庆祝 Canvas，Worker 规划后复用真人操作同款乐观 Store/API 链路
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useChat } from "@ai-sdk/react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import {
  PaperPlaneRightIcon,
  StopIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";

import { useAgentPanelStore } from "../../shared/store/agentPanelStore";
import {
  ThinkingIndicator,
  ThinkingMark,
} from "../../shared/design-system/components";
import { deriveAssistantActivity } from "./activityState";
import { cancelCelebration } from "./celebration";
import { ChatMessage } from "./ChatMessage";
import { getChatErrorCode } from "./chatFetch";
import { memoChatTransport } from "./chatTransport";
import {
  createAgentClientTools,
  executeAgentClientTool,
  isAgentClientToolName,
  normalizeToolInput,
} from "./clientTools";
import type { MemoTreeNode } from "../../shared/api/memo";

type AgentPanelProps = {
  accessToken: string;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onEditMemo: (nodeId: string, contentMdx: string) => Promise<MemoTreeNode>;
  onPrepareMutation: () => Promise<void>;
};

function getErrorCopy(error: Error | undefined) {
  const code = getChatErrorCode(error);

  if (code === "UNAUTHORIZED") {
    return {
      description: "登录状态已失效，请重新登录后再发送消息。",
      title: "需要重新登录",
    };
  }

  if (code === "AUTH_UPSTREAM_UNAVAILABLE" || code === "AUTH_UPSTREAM_ERROR") {
    return {
      description: "身份服务暂时不可用，请稍后再试。",
      title: "暂时无法验证登录状态",
    };
  }

  if (code === "INVALID_CHAT_REQUEST") {
    return {
      description: "当前消息格式无法发送，请刷新页面后再试。",
      title: "消息格式无效",
    };
  }

  if (!code) {
    return {
      description: "请检查网络与 chat 服务状态，然后重试。",
      title: "暂时无法连接备忘录助手",
    };
  }

  return {
    description: error?.message || "请检查 chat 服务是否已启动，然后重试。",
    title: "消息发送失败",
  };
}

export function AgentPanel({
  accessToken,
  onDeleteNode,
  onEditMemo,
  onPrepareMutation,
}: AgentPanelProps) {
  const closePanel = useAgentPanelStore((state) => state.close);
  const [inputValue, setInputValue] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const clientTools = useMemo(
    () => createAgentClientTools({
      accessToken,
      deleteNode: onDeleteNode,
      editMemo: onEditMemo,
      prepareMutation: onPrepareMutation,
    }),
    [accessToken, onDeleteNode, onEditMemo, onPrepareMutation],
  );
  const {
    addToolResult,
    clearError,
    error,
    messages,
    sendMessage,
    status,
    stop,
  } = useChat({
    transport: memoChatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (!isAgentClientToolName(clientTools, toolCall.toolName)) {
        // AI SDK 会把工具结果排进当前 stream 后面的串行任务；这里等待会与
        // 正在阻塞 onToolCall 的 stream 互相等待，导致工具已执行但 loop 卡死。
        void addToolResult({
          errorText: `浏览器没有注册客户端工具 ${toolCall.toolName}。`,
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }

      try {
        const input = normalizeToolInput(toolCall.input);
        const output = await executeAgentClientTool(
          clientTools,
          toolCall.toolName,
          input,
        );
        void addToolResult({
          output,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (toolError) {
        void addToolResult({
          errorText: toolError instanceof Error
            ? toolError.message
            : "客户端工具执行失败。",
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      }
    },
  });
  const submitting = status === "submitted";
  const streaming = status === "streaming";
  const busy = submitting || streaming;
  const lastMessage = messages.at(-1);
  const activity = deriveAssistantActivity(
    status,
    lastMessage?.role === "assistant" ? lastMessage : undefined,
  );
  const pendingWithoutAssistant = activity === "thinking"
    && lastMessage?.role !== "assistant";
  const errorCopy = getErrorCopy(error);

  const scrollToLatest = useCallback((behavior: ScrollBehavior) => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      behavior,
      top: messageList.scrollHeight,
    });
  }, []);
  const handleTypingProgress = useCallback(() => {
    scrollToLatest("auto");
  }, [scrollToLatest]);
  const handleStop = useCallback(() => {
    cancelCelebration();
    void stop();
  }, [stop]);

  useEffect(() => {
    scrollToLatest(streaming ? "auto" : "smooth");
  }, [messages, scrollToLatest, status, streaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = inputValue.trim();
    if (!text || busy) {
      return;
    }

    clearError();
    setInputValue("");

    try {
      await sendMessage({ text });
    } catch {
      // useChat 会把失败写入 error；输入已进入消息列表，不在这里重复提示。
    }
  }

  return (
    <aside aria-label="备忘录助手" className="agent-panel">
      <header className="agent-panel-header">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="agent-panel-mark">
            <ThinkingMark aria-hidden="true" size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              备忘录助手
            </p>
            <p className="text-xs text-muted-foreground">
              SuperNote AI
            </p>
          </div>
        </div>
        <Button
          aria-label="关闭备忘录助手"
          className="agent-panel-close"
          icon={XIcon}
          onClick={closePanel}
          shape="square"
          size="sm"
          variant="ghost"
        />
      </header>

      <div className="agent-panel-body">
        <div
          aria-busy={busy}
          aria-live="polite"
          aria-relevant="additions text"
          className="agent-message-list"
          ref={messageListRef}
          role="log"
        >
          {messages.length === 0 ? (
            <div className="agent-empty-state">
              <div className="agent-empty-mark">
                <ThinkingMark aria-hidden="true" size={20} />
              </div>
              <strong>想从哪条备忘录开始？</strong>
              <p>你可以让我梳理思路、润色文字，或直接聊聊刚记下的内容。</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                onProgress={handleTypingProgress}
                activity={
                  index === messages.length - 1 && message.role === "assistant"
                    ? activity
                    : "none"
                }
              />
            ))
          )}

          {pendingWithoutAssistant || activity === "streaming" ? (
            <ThinkingIndicator
              active={pendingWithoutAssistant}
              className="agent-standalone-thinking"
              label="备忘录助手正在思考"
            />
          ) : null}
        </div>

        {error ? (
          <div className="agent-error-state" role="alert">
            <WarningCircleIcon aria-hidden="true" size={17} weight="fill" />
            <div>
              <strong>{errorCopy.title}</strong>
              <p>{errorCopy.description}</p>
            </div>
          </div>
        ) : null}

        <form className="agent-composer" onSubmit={handleSubmit}>
          <Input
            aria-label="向备忘录助手发送消息"
            className="agent-chat-input"
            disabled={busy}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="和备忘录助手聊聊…"
            size="base"
            value={inputValue}
          />
          {streaming ? (
            <Button
              aria-label="停止生成"
              className="agent-composer-button"
              icon={StopIcon}
              onClick={handleStop}
              size="base"
              type="button"
              variant="secondary"
            >
              停止
            </Button>
          ) : (
            <Button
              aria-label="发送消息"
              className="agent-composer-button agent-composer-button-square"
              disabled={!inputValue.trim() || submitting}
              icon={PaperPlaneRightIcon}
              shape="square"
              size="base"
              type="submit"
              variant="primary"
            />
          )}
        </form>
      </div>
    </aside>
  );
}
