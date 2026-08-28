/**
 * [INPUT]: 依赖 useAiThreads、类型化 useChat/原生审批、持久化消息 API、本地 Design System Button/MentionInput、统一 Composer sources、Worker 胖工具链、权限/History 与 Dashboard AI 整理/草稿协调边界
 * [OUTPUT]: 对外提供本地 Design System Ghost 图标 Header、统一历史会话、仅在 Composer 展示的当前笔记默认上下文、内联高亮 @笔记、实时紧凑搜索、冻结请求上下文、普通/整理同构的 Composer 审批 Dock、审批幂等与刷新恢复、流完成后工具执行、乐观命令/整轮逆序撤销对账、会话恢复及停止 SSE/礼花的 AI Native 右侧工作区
 * [POS]: /app 右侧 AI Native V2 组合根；工具参数流结束且批准后才进入 Worker，api command 是唯一写事实源，Store 只做幂等投影与回滚
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useChat } from "@ai-sdk/react";
import {
  ArrowUpIcon,
  AssistantPanelCloseIcon,
  AtIcon,
  MenuIcon,
  NewConversationIcon,
  PushPinIcon,
  StopIcon,
  WarningCircleIcon,
  XIcon,
} from "../../shared/design-system/icons";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
  isToolUIPart,
} from "ai";

import {
  syncAiMessages,
  undoAiCommand,
  type AiCommand,
  type AiRun,
  type AiThreadDetail,
  type SuperNoteUIMessage,
} from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import { Button, MentionInput } from "../../shared/design-system/components";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { deriveAssistantActivity } from "./activityState";
import {
  applyApprovalResponse,
  applyToolOutput,
  findApprovedPendingTools,
  findPendingApproval,
  type AgentToolPart,
} from "./approvalState";
import { ApprovalCard } from "./ApprovalCard";
import { cancelCelebration } from "./celebration";
import { ChatMessage, LiveAssistantTurn } from "./ChatMessage";
import { getChatErrorCode } from "./chatFetch";
import { createMemoChatTransport } from "./chatTransport";
import {
  canSubmitComposer,
  isComposerSubmitKey,
} from "./composerBehavior";
import {
  addComposerSource,
  buildFrozenComposerContext,
  MAX_COMPOSER_SOURCES,
  reconcileComposerSources,
  settleComposerSourcesAfterSend,
  syncManualComposerSources,
  type ComposerSource,
} from "./composerSources";
import {
  createAgentClientTools,
  executeAgentClientTool,
  isAgentClientToolName,
  isMemoClientToolName,
  normalizeToolInput,
  parseAgentClientToolInput,
} from "./clientTools";
import { executeMemoToolPlan } from "./memoToolExecution";
import { requestMemoToolPlan } from "./memoToolWorkerClient";
import {
  coalesceAssistantMessages,
  reverseCommandsForUndo,
} from "./messagePresentation";
import { OrganizeReviewCard } from "./OrganizeReviewCard";
import {
  getMentionResults,
  MentionMenu,
  type MentionResult,
} from "./MentionMenu";
import { PermissionModeControl } from "./PermissionModeControl";
import { ThreadHistory } from "./ThreadHistory";
import { normalizeAgentToolName } from "./toolPresentation";
import { useAiThreads } from "./useAiThreads";
import { useMemoSearch } from "../useMemoSearch";

type AgentPanelProps = {
  accessToken: string;
  currentMemo: MemoTreeNode | null;
  memoTree: MemoTreeNode[];
  onApplyOrganize: () => Promise<void>;
  onClose: () => void;
  onPrepareMutation: () => Promise<void>;
  onRejectOrganize: () => Promise<void>;
  onSelectedThreadChange: (threadId: string | null) => void;
  organizeBusy: boolean;
  organizeRun: AiRun | null;
  userId: string;
};

type ConversationProps = {
  accessToken: string;
  currentMemo: MemoTreeNode | null;
  initialMessages: SuperNoteUIMessage[];
  memoTree: readonly MemoTreeNode[];
  onBusyChange: (busy: boolean) => void;
  onApplyOrganize: AgentPanelProps["onApplyOrganize"];
  onPrepareMutation: AgentPanelProps["onPrepareMutation"];
  onRejectOrganize: AgentPanelProps["onRejectOrganize"];
  onReferencesChange: (memoIds: readonly string[]) => Promise<void>;
  onThreadUpdated: () => Promise<void>;
  organizeReviewBusy: boolean;
  organizeRun: AiRun | null;
  thread: AiThreadDetail;
};

const readCommandOutput = (value: unknown): AiCommand | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Partial<AiCommand>;
  return typeof command.id === "string" && typeof command.operation === "string"
    && typeof command.status === "string" ? command as AiCommand : null;
};

function getErrorCopy(error: Error | undefined) {
  const code = getChatErrorCode(error);
  if (code === "UNAUTHORIZED") return { title: "需要重新登录", description: "登录状态已失效，请重新登录后再发送消息。" };
  if (code === "AUTH_UPSTREAM_UNAVAILABLE" || code === "AUTH_UPSTREAM_ERROR") return { title: "暂时无法验证登录状态", description: "身份服务暂时不可用，请稍后再试。" };
  if (code === "INVALID_CHAT_REQUEST") return { title: "消息格式无效", description: "当前消息格式无法发送，请刷新页面后再试。" };
  return { title: "消息发送失败", description: error?.message || "请检查网络与 chat 服务状态，然后重试。" };
}

function AgentConversation({
  accessToken,
  currentMemo,
  initialMessages,
  memoTree,
  onApplyOrganize,
  onBusyChange,
  onPrepareMutation,
  onRejectOrganize,
  onReferencesChange,
  onThreadUpdated,
  organizeReviewBusy,
  organizeRun,
  thread,
}: ConversationProps) {
  const [inputValue, setInputValue] = useState("");
  const [sources, setSources] = useState<ComposerSource[]>([]);
  const [suppressedCurrentMemoId, setSuppressedCurrentMemoId] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [respondingApprovalId, setRespondingApprovalId] = useState<string | null>(null);
  // 客户端工具 (Worker 规划 + createAiCommand) 执行中: 流已结束但会话不空闲
  const [clientToolsRunning, setClientToolsRunning] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const manuallyApprovedToolCalls = useRef(new Set<string>());
  const memoToolExecutions = useRef(new Map<string, Promise<unknown>>());
  const respondingApprovalIds = useRef(new Set<string>());
  const settledApprovalIds = useRef(new Set<string>());
  const recoveredToolCalls = useRef(new Set<string>());
  const messagesRef = useRef<SuperNoteUIMessage[]>(initialMessages);
  const transport = useMemo(
    () => createMemoChatTransport(thread.id),
    [thread.id],
  );
  const clientTools = useMemo(() => createAgentClientTools(), []);
  const reconcileAiCommand = useMemoTreeStore((state) => state.reconcileAiCommand);
  const rollbackAiToolCall = useMemoTreeStore((state) => state.rollbackAiToolCall);
  const pinnedIds = thread.references.map((reference) => reference.memo_id);
  const { bodyHitIds: mentionBodyHitIds } =
    useMemoSearch(accessToken, memoTree, mentionQuery, 20);
  const mentionResults = useMemo(
    () => getMentionResults(
      memoTree,
      mentionQuery,
      sources.map((source) => source.id),
      mentionBodyHitIds,
    ),
    [memoTree, mentionBodyHitIds, mentionQuery, sources],
  );
  const inlineMentions = useMemo(
    () => sources
      .filter((source) => source.manual)
      .map((source) => ({ id: source.id, label: source.title })),
    [sources],
  );
  const visibleContextSources = sources.filter((source) => source.current || source.pinned);

  useEffect(() => {
    if (suppressedCurrentMemoId !== null && currentMemo?.id !== suppressedCurrentMemoId) {
      setSuppressedCurrentMemoId(null);
    }
  }, [currentMemo?.id, suppressedCurrentMemoId]);

  useEffect(() => {
    setSources((current) => reconcileComposerSources(
      current,
      memoTree,
      currentMemo?.node_type === "memo" ? currentMemo.id : null,
      pinnedIds,
      suppressedCurrentMemoId,
    ));
  }, [currentMemo?.id, memoTree, pinnedIds.join("|"), suppressedCurrentMemoId]);
  const {
    addToolApprovalResponse,
    addToolResult,
    clearError,
    error,
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat<SuperNoteUIMessage>({
    id: thread.id,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ message }) => {
      // 客户端工具执行期间必须计入 busy: 流已结束 (status=ready), 但 Worker
      // 规划 + createAiCommand 两次网络往返还在跑。这几百毫秒内切换会话会
      // 卸载 AgentConversation —— command 已落库、树已改变, tool result 永久
      // 丢失, assistant 回复永远停在 input-available (根因 13)。
      setClientToolsRunning(true);
      void executePendingClientTools(message)
        .finally(() => {
          setClientToolsRunning(false);
          onThreadUpdated();
        });
    },
  });
  messagesRef.current = messages;

  async function executePendingClientTools(message: SuperNoteUIMessage) {
    const pending = message.parts.filter(isToolUIPart).filter((part) =>
      part.state === "input-available"
      && isAgentClientToolName(clientTools, getToolName(part))
    );
    await Promise.all(pending.map((part) => executeClientToolPart(part)));
  }

  async function executeClientToolPart(
    part: AgentToolPart,
    durableBaseMessages?: readonly SuperNoteUIMessage[],
  ) {
    if (!isToolUIPart(part)) return;
    const toolName = getToolName(part);
    if (!isAgentClientToolName(clientTools, toolName)) return;
    try {
      const normalizedInput = normalizeToolInput(part.input);
      let execution = memoToolExecutions.current.get(part.toolCallId);
      if (execution === undefined) {
        execution = isMemoClientToolName(toolName)
          ? requestMemoToolPlan(
              toolName,
              parseAgentClientToolInput(clientTools, toolName, normalizedInput),
              part.toolCallId,
            ).then((plan) => executeMemoToolPlan({
              accessToken,
              manuallyApproved: manuallyApprovedToolCalls.current.has(part.toolCallId),
              plan,
              threadId: thread.id,
              toolCallId: part.toolCallId,
            }))
          : executeAgentClientTool(clientTools, toolName, normalizedInput);
        memoToolExecutions.current.set(part.toolCallId, execution);
      }
      const output = await execution;
      const completedMessages = durableBaseMessages === undefined
        ? undefined
        : applyToolOutput(durableBaseMessages, part.toolCallId, {
            output,
            state: "output-available",
          });
      if (completedMessages !== undefined) {
        try {
          await syncAiMessages(accessToken, thread.id, completedMessages);
        } catch {
          // addToolResult 随后的续写仍会携带完整消息；若网络持续失败，刷新恢复会按 toolCallId 幂等补齐。
        }
      }
      await addToolResult({ output, tool: toolName, toolCallId: part.toolCallId });
    } catch (toolError) {
      const errorText = toolError instanceof Error ? toolError.message : "客户端工具执行失败。";
      const completedMessages = durableBaseMessages === undefined
        ? undefined
        : applyToolOutput(durableBaseMessages, part.toolCallId, {
            errorText,
            state: "output-error",
          });
      if (completedMessages !== undefined) {
        try {
          await syncAiMessages(accessToken, thread.id, completedMessages);
        } catch {
          // 交由后续 chat 请求或刷新恢复重试，不能因审计同步失败再次执行非幂等 UI 更新。
        }
      }
      await addToolResult({
        errorText,
        state: "output-error",
        tool: toolName,
        toolCallId: part.toolCallId,
      });
    }
  }
  const streamBusy = status === "submitted" || status === "streaming";
  const busy = streamBusy || respondingApprovalId !== null || clientToolsRunning;
  const lastMessage = messages.at(-1);
  const activity = deriveAssistantActivity(
    status,
    lastMessage?.role === "assistant" ? lastMessage : undefined,
  );
  const liveAssistantIndex = lastMessage?.role === "assistant" ? messages.length - 1 : -1;
  const liveAssistantMessage = liveAssistantIndex >= 0 ? messages[liveAssistantIndex] : undefined;
  const pendingApproval = findPendingApproval(messages);
  const displayMessages = useMemo(
    () => coalesceAssistantMessages(messages),
    [messages],
  );
  const displayLastMessage = displayMessages.at(-1);
  const displayLiveAssistantIndex = displayLastMessage?.role === "assistant"
    ? displayMessages.length - 1
    : -1;
  const errorCopy = getErrorCopy(error);

  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        const toolName = normalizeAgentToolName(getToolName(part));
        const isWrite = toolName === "edit_node" || toolName === "edit_memo";
        if (part.state === "output-available") {
          const command = readCommandOutput(part.output);
          if (command !== null) reconcileAiCommand(command);
        }
        if (!isWrite) continue;
        if ((part.state === "approval-responded" && !part.approval.approved)
          || part.state === "output-error"
          || part.state === "output-denied") {
          rollbackAiToolCall(part.toolCallId);
        }
      }
    }
  }, [messages, reconcileAiCommand, rollbackAiToolCall]);

  function respondToApproval(id: string, approved: boolean) {
    if (respondingApprovalIds.current.has(id) || settledApprovalIds.current.has(id)) return;

    const previousMessages = messagesRef.current;
    const approvalPart = findPendingApproval(previousMessages);
    const respondedMessages = applyApprovalResponse(previousMessages, id, approved);
    if (approvalPart === undefined
      || approvalPart.approval.id !== id
      || respondedMessages === undefined) return;

    respondingApprovalIds.current.add(id);
    setRespondingApprovalId(id);
    setApprovalError(null);

    void (async () => {
      await addToolApprovalResponse({ id, approved });
      await syncAiMessages(accessToken, thread.id, respondedMessages);
      settledApprovalIds.current.add(id);

      if (approved) {
        manuallyApprovedToolCalls.current.add(approvalPart.toolCallId);
        await executeClientToolPart(approvalPart, respondedMessages);
      } else {
        manuallyApprovedToolCalls.current.delete(approvalPart.toolCallId);
        rollbackAiToolCall(approvalPart.toolCallId);
      }
      await onThreadUpdated();
    })().catch(() => {
      if (!settledApprovalIds.current.has(id)) {
        setMessages(previousMessages);
        setApprovalError("确认结果未能保存，请检查网络后重试。");
      }
    }).finally(() => {
      respondingApprovalIds.current.delete(id);
      setRespondingApprovalId((current) => current === id ? null : current);
    });
  }

  useEffect(() => {
    const recoverable = findApprovedPendingTools(messages);
    for (const part of recoverable) {
      if (!isAgentClientToolName(clientTools, getToolName(part))
        || recoveredToolCalls.current.has(part.toolCallId)
        || respondingApprovalIds.current.has(part.approval.id)) continue;

      recoveredToolCalls.current.add(part.toolCallId);
      manuallyApprovedToolCalls.current.add(part.toolCallId);
      void executeClientToolPart(part, messages);
    }
  }, [clientTools, messages]);

  const undoAssistantTurn = useCallback(async (commands: readonly AiCommand[]) => {
    for (const command of reverseCommandsForUndo(commands)) {
      reconcileAiCommand(await undoAiCommand(accessToken, command.id));
    }
  }, [accessToken, reconcileAiCommand]);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior) => {
    const list = messageListRef.current;
    if (list) list.scrollTo({ behavior, top: list.scrollHeight });
  }, []);
  useEffect(() => scrollToLatest(status === "streaming" ? "auto" : "smooth"), [messages, scrollToLatest, status]);

  // 稳定引用: 内联箭头函数每次渲染都是新引用, 会让下游 memo 全部失效
  const scrollToLatestAuto = useCallback(() => scrollToLatest("auto"), [scrollToLatest]);

  const handleStop = useCallback(() => {
    cancelCelebration();
    void stop();
    composerRef.current?.focus({ preventScroll: true });
  }, [stop]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (mentionOpen && !event.nativeEvent.isComposing) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((current) => {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          return mentionResults.length === 0
            ? 0
            : (current + delta + mentionResults.length) % mentionResults.length;
        });
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && mentionResults[mentionIndex]) {
        event.preventDefault();
        const selected = mentionResults[mentionIndex];
        setSources((current) => addComposerSource(current, selected));
        setInputValue((current) => mentionStart === null ? current : current.slice(0, mentionStart));
        setMentionOpen(false);
        setMentionStart(null);
        setMentionQuery("");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        setMentionStart(null);
        setMentionQuery("");
        return;
      }
    }
    if (!isComposerSubmitKey({
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      isComposing: event.nativeEvent.isComposing,
      key: event.key,
      keyCode: event.nativeEvent.keyCode,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    })) return;
    event.preventDefault();
    if (canSubmitComposer(inputValue, busy)) event.currentTarget.closest("form")?.requestSubmit();
  }, [busy, inputValue, mentionIndex, mentionOpen, mentionResults, mentionStart]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setSources((current) => syncManualComposerSources(current, value));
    const match = value.match(/(?:^|\s)@([^\s@]*)$/u);
    if (match === null || sources.length >= MAX_COMPOSER_SOURCES) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }
    const start = value.lastIndexOf("@", value.length - (match[1]?.length ?? 0) - 1);
    setMentionStart(start);
    setMentionQuery(match[1] ?? "");
    setMentionIndex(0);
    setMentionOpen(true);
  }, [sources.length]);

  const selectMention = useCallback((mention: MentionResult) => {
    setSources((current) => addComposerSource(current, mention));
    setInputValue((current) => {
      if (mentionStart === null) return current;
      const mentionEnd = mentionStart + mentionQuery.length + 1;
      const suffix = current.slice(mentionEnd).replace(/^\s+/u, "");
      return `${current.slice(0, mentionStart)}@${mention.title} ${suffix}`;
    });
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    composerRef.current?.focus();
  }, [mentionQuery.length, mentionStart]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = inputValue.trim();
    if (!canSubmitComposer(inputValue, busy)) return;
    clearError();
    try {
      await onPrepareMutation();
    } catch {
      return;
    }
    setInputValue("");
    setMentionOpen(false);
    setMentionStart(null);
    const frozen = buildFrozenComposerContext(
      sources,
      useMemoTreeStore.getState().nodes,
    );
    setSuppressedCurrentMemoId(null);
    setSources((current) => settleComposerSourcesAfterSend(current));
    try {
      await sendMessage({
        text,
        metadata: {
          context: frozen.context,
          context_display: frozen.display,
        },
      });
    } catch {
      // useChat 维护 error；服务端完整消息同步会在下一请求修复状态。
    }
  }

  return (
    <div className="agent-panel-body">
      <div aria-busy={busy} aria-live="polite" className="agent-message-list" ref={messageListRef} role="log">
        {displayMessages.map((message, index) => index === displayLiveAssistantIndex ? null : (
          <ChatMessage activity="none" key={message.id} message={message} onProgress={scrollToLatestAuto} onUndo={undoAssistantTurn} />
        ))}
        {busy || liveAssistantMessage ? (
          <LiveAssistantTurn activity={activity} key="live-assistant" message={displayLiveAssistantIndex >= 0 ? displayMessages[displayLiveAssistantIndex] : undefined} onProgress={scrollToLatestAuto} onUndo={undoAssistantTurn} />
        ) : null}
      </div>
      {error ? (
        <div className="agent-error-state" role="alert"><WarningCircleIcon aria-hidden="true" size={16} /><div><strong>{errorCopy.title}</strong><p>{errorCopy.description}</p></div></div>
      ) : null}
      {approvalError ? (
        <div className="agent-error-state" role="alert"><WarningCircleIcon aria-hidden="true" size={16} /><div><strong>确认失败</strong><p>{approvalError}</p></div></div>
      ) : null}
      {pendingApproval !== undefined ? (
        pendingApproval.approval.id !== respondingApprovalId
          ? <ApprovalCard onApproval={respondToApproval} part={pendingApproval} />
          : null
      ) : respondingApprovalId === null ? (
        <OrganizeReviewCard busy={organizeReviewBusy} onApply={onApplyOrganize} onReject={onRejectOrganize} run={organizeRun} />
      ) : null}
      <form className="agent-composer" onSubmit={handleSubmit}>
        {mentionOpen ? <MentionMenu activeIndex={mentionIndex} onSelect={selectMention} results={mentionResults} /> : null}
        {visibleContextSources.length > 0 ? <div className="agent-composer-sources">{visibleContextSources.map((source) => {
          return <span key={source.id}><AtIcon size={14} /><strong>{source.title}</strong><button aria-label={`${source.pinned ? "取消置顶" : "置顶引用"} ${source.title}`} onClick={() => void onReferencesChange(source.pinned ? pinnedIds.filter((id) => id !== source.id) : [...pinnedIds, source.id])} type="button"><PushPinIcon fill={source.pinned ? "currentColor" : "none"} size={14} /></button><button aria-label={`移除引用 ${source.title}`} onClick={() => void (async () => { if (source.pinned) await onReferencesChange(pinnedIds.filter((id) => id !== source.id)); if (source.current) setSuppressedCurrentMemoId(source.id); setSources((current) => current.filter((item) => item.id !== source.id)); })()} type="button"><XIcon size={14} /></button></span>;
        })}</div> : null}
        <MentionInput aria-label="输入消息" className="agent-chat-input" mentions={inlineMentions} onKeyDown={handleComposerKeyDown} onValueChange={handleInputChange} placeholder="输入消息，@ 引用笔记…" ref={composerRef} value={inputValue} />
        <div className="agent-composer-footer">
          <PermissionModeControl accessToken={accessToken} busy={busy} compact />
          {streamBusy ? (
            <Button aria-label="停止生成" className="agent-composer-action" icon={StopIcon} onClick={handleStop} size="square" type="button" variant="primary" />
          ) : (
            <Button aria-label="发送消息" className="agent-composer-action" disabled={!canSubmitComposer(inputValue, busy)} icon={ArrowUpIcon} size="square" type="submit" variant="primary" />
          )}
        </div>
      </form>
    </div>
  );
}

export function AgentPanel(props: AgentPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const threads = useAiThreads({ accessToken: props.accessToken, userId: props.userId });
  const actionBusy = props.organizeBusy
    || chatBusy
    || threads.mutating
    || props.organizeRun?.status === "planning"
    || props.organizeRun?.status === "applying";
  const thread = threads.selectedThread;
  const visibleOrganizeRun = props.organizeRun?.memo_id === props.currentMemo?.id
    ? props.organizeRun
    : null;

  useEffect(() => {
    props.onSelectedThreadChange(thread?.id ?? null);
  }, [props.onSelectedThreadChange, thread?.id]);

  return (
    <aside aria-label="备忘录助手" className="agent-panel">
      <header className="agent-panel-header">
        <div className="agent-panel-heading">
          <Button aria-label="会话历史" aria-pressed={historyOpen} className="agent-panel-header-button" disabled={chatBusy} icon={MenuIcon} onClick={() => setHistoryOpen((open) => !open)} size="square" variant="ghost" />
          <p className="agent-panel-title">{thread?.title ?? "新对话"}</p>
        </div>
        <div className="agent-panel-header-actions">
          <Button aria-label="新对话" className="agent-panel-header-button" disabled={actionBusy || threads.loading} icon={NewConversationIcon} onClick={() => void threads.createThread()} size="square" variant="ghost" />
          <Button aria-label="收起 AI 面板" className="agent-panel-header-button" icon={AssistantPanelCloseIcon} onClick={props.onClose} size="square" variant="ghost" />
        </div>
      </header>
      {historyOpen ? (
        <ThreadHistory busy={actionBusy} onClose={() => setHistoryOpen(false)} onDelete={threads.removeThread} onRename={(id, title) => threads.patchThread(id, { title })} onSelect={async (id) => { await threads.selectThread(id); setHistoryOpen(false); }} selectedId={thread?.id ?? null} threads={threads.threads} />
      ) : thread === null ? (
        <div className="agent-panel-loading">{threads.loading ? "正在恢复会话…" : "会话加载失败，请重新打开面板。"}</div>
      ) : (
        <AgentConversation accessToken={props.accessToken} currentMemo={props.currentMemo} initialMessages={threads.messages} key={thread.id} memoTree={props.memoTree} onApplyOrganize={props.onApplyOrganize} onBusyChange={setChatBusy} onPrepareMutation={props.onPrepareMutation} onReferencesChange={threads.replaceReferences} onRejectOrganize={props.onRejectOrganize} onThreadUpdated={threads.refreshSelected} organizeReviewBusy={actionBusy} organizeRun={visibleOrganizeRun} thread={thread} />
      )}
    </aside>
  );
}
