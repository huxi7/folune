/**
 * [INPUT]: 依赖 AI thread/detail/message DTO 与浏览器进程内时间
 * [OUTPUT]: 对外提供按用户隔离、短时新鲜且可陈旧读取的 AI 会话快照缓存
 * [POS]: AgentPanel 的 stale-while-revalidate 内存边界；只消除面板反复挂载的空白与重复请求，不替代服务端真相
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiMessage, AiThread, AiThreadDetail } from "../../shared/api/ai";

export const AI_THREAD_CACHE_FRESH_MS = 30_000;

export type AiThreadSnapshot = {
  messages: AiMessage[];
  selectedThread: AiThreadDetail;
  storedAt: number;
  threads: AiThread[];
};

const snapshots = new Map<string, AiThreadSnapshot>();

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
  snapshots.set(userId, { ...snapshot, storedAt: now });
};

export const patchAiThreadSnapshot = (
  userId: string,
  patch: Partial<Omit<AiThreadSnapshot, "storedAt">>,
  now = Date.now(),
) => {
  const current = snapshots.get(userId);
  if (current === undefined) return;
  snapshots.set(userId, { ...current, ...patch, storedAt: now });
};

export const resetAiThreadSnapshotsForTests = () => snapshots.clear();
