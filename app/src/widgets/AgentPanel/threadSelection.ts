/**
 * [INPUT]: 依赖用户 ID、AI thread 列表与浏览器 localStorage 字符串接口
 * [OUTPUT]: 对外提供 DRAFT_THREAD_SELECTION、按用户隔离的 selected thread key 与可用会话选择纯策略
 * [POS]: AgentPanel 会话偏好边界；只保存 thread ID 或显式草稿标记，不复制消息、正文或服务端 thread 状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiThread } from "../../shared/api/ai";

export const DRAFT_THREAD_SELECTION = "draft";

const SELECTED_THREAD_KEY_PREFIX = "folune:selected-ai-thread:";

export const selectedThreadStorageKey = (userId: string): string =>
  `${SELECTED_THREAD_KEY_PREFIX}${userId}`;

export const chooseSelectedThreadId = (
  threads: readonly AiThread[],
  storedId: string | null,
): string | null => {
  if (storedId !== null && threads.some((thread) => thread.id === storedId)) {
    return storedId;
  }
  return threads[0]?.id ?? null;
};
