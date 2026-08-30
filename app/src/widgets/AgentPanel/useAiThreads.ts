/**
 * [INPUT]: 依赖 React、shared/api/ai、按用户短时快照缓存、访问令牌与 threadSelection 偏好策略
 * [OUTPUT]: 对外提供可由 Workspace 只读预热、立即恢复旧内容、后台校准的会话列表/detail/messages 与 CRUD/reference 命令
 * [POS]: AgentPanel 会话控制器；服务端是真相源，进程内快照只跨面板挂载保留最后可用画面并合并预热/初始化请求，空账号只在真正打开面板时创建首个会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createAiThread,
  deleteAiThread,
  getAiThread,
  listAiMessages,
  listAiThreads,
  replaceAiThreadReferences,
  updateAiThread,
  type AiMessage,
  type AiThread,
  type AiThreadDetail,
} from "../../shared/api/ai";
import {
  chooseSelectedThreadId,
  selectedThreadStorageKey,
} from "./threadSelection";
import {
  patchAiThreadSnapshot,
  readAiThreadSnapshot,
  writeAiThreadSnapshot,
  type AiThreadSnapshot,
} from "./aiThreadCache";

type UseAiThreadsInput = {
  accessToken: string;
  userId: string;
};

const pendingInitialThreads = new Map<string, Promise<AiThread>>();
const pendingHydrations = new Map<string, Promise<AiThreadSnapshot | null>>();

const ensureInitialThread = (
  accessToken: string,
  userId: string,
  threads: readonly AiThread[],
): Promise<AiThread> => {
  if (threads[0] !== undefined) return Promise.resolve(threads[0]);
  const existing = pendingInitialThreads.get(userId);
  if (existing !== undefined) return existing;
  const creation = createAiThread(accessToken).finally(() => {
    pendingInitialThreads.delete(userId);
  });
  pendingInitialThreads.set(userId, creation);
  return creation;
};

const hydrateAiThreads = (
  accessToken: string,
  userId: string,
  createIfEmpty: boolean,
): Promise<AiThreadSnapshot | null> => {
  const existing = pendingHydrations.get(userId);
  if (existing !== undefined) return existing;
  const hydration = (async () => {
    let threads = await listAiThreads(accessToken);
    let threadId = chooseSelectedThreadId(
      threads,
      window.localStorage.getItem(selectedThreadStorageKey(userId)),
    );
    if (threadId === null) {
      if (!createIfEmpty) return null;
      const created = await ensureInitialThread(accessToken, userId, threads);
      threads = [created];
      threadId = created.id;
    }
    const [selectedThread, messages] = await Promise.all([
      getAiThread(accessToken, threadId),
      listAiMessages(accessToken, threadId),
    ]);
    return { messages, selectedThread, storedAt: Date.now(), threads };
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
  const snapshot = await hydrateAiThreads(accessToken, userId, false);
  if (snapshot === null) return null;
  writeAiThreadSnapshot(userId, snapshot);
  return snapshot;
};

export function useAiThreads({ accessToken, userId }: UseAiThreadsInput) {
  const initialSnapshot = useRef(readAiThreadSnapshot(userId));
  const [threads, setThreads] = useState<AiThread[]>(() => initialSnapshot.current?.snapshot.threads ?? []);
  const [selectedThread, setSelectedThread] = useState<AiThreadDetail | null>(() => initialSnapshot.current?.snapshot.selectedThread ?? null);
  const [messages, setMessages] = useState<AiMessage[]>(() => initialSnapshot.current?.snapshot.messages ?? []);
  const [loading, setLoading] = useState(initialSnapshot.current === null);
  const [mutating, setMutating] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  const persistSelection = useCallback((threadId: string) => {
    selectedIdRef.current = threadId;
    window.localStorage.setItem(selectedThreadStorageKey(userId), threadId);
  }, [userId]);

  const loadSelected = useCallback(async (
    threadId: string,
    knownThreads?: AiThread[],
  ) => {
    persistSelection(threadId);
    const [detail, storedMessages] = await Promise.all([
      getAiThread(accessToken, threadId),
      listAiMessages(accessToken, threadId),
    ]);
    if (selectedIdRef.current === threadId) {
      setSelectedThread(detail);
      setMessages(storedMessages);
      const cachedThreads = knownThreads
        ?? readAiThreadSnapshot(userId)?.snapshot.threads
        ?? threads;
      writeAiThreadSnapshot(userId, {
        messages: storedMessages,
        selectedThread: detail,
        threads: cachedThreads,
      });
    }
    return detail;
  }, [accessToken, persistSelection, threads, userId]);

  const refreshLists = useCallback(async () => {
    const refreshedThreads = await listAiThreads(accessToken);
    setThreads(refreshedThreads);
    patchAiThreadSnapshot(userId, { threads: refreshedThreads });
    return refreshedThreads;
  }, [accessToken, userId]);

  useEffect(() => {
    let cancelled = false;
    const cached = readAiThreadSnapshot(userId);
    selectedIdRef.current = cached?.snapshot.selectedThread.id ?? null;
    if (cached !== null) {
      persistSelection(cached.snapshot.selectedThread.id);
      setLoading(false);
      if (cached.fresh) return;
    } else {
      setLoading(true);
    }

    const initialize = async () => {
      const preloaded = await preloadAiThreads({ accessToken, userId });
      const snapshot = preloaded
        ?? await hydrateAiThreads(accessToken, userId, true);
      if (snapshot === null) return;
      writeAiThreadSnapshot(userId, snapshot);
      if (cancelled) return;
      persistSelection(snapshot.selectedThread.id);
      setThreads(snapshot.threads);
      setSelectedThread(snapshot.selectedThread);
      setMessages(snapshot.messages);
    };

    void initialize()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, persistSelection, userId]);

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>) => {
    setMutating(true);
    try {
      return await operation();
    } finally {
      setMutating(false);
    }
  }, []);

  const createThread = useCallback(() => runMutation(async () => {
    const created = await createAiThread(accessToken);
    const nextThreads = [created, ...threads];
    setThreads(nextThreads);
    await loadSelected(created.id, nextThreads);
  }), [accessToken, loadSelected, runMutation, threads]);

  const selectThread = useCallback((threadId: string) =>
    runMutation(() => loadSelected(threadId)), [loadSelected, runMutation]);

  const refreshSelected = useCallback(async () => {
    const threadId = selectedIdRef.current;
    if (threadId === null) return;
    const [detail, storedMessages] = await Promise.all([
      getAiThread(accessToken, threadId),
      listAiMessages(accessToken, threadId),
    ]);
    setSelectedThread(detail);
    setMessages(storedMessages);
    patchAiThreadSnapshot(userId, { messages: storedMessages, selectedThread: detail });
    await refreshLists();
  }, [accessToken, refreshLists, userId]);

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
    if (selectedIdRef.current === threadId) {
      setSelectedThread((detail) => detail === null ? null : { ...detail, ...updated });
      const cached = readAiThreadSnapshot(userId)?.snapshot;
      if (cached?.selectedThread.id === threadId) {
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
      if (current === null) return;
      const references = await replaceAiThreadReferences(
        accessToken,
        current.id,
        memoIds,
      );
      setSelectedThread((detail) => detail === null ? null : { ...detail, references });
      patchAiThreadSnapshot(userId, {
        selectedThread: { ...current, references },
      });
    }), [accessToken, runMutation, selectedThread, userId]);

  const chooseNextOrCreate = useCallback(async (excludedId: string) => {
    const next = threads.find((thread) => thread.id !== excludedId);
    if (next !== undefined) {
      await loadSelected(next.id);
      return;
    }
    const created = await createAiThread(accessToken);
    setThreads([created]);
    await loadSelected(created.id, [created]);
  }, [accessToken, loadSelected, threads]);

  const removeThread = useCallback((threadId: string) => runMutation(async () => {
    await deleteAiThread(accessToken, threadId);
    const wasSelected = selectedThread?.id === threadId;
    await refreshLists();
    if (wasSelected) await chooseNextOrCreate(threadId);
  }), [accessToken, chooseNextOrCreate, refreshLists, runMutation, selectedThread?.id]);

  return {
    createThread,
    loading,
    messages,
    mutating,
    patchSelected,
    patchThread,
    refreshSelected,
    removeThread,
    replaceReferences,
    selectedThread,
    selectThread,
    threads,
  };
}
