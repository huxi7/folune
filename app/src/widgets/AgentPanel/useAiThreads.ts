/**
 * [INPUT]: 依赖 React、shared/api/ai 聚合读取、按用户与会话隔离的短时快照缓存、访问令牌与 threadSelection 偏好策略
 * [OUTPUT]: 对外提供本地草稿、首发幂等创建与本地置顶引用、可只读预热、点击即切换目标壳、逐会话预取/回显、消息本地提交与后台校准的会话列表/detail/messages 与 CRUD/reference 命令
 * [POS]: AgentPanel 会话控制器；新对话/空列表不写库，草稿落库保持同一渲染身份；列表选择不等待网络，内容缺失时显式加载、命中缓存时立即恢复，并合并同一会话的并发读取；服务端仍是真相源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createAiThread,
  deleteAiThread,
  getAiThreadBootstrap,
  getAiThreadContent,
  listAiThreads,
  replaceAiThreadReferences,
  updateAiThread,
  type AiMessage,
  type AiThread,
  type AiThreadContent,
  type AiThreadDetail,
  type FoluneUIMessage,
} from "../../shared/api/ai";
import { DRAFT_THREAD_SELECTION, selectedThreadStorageKey } from "./threadSelection";
import {
  patchAiThreadSnapshot,
  readAiThreadContent,
  readAiThreadSnapshot,
  removeAiThreadContent,
  writeAiThreadContent,
  writeAiThreadSnapshot,
  type AiThreadSnapshot,
} from "./aiThreadCache";

type UseAiThreadsInput = {
  accessToken: string;
  userId: string;
};

const pendingHydrations = new Map<string, Promise<AiThreadSnapshot | null>>();
const pendingThreadContents = new Map<string, Promise<AiThreadContent>>();

const threadContentKey = (userId: string, threadId: string) =>
  `${userId}:${threadId}`;

const requestThreadContent = (
  accessToken: string,
  userId: string,
  threadId: string,
): Promise<AiThreadContent> => {
  const key = threadContentKey(userId, threadId);
  const existing = pendingThreadContents.get(key);
  if (existing !== undefined) return existing;

  const request = getAiThreadContent(accessToken, threadId)
    .then((content) => {
      writeAiThreadContent(userId, content);
      return content;
    })
    .finally(() => pendingThreadContents.delete(key));
  pendingThreadContents.set(key, request);
  return request;
};

const localTitleFromMessages = (
  messages: readonly FoluneUIMessage[],
): string | null => {
  const userMessage = messages.find((message) => message.role === "user");
  if (userMessage === undefined) return null;
  const text = userMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  return text.length === 0 ? null : Array.from(text).slice(0, 30).join("");
};

const hydrateAiThreads = (
  accessToken: string,
  userId: string,
): Promise<AiThreadSnapshot | null> => {
  const existing = pendingHydrations.get(userId);
  if (existing !== undefined) return existing;
  const hydration = (async () => {
    const preferredThreadId = window.localStorage.getItem(selectedThreadStorageKey(userId));
    const draftSelected = preferredThreadId === DRAFT_THREAD_SELECTION;
    const bootstrap = await getAiThreadBootstrap(accessToken, draftSelected ? null : preferredThreadId);
    return {
      ...bootstrap,
      ...(draftSelected ? { selectedThread: null, messages: [] } : {}),
      storedAt: Date.now(),
    };
  })().finally(() => pendingHydrations.delete(userId));
  pendingHydrations.set(userId, hydration);
  return hydration;
};

export const preloadAiThreads = async ({
  accessToken,
  userId,
}: UseAiThreadsInput): Promise<AiThreadSnapshot | null> => {
  const cached = readAiThreadSnapshot(userId);
  if (cached?.fresh) return cached.snapshot;

  // Workspace 空闲预热必须是纯读取，不能因为用户只是写笔记就替他创建 AI 会话。
  const snapshot = await hydrateAiThreads(accessToken, userId);
  if (snapshot === null) return null;
  // 预热发出后用户可能已切到草稿或其他会话；旧结果不能覆盖新的选择。
  if (readAiThreadSnapshot(userId)?.snapshot === cached?.snapshot) {
    writeAiThreadSnapshot(userId, snapshot);
  }
  return snapshot;
};

export function useAiThreads({ accessToken, userId }: UseAiThreadsInput) {
  const initialSnapshot = useRef(readAiThreadSnapshot(userId));
  const [threads, setThreads] = useState<AiThread[]>(() => initialSnapshot.current?.snapshot.threads ?? []);
  const [selectedThread, setSelectedThread] = useState<AiThreadDetail | null>(() => initialSnapshot.current?.snapshot.selectedThread ?? null);
  const [messages, setMessages] = useState<AiMessage[]>(() => initialSnapshot.current?.snapshot.messages ?? []);
  const [loading, setLoading] = useState(initialSnapshot.current === null);
  const [mutating, setMutating] = useState(false);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedLoadError, setSelectedLoadError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(initialSnapshot.current?.snapshot.selectedThread?.id ?? null);
  const selectionVersion = useRef(0);
  const [conversationKey, setConversationKey] = useState(() => selectedIdRef.current ?? DRAFT_THREAD_SELECTION);
  const [draftReferenceIds, setDraftReferenceIds] = useState<readonly string[]>([]);
  const draftReferencesRef = useRef<readonly string[]>([]);
  const pendingCreation = useRef<Promise<string> | null>(null);
  const createdDraft = useRef<AiThreadDetail | null>(null);
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  const persistSelection = useCallback((threadId: string | null) => {
    selectedIdRef.current = threadId;
    window.localStorage.setItem(selectedThreadStorageKey(userId), threadId ?? DRAFT_THREAD_SELECTION);
  }, [userId]);

  const loadSelected = useCallback(async (
    threadId: string,
    knownThreads?: AiThread[],
  ) => {
    selectionVersion.current++;
    setConversationKey(threadId);
    persistSelection(threadId);
    setSelectedLoadError(null);
    const cachedThreads = knownThreads
      ?? (threads.length > 0
        ? threads
        : readAiThreadSnapshot(userId)?.snapshot.threads ?? []);
    const cached = readAiThreadContent(userId, threadId);

    if (cached !== null) {
      setSelectedThread(cached.snapshot.selectedThread);
      setMessages(cached.snapshot.messages);
      setSelectedLoading(false);
      writeAiThreadSnapshot(userId, {
        messages: cached.snapshot.messages,
        selectedThread: cached.snapshot.selectedThread,
        threads: cachedThreads,
      });
      // 切到陈旧快照只改变当前画面，不能借此把内容 TTL 伪装成刚读取。
      writeAiThreadContent(userId, {
        messages: cached.snapshot.messages,
        selectedThread: cached.snapshot.selectedThread,
      }, cached.snapshot.storedAt);
      if (cached.fresh) return cached.snapshot.selectedThread;
    } else {
      const summary = cachedThreads.find((thread) => thread.id === threadId);
      if (summary !== undefined) {
        setSelectedThread({ ...summary, references: [] });
        setMessages([]);
      }
      setSelectedLoading(true);
    }

    try {
      const content = await requestThreadContent(accessToken, userId, threadId);
      if (selectedIdRef.current === threadId) {
        setSelectedThread(content.selectedThread);
        setMessages(content.messages);
        setSelectedLoading(false);
        writeAiThreadSnapshot(userId, { ...content, threads: cachedThreads });
      }
      return content.selectedThread;
    } catch (error) {
      if (selectedIdRef.current === threadId) {
        setSelectedLoading(false);
        if (cached === null) {
          setSelectedLoadError(error instanceof Error ? error.message : "会话内容读取失败。");
        }
      }
      throw error;
    }
  }, [accessToken, persistSelection, threads, userId]);

  const preloadThread = useCallback(async (threadId: string) => {
    if (readAiThreadContent(userId, threadId)?.fresh) return;
    await requestThreadContent(accessToken, userId, threadId);
  }, [accessToken, userId]);

  const refreshLists = useCallback(async () => {
    const refreshedThreads = await listAiThreads(accessToken);
    threadsRef.current = refreshedThreads;
    setThreads(refreshedThreads);
    patchAiThreadSnapshot(userId, { threads: refreshedThreads });
    return refreshedThreads;
  }, [accessToken, userId]);

  useEffect(() => {
    let cancelled = false;
    const version = selectionVersion.current;
    const cached = readAiThreadSnapshot(userId);
    if (cached !== null) {
      persistSelection(cached.snapshot.selectedThread?.id ?? null);
      setLoading(false);
      if (cached.fresh) return;
    }
    void hydrateAiThreads(accessToken, userId).then((snapshot) => {
      if (snapshot === null || cancelled) return;
      if (version !== selectionVersion.current) {
        if (selectedIdRef.current === null && createdDraft.current === null) {
          setThreads(snapshot.threads);
          patchAiThreadSnapshot(userId, { threads: snapshot.threads });
        }
        return;
      }
      writeAiThreadSnapshot(userId, snapshot);
      persistSelection(snapshot.selectedThread?.id ?? null);
      setConversationKey(snapshot.selectedThread?.id ?? DRAFT_THREAD_SELECTION);
      setThreads(snapshot.threads);
      setSelectedThread(snapshot.selectedThread);
      setMessages(snapshot.messages);
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [accessToken, persistSelection, userId]);

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>) => {
    setMutating(true);
    try {
      return await operation();
    } finally {
      setMutating(false);
    }
  }, []);

  const startDraft = useCallback(() => {
    selectionVersion.current++;
    persistSelection(null);
    setConversationKey(`draft-${selectionVersion.current}`);
    setSelectedThread(null);
    setMessages([]);
    setLoading(false);
    setSelectedLoading(false);
    setSelectedLoadError(null);
    draftReferencesRef.current = [];
    setDraftReferenceIds([]);
    createdDraft.current = null;
    pendingCreation.current = null;
    writeAiThreadSnapshot(userId, { messages: [], selectedThread: null, threads: threadsRef.current });
  }, [persistSelection, userId]);

  const ensureThread = useCallback((): Promise<string> => {
    if (selectedIdRef.current !== null) return Promise.resolve(selectedIdRef.current);
    if (pendingCreation.current !== null) return pendingCreation.current;
    const version = ++selectionVersion.current;
    const request = (async () => {
      const created = createdDraft.current ?? { ...await createAiThread(accessToken), references: [] };
      if (version !== selectionVersion.current) throw new Error("已切换会话，请重新发送。");
      // 引用保存失败时保留已创建 ID；重试发送不再新建另一个空会话。
      createdDraft.current = created;
      const references = draftReferencesRef.current.length === 0 ? []
        : await replaceAiThreadReferences(accessToken, created.id, draftReferencesRef.current);
      if (version !== selectionVersion.current) throw new Error("已切换会话，请重新发送。");
      const detail = { ...created, references };
      const nextThreads = [created, ...threadsRef.current.filter((thread) => thread.id !== created.id)];
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      persistSelection(created.id);
      setSelectedThread(detail);
      // conversationKey 不变：草稿落库不能重建正在发送首条消息的 useChat。
      writeAiThreadSnapshot(userId, { messages: [], selectedThread: detail, threads: nextThreads });
      return created.id;
    })().finally(() => {
      if (pendingCreation.current === request) pendingCreation.current = null;
    });
    pendingCreation.current = request;
    return request;
  }, [accessToken, persistSelection, userId]);

  const selectThread = useCallback(
    (threadId: string) => loadSelected(threadId),
    [loadSelected],
  );

  const refreshSelected = useCallback(async () => {
    const threadId = selectedIdRef.current;
    if (threadId === null) return;
    const content = await getAiThreadContent(accessToken, threadId);
    if (selectedIdRef.current !== threadId) return;
    writeAiThreadContent(userId, content);
    setSelectedThread(content.selectedThread);
    setMessages(content.messages);
    setSelectedLoading(false);
    setSelectedLoadError(null);
    patchAiThreadSnapshot(userId, content);
    await refreshLists();
  }, [accessToken, refreshLists, userId]);

  const commitLocalMessages = useCallback(async (
    localMessages?: readonly FoluneUIMessage[],
  ) => {
    const currentThread = selectedThread;
    const threadId = selectedIdRef.current;
    if (currentThread === null || threadId === null || localMessages === undefined) {
      return;
    }

    const now = new Date().toISOString();
    const currentById = new Map(messages.map((message) => [message.id, message]));
    const nextMessages: AiMessage[] = localMessages.map((message, position) => {
      const previous = currentById.get(message.id);
      const persistedFields = message as FoluneUIMessage &
        Partial<Pick<AiMessage, "context_snapshot" | "status">>;
      return {
        ...(previous ?? {
          created_at: now,
          thread_id: threadId,
          updated_at: now,
          user_id: userId,
        }),
        ...message,
        context_snapshot: persistedFields.context_snapshot
          ?? previous?.context_snapshot
          ?? null,
        position,
        // UIMessage 不暴露持久化 status；完成的 assistant 帧默认视为 complete。
        // 如果沿用旧的 in_progress，重开面板会看起来像永远在忙。
        status: persistedFields.status
          ?? (message.role === "assistant"
            ? "complete"
            : previous?.status ?? "complete"),
        updated_at: now,
      } as AiMessage;
    });
    const inferredTitle = currentThread.title === "新会话"
      ? localTitleFromMessages(localMessages)
      : null;
    const nextSelectedThread: AiThreadDetail = {
      ...currentThread,
      ...(inferredTitle === null ? {} : { title: inferredTitle }),
      last_message_at: now,
      updated_at: now,
    };
    const nextThreads = [
      nextSelectedThread,
      ...threads.filter((thread) => thread.id !== threadId),
    ];
    setMessages(nextMessages);
    setSelectedThread(nextSelectedThread);
    setThreads(nextThreads);
    writeAiThreadSnapshot(userId, {
      messages: nextMessages,
      selectedThread: nextSelectedThread,
      threads: nextThreads,
    });
  }, [messages, selectedThread, threads, userId]);

  const patchSelected = useCallback(async (
    input: Partial<Pick<AiThread, "title">>,
  ) => runMutation(async () => {
    const current = selectedThread;
    if (current === null) return;
    const updated = await updateAiThread(accessToken, current.id, input);
    setSelectedThread((detail) => detail === null ? null : { ...detail, ...updated });
    patchAiThreadSnapshot(userId, { selectedThread: { ...current, ...updated } });
    await refreshLists();
  }), [accessToken, refreshLists, runMutation, selectedThread, userId]);

  const patchThread = useCallback(async (
    threadId: string,
    input: Partial<Pick<AiThread, "title">>,
  ) => runMutation(async () => {
    const updated = await updateAiThread(accessToken, threadId, input);
    const cachedContent = readAiThreadContent(userId, threadId)?.snapshot;
    if (cachedContent !== undefined) {
      writeAiThreadContent(userId, {
        messages: cachedContent.messages,
        selectedThread: { ...cachedContent.selectedThread, ...updated },
      }, cachedContent.storedAt);
    }
    if (selectedIdRef.current === threadId) {
      setSelectedThread((detail) => detail === null ? null : { ...detail, ...updated });
      const cached = readAiThreadSnapshot(userId)?.snapshot;
      if (cached?.selectedThread?.id === threadId) {
        patchAiThreadSnapshot(userId, {
          selectedThread: { ...cached.selectedThread, ...updated },
        });
      }
    }
    await refreshLists();
  }), [accessToken, refreshLists, runMutation, userId]);

  const replaceReferences = useCallback((memoIds: readonly string[]) =>
    runMutation(async () => {
      const current = selectedThread;
      if (current === null) {
        draftReferencesRef.current = [...memoIds];
        setDraftReferenceIds([...memoIds]);
        return;
      }
      const references = await replaceAiThreadReferences(
        accessToken,
        current.id,
        memoIds,
      );
      if (selectedIdRef.current !== current.id) return;
      setSelectedThread((detail) => detail === null ? null : { ...detail, references });
      patchAiThreadSnapshot(userId, {
        selectedThread: { ...current, references },
      });
    }), [accessToken, runMutation, selectedThread, userId]);

  const removeThread = useCallback((threadId: string) => runMutation(async () => {
    await deleteAiThread(accessToken, threadId);
    removeAiThreadContent(userId, threadId);
    const refreshed = await refreshLists();
    if (selectedIdRef.current !== threadId) return;
    const next = refreshed[0];
    if (next !== undefined) await loadSelected(next.id, refreshed);
    else startDraft();
  }), [accessToken, loadSelected, refreshLists, runMutation, startDraft, userId]);

  const pinnedMemoIds = useMemo(() => selectedThread?.references.map((reference) => reference.memo_id)
    ?? draftReferenceIds, [draftReferenceIds, selectedThread?.references]);

  return {
    conversationKey,
    ensureThread,
    startDraft,
    pinnedMemoIds,
    loading,
    messages,
    mutating,
    patchSelected,
    patchThread,
    preloadThread,
    refreshSelected,
    commitLocalMessages,
    removeThread,
    replaceReferences,
    selectedThread,
    selectedLoadError,
    selectedLoading,
    selectThread,
    threads,
  };
}
