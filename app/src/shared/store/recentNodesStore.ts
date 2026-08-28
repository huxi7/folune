/**
 * [INPUT]: 依赖 Zustand 与浏览器 localStorage
 * [OUTPUT]: 对外提供按用户持久化的最近打开对象顺序、remember 命令与 parseRecentNodes 纯解析
 * [POS]: shared/store 的最近打开记录边界；只保存节点 id 顺序，不复制标题、正文或树结构，Command Palette 用它给空查询列最近项并为排序提供"最近打开"档位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

const RECENT_NODES_KEY_PREFIX = "supernote:recent-nodes:v1:";
/** 最近项是便利而不是历史档案，越界即丢 */
const MAX_RECENT = 30;

type StoredRecentNodes = {
  order: string[];
  version: 1;
};

type RecentNodesStore = {
  hydratedUserId: string | null;
  /** 最近打开在前 */
  order: string[];
  hydrate(userId: string): void;
  remember(nodeId: string): void;
  reset(): void;
};

export const recentNodesStorageKey = (userId: string): string =>
  `${RECENT_NODES_KEY_PREFIX}${userId}`;

export function parseRecentNodes(stored: string | null): string[] | null {
  if (stored === null) return null;
  try {
    const snapshot = JSON.parse(stored) as Partial<StoredRecentNodes>;
    if (snapshot.version !== 1 || !Array.isArray(snapshot.order)) return null;
    return snapshot.order
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_RECENT);
  } catch {
    return null;
  }
}

const readStoredValue = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const persist = (userId: string | null, order: readonly string[]): void => {
  if (userId === null) return;
  try {
    window.localStorage.setItem(
      recentNodesStorageKey(userId),
      JSON.stringify({ order: [...order], version: 1 } satisfies StoredRecentNodes),
    );
  } catch {
    // 最近项不可用时只影响便利，不影响搜索本身。
  }
};

export const useRecentNodesStore = create<RecentNodesStore>((set, get) => ({
  hydratedUserId: null,
  order: [],

  hydrate(userId) {
    set({
      hydratedUserId: userId,
      order: parseRecentNodes(readStoredValue(recentNodesStorageKey(userId)))
        ?? [],
    });
  },

  remember(nodeId) {
    const state = get();
    if (state.order[0] === nodeId) return;
    const order = [nodeId, ...state.order.filter((id) => id !== nodeId)]
      .slice(0, MAX_RECENT);
    set({ order });
    persist(state.hydratedUserId, order);
  },

  reset() {
    set({ hydratedUserId: null, order: [] });
  },
}));
