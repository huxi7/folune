/**
 * [INPUT]: 依赖 locale、账号权限确认、useConversationScroll、DS 原语、useAiThreads、useChat/审批及既有工具执行边界
 * [OUTPUT]: 对外提供常驻 AgentConversation 与真实处理/审批/完成状态；只读工具参数到齐即并发执行，写工具经过流末审批门禁后最多八项并发，停止取消排队、保存本批结果并阻断自动续写；整轮活动跨客户端工具/审批/续写持续，消息定点同步并以本地快照快速回显
 * [POS]: AgentPanel 的单会话执行与输入边界；新对话立即进入本地草稿，首发创建期间保持同一 useChat 与消息实例；历史只负责导航，目标会话加载/失败在内容窗承接；api command 是唯一写事实源，Store 只做幂等投影与回滚
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useConversationScroll } from "./useConversationScroll";
import {
} from "../../shared/design-system/components";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { motion, useIsPresent } from "motion/react";
import { contentEntranceVariants } from "../../shared/design-system/motion";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUpIcon,
  AtIcon,
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
  syncAiMessage,
  undoAiCommand,
  type AiCommand,
  type AiRun,
  type AiThreadDetail,
  type FoluneUIMessage,
} from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import { Button, MentionInput } from "../../shared/design-system/components";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { useAgentPanelStore, isPermissionReady } from "../../shared/store/agentPanelStore";
import { deriveAssistantActivity, hasAssistantContinuation, type AgentPresence } from "./activityState";
import {
  applyApprovalResponse,
  applyToolOutput,
  findPendingApproval,
  type AgentToolPart,
} from "./approvalState";
import { ApprovalCard } from "./ApprovalCard";
import { cancelCelebration } from "./celebration";
import { ChatMessage, LiveAssistantTurn } from "./ChatMessage";
import { getErrorCopy } from "./chatErrorCopy";
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
import { findRecoverableTools } from "./batchRecovery";
import { createBatchCheckpointer } from "./batchCheckpoint";
import { executeBatch, prepareBatch } from "./batchToolExecution";
import { ToolExecutionContext, createToolExecutionStore, readBatchSnapshot, readToolCommands } from "./toolExecutionState";
import { createClientToolQueue } from "./clientToolQueue";
import { executeMemoToolPlan } from "./memoToolExecution";
import { planMemoTool } from "./memoToolPlanner";
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
import { normalizeAgentToolName } from "./toolPresentation";
import { useMemoSearch } from "../useMemoSearch";
import { useLocale } from "../../shared/locale";
type ConversationProps = {
  onPresenceChange?: (presence: AgentPresence) => void;
  accessToken: string;
  currentMemo: MemoTreeNode | null;
  initialMessages: FoluneUIMessage[];
  memoTree: readonly MemoTreeNode[];
  onBusyChange: (busy: boolean) => void;
  onApplyOrganize: () => Promise<void>;
  onPrepareMutation: () => Promise<void>;
  onRejectOrganize: () => Promise<void>;
  onReferencesChange: (memoIds: readonly string[]) => Promise<void>;
  onThreadUpdated: (messages?: readonly FoluneUIMessage[]) => Promise<void>;
  organizeReviewBusy: boolean;
  organizeRun: AiRun | null;
  thread: AiThreadDetail | null;
  conversationKey: string;
  pinnedIds: readonly string[];
  onEnsureThread: () => Promise<string>;
  userId: string;
};
export function AgentConversation({
  onPresenceChange,
  accessToken,
  currentMemo,
  conversationKey,
  initialMessages,
  onEnsureThread,
  pinnedIds,
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
  userId,
}: ConversationProps) {
  const { t, locale } = useLocale();
  const [inputValue, setInputValue] = useState("");
  const reduceMotion = Boolean(useMotionPreference());
  const present = useIsPresent();
  const [sources, setSources] = useState<ComposerSource[]>([]);
  const [suppressedCurrentMemoId, setSuppressedCurrentMemoId] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [respondingApprovalId, setRespondingApprovalId] = useState<string | null>(null);
  // 客户端工具 (客户端规划 + createAiCommand) 执行中: 流已结束但会话不空闲
  const [clientToolsRunning, setClientToolsRunning] = useState(false);
  const [turnContinuing, setTurnContinuing] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conversationKey.startsWith("draft")) composerRef.current?.focus({ preventScroll: true });
  }, [conversationKey]);
  const manuallyApprovedToolCalls = useRef(new Set<string>());
  const executionStore = useMemo(() => createToolExecutionStore(), []);
  const toolQueue = useMemo(() => createClientToolQueue(), []);
  const turnStopped = useRef(false);
  const toolBatchCount = useRef(0);
  const memoToolExecutions = useRef(new Map<string, Promise<unknown>>());
  const respondingApprovalIds = useRef(new Set<string>());
  const settledApprovalIds = useRef(new Set<string>());
  const recoveredToolCalls = useRef(new Set<string>());
  const reconciledToolStates = useRef(new Map<string, string>());
  const initialReconciliationDone = useRef(false);
  const previousMessageCount = useRef(0);
  const messagesRef = useRef<FoluneUIMessage[]>(initialMessages);
  const threadIdRef = useRef(thread?.id ?? null);
  if (thread !== null) threadIdRef.current = thread.id;
  const transport = useMemo(() => createMemoChatTransport(async () => {
    const id = await onEnsureThread();
    threadIdRef.current = id;
    return id;
  }), [onEnsureThread]);
  const clientTools = useMemo(() => createAgentClientTools(), []);
  const reconcileAiCommand = useMemoTreeStore((state) => state.reconcileAiCommand);
  const rollbackAiToolCall = useMemoTreeStore((state) => state.rollbackAiToolCall);
  const currentMemoSourceId = currentMemo?.node_type === "memo"
    ? currentMemo.id
    : null;
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
      currentMemoSourceId,
      pinnedIds,
      suppressedCurrentMemoId,
    ));
  }, [currentMemoSourceId, memoTree, pinnedIds, suppressedCurrentMemoId]);
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
  } = useChat<FoluneUIMessage>({
    id: conversationKey,
    messages: initialMessages,
    transport,
    experimental_throttle: 32,
    sendAutomaticallyWhen: (options) => !turnStopped.current && lastAssistantMessageIsCompleteWithToolCalls(options),
    onToolCall: ({ toolCall }) => {
      // 只读 I/O 与剩余模型流、审批和落账重叠；不 await 阻塞 SDK 消费下一个调用。
      // 结果仍由 onFinish 统一发布，停止/失败时不把迟到结果写进下一条消息。
      if (toolCall.toolName === "read_tree" || toolCall.toolName === "read_memo") {
        void getClientToolExecution({
          type: "dynamic-tool", toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId, input: toolCall.input, state: "input-available",
        }).catch(() => undefined);
      }
    },
    onFinish: ({ message, messages: finishedMessages, isAbort, isError }) => {
      if (isAbort || isError) { turnStopped.current = true; toolQueue.cancelPending(); }
      setTurnContinuing(!turnStopped.current && hasAssistantContinuation(message));
      // 客户端工具执行期间必须计入 busy: 流已结束 (status=ready), 但客户端
      // 规划 + createAiCommand 两次网络往返还在跑。这几百毫秒内切换会话会
      // 卸载 AgentConversation —— command 已落库、树已改变, tool result 永久
      // 丢失, assistant 回复永远停在 input-available (根因 13)。
      toolBatchCount.current++;
      setClientToolsRunning(!turnStopped.current);
      void (turnStopped.current ? Promise.resolve() : executePendingClientTools(message))
        .finally(() => {
          toolBatchCount.current--;
          setClientToolsRunning(toolBatchCount.current > 0);
          if (isAbort || isError) {
            void onThreadUpdated();
            return;
          }
          // AI SDK 给出流结束时的权威快照；只有客户端工具结果已经让 live ref
          // 更完整时才采用它，避免 32ms 节流让 React 落后于最后一帧 SSE。
          const liveMessages = messagesRef.current;
          const hasFinishedAssistant = liveMessages.some(
            (candidate) => candidate.id === message.id,
          );
          void onThreadUpdated(hasFinishedAssistant ? liveMessages : finishedMessages);
        });
    },
  });
  messagesRef.current = messages;
  const checkpointBatch = useMemo(() => createBatchCheckpointer({
    read: () => messagesRef.current,
    write: (next) => { messagesRef.current = next; setMessages(next); },
    persist: (message) => syncAiMessage(accessToken, threadIdRef.current!, message),
  }), [accessToken, setMessages]);
  async function executePendingClientTools(message: FoluneUIMessage) {
    const pending = message.parts.filter(isToolUIPart).filter((part) =>
      part.state === "input-available"
      && isAgentClientToolName(clientTools, getToolName(part))
    );
    const results = await Promise.all(pending.map((part) => executeClientToolPart(part)));
    if (turnStopped.current) {
      let settled = [messagesRef.current.find((candidate) => candidate.id === message.id) ?? message];
      pending.forEach((part, index) => {
        const result = results[index];
        if (result) settled = applyToolOutput(settled, part.toolCallId, result) ?? settled;
      });
      // 停止后没有下一次自动请求替我们落库，必须保存已完成/已取消的真实结果。
      await syncAiMessage(accessToken, threadIdRef.current!, settled[0]!).catch(() => undefined);
    }
  }
  function getClientToolExecution(part: AgentToolPart): Promise<unknown> {
    const existing = memoToolExecutions.current.get(part.toolCallId);
    if (existing !== undefined) return existing;
    const toolName = getToolName(part);
    executionStore.set(part.toolCallId, { state: "queued" });
    const execution = (async () => {
      if (toolName === "edit_nodes") {
        const saved = messagesRef.current.flatMap((message) => message.parts).find((candidate) => candidate.type === "data-tool-batch" && candidate.id === part.toolCallId);
        const snapshot = readBatchSnapshot(saved && "data" in saved ? saved.data : undefined)
          ?? await prepareBatch(part.input, part.toolCallId, useMemoTreeStore.getState().nodes);
        return executeBatch({
          snapshot, queue: toolQueue, stopped: () => turnStopped.current,
          execute: (plan, id) => executeMemoToolPlan({ accessToken, plan, toolCallId: id, threadId: threadIdRef.current!, manuallyApproved: manuallyApprovedToolCalls.current.has(part.toolCallId) }) as Promise<AiCommand>,
          publish: (batch) => executionStore.set(part.toolCallId, { state: "running", batch }),
          checkpoint: (batch) => checkpointBatch(part.toolCallId, batch),
        });
      }
      return toolQueue.run(async () => {
        if (turnStopped.current) throw new Error("操作已停止，尚未执行。");
        executionStore.set(part.toolCallId, { state: "running" });
        if (!isAgentClientToolName(clientTools, toolName)) throw new Error("未知客户端工具。");
        const normalizedInput = normalizeToolInput(part.input);
        return isMemoClientToolName(toolName)
          ? executeMemoToolPlan({ accessToken, manuallyApproved: manuallyApprovedToolCalls.current.has(part.toolCallId),
              plan: planMemoTool(toolName, parseAgentClientToolInput(clientTools, toolName, normalizedInput), useMemoTreeStore.getState().nodes),
              threadId: threadIdRef.current!, toolCallId: part.toolCallId })
          : executeAgentClientTool(clientTools, toolName, normalizedInput);
      });
    })().then((output) => {
      const batch = readBatchSnapshot(output);
      const failed = batch ? batch.items.some((item) => item.state !== "succeeded") : readToolCommands(output).some((command) => command.status !== "succeeded");
      executionStore.set(part.toolCallId, { state: failed ? "failed" : "succeeded", batch });
      return output;
    }, (error) => {
      const previous = executionStore.get(part.toolCallId);
      executionStore.set(part.toolCallId, { state: turnStopped.current ? "cancelled" : "failed", batch: previous?.batch && { ...previous.batch, items: previous.batch.items.map((item) => item.state === "queued" ? { ...item, state: "cancelled" } : item) } });
      throw error;
    });
    memoToolExecutions.current.set(part.toolCallId, execution);
    return execution;
  }
  async function executeClientToolPart(
    part: AgentToolPart,
    durableBaseMessages?: readonly FoluneUIMessage[],
  ) {
    const toolName = getToolName(part);
    if (!isAgentClientToolName(clientTools, toolName)) return;
    try {
      const output = await getClientToolExecution(part);
      const completedMessages = durableBaseMessages === undefined
        ? undefined
        : applyToolOutput(messagesRef.current, part.toolCallId, {
            output,
            state: "output-available",
          });
      if (completedMessages !== undefined) {
        try {
          const assistantMessage = completedMessages.findLast(
            (candidate) => candidate.role === "assistant",
          );
          if (assistantMessage !== undefined) {
            await syncAiMessage(accessToken, threadIdRef.current!, assistantMessage);
          }
        } catch {
          // addToolResult 随后的续写会由服务端按 thread 重建历史；若网络持续失败，
          // 刷新恢复仍会按 toolCallId 幂等补齐。
        }
      }
      await addToolResult({ output, tool: toolName, toolCallId: part.toolCallId });
      if (completedMessages !== undefined) {
        await onThreadUpdated(completedMessages);
      }
      return { output, state: "output-available" as const };
    } catch (toolError) {
      const errorText = toolError instanceof Error ? toolError.message : "客户端工具执行失败。";
      const completedMessages = durableBaseMessages === undefined
        ? undefined
        : applyToolOutput(messagesRef.current, part.toolCallId, {
            errorText,
            state: "output-error",
          });
      if (completedMessages !== undefined) {
        try {
          const assistantMessage = completedMessages.findLast(
            (candidate) => candidate.role === "assistant",
          );
          if (assistantMessage !== undefined) {
            await syncAiMessage(accessToken, threadIdRef.current!, assistantMessage);
          }
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
      if (completedMessages !== undefined) {
        await onThreadUpdated(completedMessages);
      }
      return { errorText, state: "output-error" as const };
    }
  }
  const streamBusy = status === "submitted" || status === "streaming";
  const busy = streamBusy || respondingApprovalId !== null || clientToolsRunning;
  const composerBusy = useAgentPanelStore((state) => !isPermissionReady(state, userId)) || busy;
  const lastMessage = messages.at(-1);
  const activity = deriveAssistantActivity(
    status,
    lastMessage?.role === "assistant" ? lastMessage : undefined,
    turnContinuing || clientToolsRunning || respondingApprovalId !== null,
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
  const errorCopy = getErrorCopy(error, locale);

  useEffect(() => {
    // 首次挂载必须扫完整历史以恢复已落账命令；流式阶段只有末条 assistant
    // 会变化，避免每个文本分块都重新遍历整段会话。
    const latestAssistant = messages.findLast((message) => message.role === "assistant");
    const needsFullReconciliation = !initialReconciliationDone.current
      || (previousMessageCount.current === 0 && messages.length > 0)
      || messages.length < previousMessageCount.current;
    const candidates = !needsFullReconciliation
      ? latestAssistant === undefined ? [] : [latestAssistant]
      : messages;
    initialReconciliationDone.current = true;
    previousMessageCount.current = messages.length;

    for (const message of candidates) {
      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        const previousState = reconciledToolStates.current.get(part.toolCallId);
        if (previousState === part.state) continue;
        reconciledToolStates.current.set(part.toolCallId, part.state);
        const toolName = normalizeAgentToolName(getToolName(part));
        const isWrite = toolName === "edit_node" || toolName === "edit_memo";
        if (part.state === "output-available") {
          for (const command of readToolCommands(part.output)) reconcileAiCommand(command);
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
    setTurnContinuing(true);
    setRespondingApprovalId(id);
    setApprovalError(null);

    void (async () => {
      await addToolApprovalResponse({ id, approved });
      const respondedAssistant = respondedMessages.findLast(
        (candidate) => candidate.role === "assistant",
      );
      if (respondedAssistant !== undefined) {
        await syncAiMessage(accessToken, threadIdRef.current!, respondedAssistant);
      }
      settledApprovalIds.current.add(id);

      if (approved) {
        manuallyApprovedToolCalls.current.add(approvalPart.toolCallId);
        await executeClientToolPart(approvalPart, respondedMessages);
      } else {
        setTurnContinuing(false);
        manuallyApprovedToolCalls.current.delete(approvalPart.toolCallId);
        rollbackAiToolCall(approvalPart.toolCallId);
      }
      await onThreadUpdated(messagesRef.current);
    })().catch(() => {
      setTurnContinuing(false);
      if (!settledApprovalIds.current.has(id)) {
        setMessages(previousMessages);
        setApprovalError("确认结果未能保存，请检查网络后重试。");
      }
    }).finally(() => {
      respondingApprovalIds.current.delete(id);
      setRespondingApprovalId((current) => current === id ? null : current);
    });
  }

  // 恢复扫描只由持久消息与稳定工具表驱动；执行函数使用当轮闭包，放入依赖会让每次 render 重扫。
  // oxlint-disable react-hooks/exhaustive-deps -- recoveredToolCalls 已按 toolCallId 保证幂等
  useEffect(() => {
    if (turnStopped.current) return;
    const recoverable = findRecoverableTools(messages);
    for (const part of recoverable) {
      if (!isAgentClientToolName(clientTools, getToolName(part))
        || memoToolExecutions.current.has(part.toolCallId) || recoveredToolCalls.current.has(part.toolCallId)
        || (part.approval && respondingApprovalIds.current.has(part.approval.id))) continue;

      recoveredToolCalls.current.add(part.toolCallId);
      setTurnContinuing(true);
      if (part.approval?.approved) manuallyApprovedToolCalls.current.add(part.toolCallId);
      toolBatchCount.current++;
      setClientToolsRunning(true);
      void executeClientToolPart(part, messages).finally(() => { toolBatchCount.current--; setClientToolsRunning(toolBatchCount.current > 0); });
    }
  }, [clientTools, messages]);
  // oxlint-enable react-hooks/exhaustive-deps

  const undoAssistantTurn = useCallback(async (commands: readonly AiCommand[]) => {
    for (const command of reverseCommandsForUndo(commands)) {
      reconcileAiCommand(await undoAiCommand(accessToken, command.id));
    }
  }, [accessToken, reconcileAiCommand]);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const workedRef = useRef(false);
  const completedRef = useRef(false);
  useEffect(() => {
    let presence: AgentPresence = "idle";
    if (pendingApproval !== undefined) presence = "approval";
    else if (status === "error") presence = "error";
    else if (busy || turnContinuing) {
      workedRef.current = true;
      completedRef.current = false;
      presence = "working";
    } else if (workedRef.current && !turnStopped.current && lastMessage?.role === "assistant") {
      completedRef.current = true;
      workedRef.current = false;
    }
    if (presence === "idle" && completedRef.current) presence = "complete";
    onPresenceChange?.(presence);
  }, [busy, lastMessage, onPresenceChange, pendingApproval, status, turnContinuing]);

  const { messageListRef, scrollToLatestAuto } = useConversationScroll(messages, status, reduceMotion, present);

  useEffect(() => {
    turnStopped.current = false;
    return () => { turnStopped.current = true; toolQueue.cancelPending(); };
  }, [toolQueue]);

  const handleStop = useCallback(() => {
    turnStopped.current = true;
    toolQueue.cancelPending();
    setTurnContinuing(false);
    cancelCelebration();
    void stop();
    composerRef.current?.focus({ preventScroll: true });
  }, [stop, toolQueue]);

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
    if (canSubmitComposer(inputValue, composerBusy)) event.currentTarget.closest("form")?.requestSubmit();
  }, [composerBusy, inputValue, mentionIndex, mentionOpen, mentionResults, mentionStart]);

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
    if (!canSubmitComposer(inputValue, busy) || !isPermissionReady(useAgentPanelStore.getState(), userId)) return;
    clearError();
    try {
      await onPrepareMutation();
      if (!isPermissionReady(useAgentPanelStore.getState(), userId)) return;
    } catch {
      return;
    }
    turnStopped.current = false;
    setInputValue("");
    setTurnContinuing(true);
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
      // useChat 维护 error；下一次请求或后台校准会把服务端状态重新对齐。
    }
  }
  return (
    <div className="agent-panel-body">
      <ToolExecutionContext.Provider value={executionStore}>
      <div aria-busy={busy} aria-live="polite" className="agent-message-list" ref={messageListRef} role="log">
        {displayMessages.map((message, index) => index === displayLiveAssistantIndex ? null : (
          <ChatMessage activity="none" key={message.id} message={message} onProgress={scrollToLatestAuto} onUndo={undoAssistantTurn} />
        ))}
        {busy || liveAssistantMessage ? (
          <LiveAssistantTurn activity={activity} key="live-assistant" message={displayLiveAssistantIndex >= 0 ? displayMessages[displayLiveAssistantIndex] : undefined} onProgress={scrollToLatestAuto} onUndo={undoAssistantTurn} />
        ) : null}
      </div>
      </ToolExecutionContext.Provider>
      {error ? (
        <div className="agent-error-state" role="alert"><WarningCircleIcon aria-hidden="true" size={16} /><div><strong>{errorCopy.title}</strong><p>{errorCopy.description}</p></div></div>
      ) : null}
      {approvalError ? (
        <div className="agent-error-state" role="alert"><WarningCircleIcon aria-hidden="true" size={16} /><div><strong>{t("确认失败", "Confirmation failed")}</strong><p>{t(approvalError, "Unable to save the confirmation. Check your connection and try again.")}</p></div></div>
      ) : null}
      {pendingApproval !== undefined ? (
        pendingApproval.approval.id !== respondingApprovalId
          ? <ApprovalCard onApproval={respondToApproval} part={pendingApproval} />
          : null
      ) : respondingApprovalId === null ? (
        <OrganizeReviewCard busy={organizeReviewBusy} onApply={onApplyOrganize} onReject={onRejectOrganize} run={organizeRun} />
      ) : null}
      <motion.form
        className="agent-composer"
        onSubmit={handleSubmit}
        initial="hidden"
        animate="visible"
        variants={contentEntranceVariants(reduceMotion)}
      >
        <MentionMenu open={mentionOpen} activeIndex={mentionIndex} onSelect={selectMention} results={mentionResults} />
        {visibleContextSources.length > 0 ? <div className="agent-composer-sources">{visibleContextSources.map((source) => {
          return <span key={source.id}><AtIcon size={14} /><strong>{source.title}</strong><button aria-label={`${source.pinned ? t("取消置顶", "Unpin reference") : t("置顶引用", "Pin reference")} ${source.title}`} onClick={() => void onReferencesChange(source.pinned ? pinnedIds.filter((id) => id !== source.id) : [...pinnedIds, source.id])} type="button"><PushPinIcon fill={source.pinned ? "currentColor" : "none"} size={14} /></button><button aria-label={`${t("移除引用", "Remove reference")} ${source.title}`} onClick={() => void (async () => { if (source.pinned) await onReferencesChange(pinnedIds.filter((id) => id !== source.id)); if (source.current) setSuppressedCurrentMemoId(source.id); setSources((current) => current.filter((item) => item.id !== source.id)); })()} type="button"><XIcon size={14} /></button></span>;
        })}</div> : null}
        <MentionInput aria-label={t("输入消息", "Message")} className="agent-chat-input" mentions={inlineMentions} onKeyDown={handleComposerKeyDown} onValueChange={handleInputChange} placeholder={t("输入消息，@ 引用笔记…", "Write a message, @ to reference notes…")} ref={composerRef} value={inputValue} />
        <div className="agent-composer-footer">
          <PermissionModeControl accessToken={accessToken} busy={busy} compact userId={userId} />
          {streamBusy || clientToolsRunning ? (
            <Button aria-label={t("停止生成", "Stop generating")} className="agent-composer-action" icon={StopIcon} onClick={handleStop} size="square" type="button" variant="primary" />
          ) : (
            <Button aria-label={t("发送消息", "Send message")} className="agent-composer-action" disabled={!canSubmitComposer(inputValue, composerBusy)} icon={ArrowUpIcon} size="square" type="submit" variant="primary" />
          )}
        </div>
      </motion.form>
    </div>
  );
}
