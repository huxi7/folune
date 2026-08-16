/**
 * [INPUT]: 依赖 React 状态/effect、shared/api/ai thread/message/reference API、用户 access token 与 threadSelection 偏好策略
 * [OUTPUT]: 对外提供统一会话列表、所选 thread/detail/messages、初始化与 CRUD/reference 命令
 * [POS]: AgentPanel 会话控制器；服务端是 thread/message 真相源，Hook 只维护当前视图缓存并在切换时重建 useChat
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

type UseAiThreadsInput = {
  accessToken: string;
  userId: string;
};

const pendingInitialThreads = new Map<string, Promise<AiThread>>();

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

export function useAiThreads({ accessToken, userId }: UseAiThreadsInput) {
  const [threads, setThreads] = useState<AiThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<AiThreadDetail | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  const persistSelection = useCallback((threadId: string) => {
    selectedIdRef.current = threadId;
    window.localStorage.setItem(selectedThreadStorageKey(userId), threadId);
  }, [userId]);

  const loadSelected = useCallback(async (threadId: string) => {
    persistSelection(threadId);
    const [detail, storedMessages] = await Promise.all([
      getAiThread(accessToken, threadId),
      listAiMessages(accessToken, threadId),
    ]);
    if (selectedIdRef.current === threadId) {
      setSelectedThread(detail);
      setMessages(storedMessages);
    }
    return detail;
  }, [accessToken, persistSelection]);

  const refreshLists = useCallback(async () => {
    const refreshedThreads = await listAiThreads(accessToken);
    setThreads(refreshedThreads);
    return refreshedThreads;
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    selectedIdRef.current = null;
    setLoading(true);
    setSelectedThread(null);
    setMessages([]);

    const initialize = async () => {
      const refreshedThreads = await refreshLists();
      if (cancelled) return;
      let threadId = chooseSelectedThreadId(
        refreshedThreads,
        window.localStorage.getItem(selectedThreadStorageKey(userId)),
      );
      if (threadId === null) {
        const created = await ensureInitialThread(accessToken, userId, refreshedThreads);
        if (cancelled) return;
        setThreads([created]);
        threadId = created.id;
      }
      await loadSelected(threadId);
    };

    void initialize().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, loadSelected, refreshLists, userId]);

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
    setThreads((current) => [created, ...current]);
    await loadSelected(created.id);
  }), [accessToken, loadSelected, runMutation]);

  const selectThread = useCallback((threadId: string) =>
    runMutation(() => loadSelected(threadId)), [loadSelected, runMutation]);

  const refreshSelected = useCallback(async () => {
    const threadId = selectedIdRef.current;
    if (threadId === null) return;
    const detail = await getAiThread(accessToken, threadId);
    setSelectedThread(detail);
    await refreshLists();
  }, [accessToken, refreshLists]);

  const patchSelected = useCallback(async (
    input: Partial<Pick<AiThread, "title">>,
  ) => runMutation(async () => {
    const current = selectedThread;
    if (current === null) return;
    const updated = await updateAiThread(accessToken, current.id, input);
    setSelectedThread((detail) => detail === null ? null : { ...detail, ...updated });
    await refreshLists();
  }), [accessToken, refreshLists, runMutation, selectedThread]);

  const patchThread = useCallback(async (
    threadId: string,
    input: Partial<Pick<AiThread, "title">>,
  ) => runMutation(async () => {
    const updated = await updateAiThread(accessToken, threadId, input);
    if (selectedIdRef.current === threadId) {
      setSelectedThread((detail) => detail === null ? null : { ...detail, ...updated });
    }
    await refreshLists();
  }), [accessToken, refreshLists, runMutation]);

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
    }), [accessToken, runMutation, selectedThread]);

  const chooseNextOrCreate = useCallback(async (excludedId: string) => {
    const next = threads.find((thread) => thread.id !== excludedId);
    if (next !== undefined) {
      await loadSelected(next.id);
      return;
    }
    const created = await createAiThread(accessToken);
    setThreads([created]);
    await loadSelected(created.id);
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
