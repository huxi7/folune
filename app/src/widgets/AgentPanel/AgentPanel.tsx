/**
 * [INPUT]: 依赖 useAiThreads、类型化 useChat/原生审批、统一 Composer sources、Worker 胖工具链、WorkspaceChrome 关闭命令、权限/History/Organize 视图与 Dashboard 草稿协调边界
 * [OUTPUT]: 对外提供当前笔记默认 @、冻结上下文、键盘 @搜索、阻塞审批弹窗、流完成后工具执行、乐观命令/整轮逆序撤销对账、会话恢复及停止 SSE/礼花的 AI Native 右侧工作区
 * [POS]: /app 右侧 AI Native V2 组合根；工具参数流结束且批准后才进入 Worker，api command 是唯一写事实源，Store 只做幂等投影与回滚
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useChat } from "@ai-sdk/react";
import { Button } from "@cloudflare/kumo/components/button";
import { InputArea } from "@cloudflare/kumo/components/input";
import {
  ArrowUpIcon,
  AtIcon,
  ChatsIcon,
  PlusIcon,
  PushPinIcon,
  StopIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
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
  undoAiCommand,
  type AiCommand,
  type AiRun,
  type AiThreadDetail,
  type SuperNoteUIMessage,
} from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import { ThinkingMark } from "../../shared/design-system/components";
import { useWorkspaceChromeStore } from "../../shared/store/workspaceChromeStore";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { deriveAssistantActivity } from "./activityState";
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

type AgentPanelProps = {
  accessToken: string;
  currentMemo: MemoTreeNode | null;
  memoTree: MemoTreeNode[];
  onApplyOrganize: () => Promise<void>;
  onPrepareMutation: () => Promise<void>;
  onRejectOrganize: () => Promise<void>;
  onUndoOrganize: () => Promise<void>;
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
  onPrepareMutation: AgentPanelProps["onPrepareMutation"];
  onReferencesChange: (memoIds: readonly string[]) => Promise<void>;
  onThreadUpdated: () => Promise<void>;
  thread: AiThreadDetail;
};

const readCommandOutput = (value: unknown): AiCommand | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Partial<AiCommand>;
  return typeof command.id === "string" && typeof command.operation === "string"
    && typeof command.status === "string" ? command as AiCommand : null;
};

const turnSources = (
  messages: readonly SuperNoteUIMessage[],
  messageIndex: number,
) => {
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    return message.metadata?.context_snapshot
      ?? message.metadata?.context_display;
  }
  return undefined;
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
  onBusyChange,
  onPrepareMutation,
  onReferencesChange,
  onThreadUpdated,
  thread,
}: ConversationProps) {
  const [inputValue, setInputValue] = useState("");
  const [sources, setSources] = useState<ComposerSource[]>([]);
  const [suppressedCurrentMemoId, setSuppressedCurrentMemoId] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const manuallyApprovedToolCalls = useRef(new Set<string>());
  const memoToolExecutions = useRef(new Map<string, Promise<unknown>>());
  const transport = useMemo(
    () => createMemoChatTransport(thread.id),
    [thread.id],
  );
  const clientTools = useMemo(() => createAgentClientTools(), []);
  const reconcileAiCommand = useMemoTreeStore((state) => state.reconcileAiCommand);
  const rollbackAiToolCall = useMemoTreeStore((state) => state.rollbackAiToolCall);
  const pinnedIds = thread.references.map((reference) => reference.memo_id);
  const mentionResults = useMemo(
    () => getMentionResults(
      memoTree,
      mentionQuery,
      sources.map((source) => source.id),
    ),
    [memoTree, mentionQuery, sources],
  );

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
    status,
    stop,
  } = useChat<SuperNoteUIMessage>({
    id: thread.id,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ message }) => {
      void executePendingClientTools(message).finally(onThreadUpdated);
    },
  });

  async function executePendingClientTools(message: SuperNoteUIMessage) {
    const pending = message.parts.filter(isToolUIPart).filter((part) =>
      part.state === "input-available"
      && isAgentClientToolName(clientTools, getToolName(part))
    );
    await Promise.all(pending.map(executeClientToolPart));
  }

  async function executeClientToolPart(part: Extract<SuperNoteUIMessage["parts"][number], { toolCallId: string }>) {
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
      await addToolResult({ output, tool: toolName, toolCallId: part.toolCallId });
    } catch (toolError) {
      await addToolResult({
        errorText: toolError instanceof Error ? toolError.message : "客户端工具执行失败。",
        state: "output-error",
        tool: toolName,
        toolCallId: part.toolCallId,
      });
    }
  }
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const activity = deriveAssistantActivity(
    status,
    lastMessage?.role === "assistant" ? lastMessage : undefined,
  );
  const liveAssistantIndex = lastMessage?.role === "assistant" ? messages.length - 1 : -1;
  const liveAssistantMessage = liveAssistantIndex >= 0 ? messages[liveAssistantIndex] : undefined;
  const pendingApprovalId = lastMessage?.role === "assistant"
    ? [...lastMessage.parts].reverse()
      .find((part) => isToolUIPart(part) && part.state === "approval-requested")
      ?.approval.id
    : undefined;
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

  const respondToApproval = useCallback((id: string, approved: boolean) => {
    const approvalPart = messages.flatMap((message) => message.parts)
      .find((part) => isToolUIPart(part)
        && "approval" in part
        && part.approval?.id === id);
    const toolCallId = approvalPart !== undefined && isToolUIPart(approvalPart)
      ? approvalPart.toolCallId
      : id;
    if (approved) manuallyApprovedToolCalls.current.add(toolCallId);
    else {
      manuallyApprovedToolCalls.current.delete(toolCallId);
      rollbackAiToolCall(toolCallId);
    }
    void Promise.resolve(addToolApprovalResponse({ id, approved })).then(() => {
      if (approved && approvalPart !== undefined && isToolUIPart(approvalPart)) {
        return executeClientToolPart(approvalPart);
      }
    });
  }, [addToolApprovalResponse, messages, rollbackAiToolCall]);

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

  const handleStop = useCallback(() => {
    cancelCelebration();
    void stop();
    composerRef.current?.focus({ preventScroll: true });
  }, [stop]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionStart !== null && !event.nativeEvent.isComposing) {
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
        setInputValue((current) => current.slice(0, mentionStart));
        setMentionStart(null);
        setMentionQuery("");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
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
    if (canSubmitComposer(inputValue, busy)) event.currentTarget.form?.requestSubmit();
  }, [busy, inputValue, mentionIndex, mentionResults, mentionStart]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    const match = value.match(/(?:^|\s)@([^\s@]*)$/u);
    if (match === null || sources.length >= MAX_COMPOSER_SOURCES) {
      setMentionStart(null);
      setMentionQuery("");
      return;
    }
    const start = value.lastIndexOf("@", value.length - (match[1]?.length ?? 0) - 1);
    setMentionStart(start);
    setMentionQuery(match[1] ?? "");
    setMentionIndex(0);
  }, [sources.length]);

  const selectMention = useCallback((mention: MentionResult) => {
    setSources((current) => addComposerSource(current, mention));
    setInputValue((current) => mentionStart === null ? current : current.slice(0, mentionStart));
    setMentionStart(null);
    setMentionQuery("");
    composerRef.current?.focus();
  }, [mentionStart]);

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
        {displayMessages.length === 0 ? (
          <div className="agent-empty-state">
            <div className="agent-empty-mark"><ThinkingMark aria-hidden="true" size={20} /></div>
            <strong>想从哪条备忘录开始？</strong>
            <p>你可以让我梳理思路、润色文字，或直接聊聊刚记下的内容。</p>
          </div>
        ) : displayMessages.map((message, index) => index === displayLiveAssistantIndex ? null : (
          <ChatMessage activity="none" approvalId={pendingApprovalId} key={message.id} message={message} onApproval={respondToApproval} onProgress={() => scrollToLatest("auto")} onUndo={undoAssistantTurn} sources={turnSources(displayMessages, index)} />
        ))}
        {busy || liveAssistantMessage ? (
          <LiveAssistantTurn activity={activity} approvalId={pendingApprovalId} key="live-assistant" message={displayLiveAssistantIndex >= 0 ? displayMessages[displayLiveAssistantIndex] : undefined} onApproval={respondToApproval} onProgress={() => scrollToLatest("auto")} onUndo={undoAssistantTurn} sources={turnSources(displayMessages, displayLiveAssistantIndex >= 0 ? displayLiveAssistantIndex : displayMessages.length)} />
        ) : null}
      </div>
      {error ? (
        <div className="agent-error-state" role="alert"><WarningCircleIcon aria-hidden="true" size={17} weight="fill" /><div><strong>{errorCopy.title}</strong><p>{errorCopy.description}</p></div></div>
      ) : null}
      <form className="agent-composer" onSubmit={handleSubmit}>
        {mentionStart !== null ? <MentionMenu activeIndex={mentionIndex} onSelect={selectMention} results={mentionResults} /> : null}
        {sources.length > 0 ? <div className="agent-composer-sources">{sources.map((source) => {
          return <span key={source.id}><AtIcon size={12} />{source.title}<button aria-label={`${source.pinned ? "取消置顶" : "置顶引用"} ${source.title}`} onClick={() => void onReferencesChange(source.pinned ? pinnedIds.filter((id) => id !== source.id) : [...pinnedIds, source.id])} type="button"><PushPinIcon size={11} weight={source.pinned ? "fill" : "regular"} /></button><button aria-label={`移除引用 ${source.title}`} onClick={() => void (async () => { if (source.pinned) await onReferencesChange(pinnedIds.filter((id) => id !== source.id)); if (source.current) setSuppressedCurrentMemoId(source.id); setSources((current) => current.filter((item) => item.id !== source.id)); })()} type="button"><XIcon size={11} /></button></span>;
        })}</div> : null}
        <InputArea aria-label="输入消息" autoResize className="agent-chat-input" enterKeyHint="send" maxRows={6} minRows={1} onKeyDown={handleComposerKeyDown} onValueChange={handleInputChange} placeholder="输入消息，@ 引用笔记…" ref={composerRef} size="base" value={inputValue} />
        {busy ? (
          <Button aria-label="停止生成" className="agent-composer-action" icon={StopIcon} onClick={handleStop} shape="circle" size="base" type="button" variant="primary" />
        ) : (
          <Button aria-label="发送消息" className="agent-composer-action" disabled={!canSubmitComposer(inputValue, busy)} icon={ArrowUpIcon} shape="circle" size="base" type="submit" variant="primary" />
        )}
      </form>
    </div>
  );
}

export function AgentPanel(props: AgentPanelProps) {
  const closePanel = useWorkspaceChromeStore((state) => state.closeAssistant);
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
          <div className="agent-panel-mark"><ThinkingMark aria-hidden="true" size={16} /></div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{thread?.title ?? "备忘录助手"}</p><p className="text-xs text-muted-foreground">SuperNote AI</p></div>
        </div>
        <div className="agent-panel-header-actions">
          <PermissionModeControl accessToken={props.accessToken} busy={actionBusy} />
          <Button aria-label="新会话" disabled={actionBusy || threads.loading} icon={PlusIcon} onClick={() => void threads.createThread()} shape="square" size="sm" variant="ghost" />
          <Button aria-label="历史会话" disabled={chatBusy} icon={ChatsIcon} onClick={() => setHistoryOpen((open) => !open)} shape="square" size="sm" variant={historyOpen ? "secondary" : "ghost"} />
          <Button aria-label="关闭备忘录助手" className="agent-panel-close" icon={XIcon} onClick={closePanel} shape="square" size="sm" variant="ghost" />
        </div>
      </header>
      {historyOpen ? (
        <ThreadHistory active={threads.activeThreads} archived={threads.archivedThreads} busy={actionBusy} onArchive={threads.archiveThread} onClose={() => setHistoryOpen(false)} onDelete={threads.removeThread} onRename={(id, title) => threads.patchThread(id, { title })} onRestore={threads.restoreThread} onSelect={async (id) => { await threads.selectThread(id); setHistoryOpen(false); }} selectedId={thread?.id ?? null} />
      ) : thread === null ? (
        <div className="agent-panel-loading">{threads.loading ? "正在恢复会话…" : "会话加载失败，请重新打开面板。"}</div>
      ) : (
        <>
          <OrganizeReviewCard busy={actionBusy} onApply={props.onApplyOrganize} onReject={props.onRejectOrganize} onUndo={props.onUndoOrganize} run={visibleOrganizeRun} />
          <AgentConversation accessToken={props.accessToken} currentMemo={props.currentMemo} initialMessages={threads.messages} key={thread.id} memoTree={props.memoTree} onBusyChange={setChatBusy} onPrepareMutation={props.onPrepareMutation} onReferencesChange={threads.replaceReferences} onThreadUpdated={threads.refreshSelected} thread={thread} />
        </>
      )}
    </aside>
  );
}
