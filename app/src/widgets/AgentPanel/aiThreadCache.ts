/**
 * [INPUT]: 依赖 AI thread/detail/message DTO 与浏览器进程内时间
 * [OUTPUT]: 对外提供按用户隔离的面板快照与逐会话内容缓存，二者均可短时判鲜并陈旧回显
 * [POS]: AgentPanel 的 stale-while-revalidate 内存边界；列表快照恢复面板，逐会话缓存让返回已读会话无需等待网络，不替代服务端真相
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiMessage, AiThread, AiThreadDetail } from "../../shared/api/ai";

export const AI_THREAD_CACHE_FRESH_MS = 30_000;
const MAX_CACHED_THREAD_CONTENTS_PER_USER = 8;

export type AiThreadSnapshot = {
  messages: AiMessage[];
  selectedThread: AiThreadDetail;
  storedAt: number;
  threads: AiThread[];
};

export type AiThreadContentSnapshot = Pick<
  AiThreadSnapshot,
  "messages" | "selectedThread" | "storedAt"
>;

const snapshots = new Map<string, AiThreadSnapshot>();
const threadContents = new Map<string, Map<string, AiThreadContentSnapshot>>();

const rememberThreadContent = (
  userId: string,
  snapshot: AiThreadContentSnapshot,
) => {
  const userContents = threadContents.get(userId) ?? new Map();
  userContents.delete(snapshot.selectedThread.id);
  userContents.set(snapshot.selectedThread.id, snapshot);
  while (userContents.size > MAX_CACHED_THREAD_CONTENTS_PER_USER) {
    const oldestThreadId = userContents.keys().next().value;
    if (oldestThreadId === undefined) break;
    userContents.delete(oldestThreadId);
  }
  threadContents.set(userId, userContents);
};

export const readAiThreadSnapshot = (
  userId: string,
  now = Date.now(),
): { fresh: boolean; snapshot: AiThreadSnapshot } | null => {
  const snapshot = snapshots.get(userId);
  return snapshot === undefined
    ? null
    : {
        fresh: now - snapshot.storedAt < AI_THREAD_CACHE_FRESH_MS,
        snapshot,
      };
};

export const writeAiThreadSnapshot = (
  userId: string,
  snapshot: Omit<AiThreadSnapshot, "storedAt">,
  now = Date.now(),
) => {
  const stored = { ...snapshot, storedAt: now };
  snapshots.set(userId, stored);
  rememberThreadContent(userId, stored);
};

export const patchAiThreadSnapshot = (
  userId: string,
  patch: Partial<Omit<AiThreadSnapshot, "storedAt">>,
  now = Date.now(),
) => {
  const current = snapshots.get(userId);
  if (current === undefined) return;
  const stored = { ...current, ...patch, storedAt: now };
  snapshots.set(userId, stored);
  if (patch.messages !== undefined || patch.selectedThread !== undefined) {
    rememberThreadContent(userId, stored);
  }
};

export const readAiThreadContent = (
  userId: string,
  threadId: string,
  now = Date.now(),
): { fresh: boolean; snapshot: AiThreadContentSnapshot } | null => {
  const snapshot = threadContents.get(userId)?.get(threadId);
  return snapshot === undefined
    ? null
    : {
        fresh: now - snapshot.storedAt < AI_THREAD_CACHE_FRESH_MS,
        snapshot,
      };
};

export const writeAiThreadContent = (
  userId: string,
  snapshot: Omit<AiThreadContentSnapshot, "storedAt">,
  now = Date.now(),
) => rememberThreadContent(userId, { ...snapshot, storedAt: now });

export const removeAiThreadContent = (userId: string, threadId: string) => {
  const userContents = threadContents.get(userId);
  if (userContents === undefined) return;
  userContents.delete(threadId);
  if (userContents.size === 0) threadContents.delete(userId);
};

export const resetAiThreadSnapshotsForTests = () => {
  snapshots.clear();
  threadContents.clear();
};
