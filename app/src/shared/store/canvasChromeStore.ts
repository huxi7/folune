/**
 * [INPUT]: 依赖 Zustand、canvasChromePolicy 的纯策略与浏览器 localStorage
 * [OUTPUT]: 对外提供按用户持久化的每画布侧栏快照、一次性进入意图登记、只读 peekEntryChrome 预览与幂等的 entryChrome 解析
 * [POS]: shared/store 的 Canvas 侧栏状态唯一所有者；与 workspaceChromeStore（Paper 的用户级偏好）完全隔离，Canvas 进入策略不得读写 Paper 偏好，Paper 也不因画布开关而改变
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import {
  resolveCanvasEntryChrome,
  type CanvasChromeState,
  type CanvasEntryIntent,
} from "./canvasChromePolicy";

const CANVAS_CHROME_KEY_PREFIX = "folune:canvas-chrome:v1:";
/** 快照是设备级便利而不是业务数据，按最近使用截断，避免无界增长 */
const MAX_SNAPSHOTS = 40;

type StoredCanvasChrome = {
  order: string[];
  snapshots: Record<string, CanvasChromeState>;
  version: 1;
};

type PendingEntry = {
  canvasId: string;
  inherited: CanvasChromeState | null;
  intent: CanvasEntryIntent;
};

type CanvasChromeStore = {
  hydratedUserId: string | null;
  order: string[];
  /** 一次性导航语境；被 entryChrome 解析后即失效 */
  pendingEntry: PendingEntry | null;
  /** 已解析结果的缓存：StrictMode 双渲染与重复调用必须得到同一个答案 */
  resolvedEntry: { canvasId: string; chrome: CanvasChromeState } | null;
  snapshots: Record<string, CanvasChromeState>;
  peekEntryChrome(canvasId: string, viewportWidth: number): CanvasChromeState;
  entryChrome(canvasId: string, viewportWidth: number): CanvasChromeState;
  hydrate(userId: string): void;
  remember(canvasId: string, chrome: CanvasChromeState): void;
  rememberEntry(input: {
    canvasId: string;
    inherited?: CanvasChromeState | null;
    intent: CanvasEntryIntent;
  }): void;
  reset(): void;
};

export const canvasChromeStorageKey = (userId: string): string =>
  `${CANVAS_CHROME_KEY_PREFIX}${userId}`;

const resolveEntryChrome = (
  state: Pick<CanvasChromeStore, "pendingEntry" | "resolvedEntry" | "snapshots">,
  canvasId: string,
  viewportWidth: number,
): CanvasChromeState => {
  const cached = state.resolvedEntry;
  if (cached !== null && cached.canvasId === canvasId) {
    return cached.chrome;
  }

  const pending = state.pendingEntry?.canvasId === canvasId
    ? state.pendingEntry
    : null;
  return resolveCanvasEntryChrome({
    inherited: pending?.inherited ?? null,
    intent: pending?.intent ?? "direct",
    snapshot: state.snapshots[canvasId] ?? null,
    viewportWidth,
  });
};

const isChromeState = (value: unknown): value is CanvasChromeState =>
  value !== null
  && typeof value === "object"
  && typeof (value as CanvasChromeState).assistantOpen === "boolean"
  && typeof (value as CanvasChromeState).libraryOpen === "boolean";

export function parseCanvasChrome(
  stored: string | null,
): Pick<StoredCanvasChrome, "order" | "snapshots"> | null {
  if (stored === null) return null;
  try {
    const snapshot = JSON.parse(stored) as Partial<StoredCanvasChrome>;
    if (snapshot.version !== 1 || typeof snapshot.snapshots !== "object") {
      return null;
    }
    const snapshots: Record<string, CanvasChromeState> = {};
    for (const [canvasId, chrome] of Object.entries(snapshot.snapshots ?? {})) {
      if (isChromeState(chrome)) snapshots[canvasId] = chrome;
    }
    const order = Array.isArray(snapshot.order)
      ? snapshot.order.filter((id): id is string =>
        typeof id === "string" && snapshots[id] !== undefined)
      : Object.keys(snapshots);
    return { order, snapshots };
  } catch {
    return null;
  }
}

// ---- localStorage 访问器降级 ----
// 访问器本身会抛 (SecurityError / QuotaExceededError)，与 workspaceChromeStore 同范式。
const readStoredValue = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const persist = (state: Pick<
  CanvasChromeStore,
  "hydratedUserId" | "order" | "snapshots"
>): void => {
  if (state.hydratedUserId === null) return;
  const payload: StoredCanvasChrome = {
    order: state.order,
    snapshots: state.snapshots,
    version: 1,
  };
  try {
    window.localStorage.setItem(
      canvasChromeStorageKey(state.hydratedUserId),
      JSON.stringify(payload),
    );
  } catch {
    // 侧栏快照不可用时当作没有记录，本次会话仍然可以正常开关。
  }
};

export const useCanvasChromeStore = create<CanvasChromeStore>((set, get) => ({
  hydratedUserId: null,
  order: [],
  pendingEntry: null,
  resolvedEntry: null,
  snapshots: {},

  peekEntryChrome(canvasId, viewportWidth) {
    return resolveEntryChrome(get(), canvasId, viewportWidth);
  },

  entryChrome(canvasId, viewportWidth) {
    const state = get();
    const chrome = resolveEntryChrome(state, canvasId, viewportWidth);

    set({ pendingEntry: null, resolvedEntry: { canvasId, chrome } });
    return chrome;
  },

  hydrate(userId) {
    const stored = parseCanvasChrome(
      readStoredValue(canvasChromeStorageKey(userId)),
    ) ?? { order: [], snapshots: {} };
    set({
      hydratedUserId: userId,
      order: stored.order,
      pendingEntry: null,
      resolvedEntry: null,
      snapshots: stored.snapshots,
    });
  },

  remember(canvasId, chrome) {
    const state = get();
    const current = state.snapshots[canvasId];
    const unchanged = current !== undefined
      && current.assistantOpen === chrome.assistantOpen
      && current.libraryOpen === chrome.libraryOpen
      && state.order.at(-1) === canvasId;
    if (unchanged) return;

    const order = [
      ...state.order.filter((id) => id !== canvasId),
      canvasId,
    ].slice(-MAX_SNAPSHOTS);
    const snapshots: Record<string, CanvasChromeState> = { [canvasId]: chrome };
    for (const id of order) {
      const existing = id === canvasId ? chrome : state.snapshots[id];
      if (existing !== undefined) snapshots[id] = existing;
    }

    const next = { order, snapshots };
    set(next);
    persist({ hydratedUserId: state.hydratedUserId, ...next });
  },

  rememberEntry({ canvasId, inherited = null, intent }) {
    set({
      pendingEntry: { canvasId, inherited, intent },
      // 新的导航语境必须废掉上一次的解析，否则来回切换会读到过期答案。
      resolvedEntry: null,
    });
  },

  reset() {
    set({
      hydratedUserId: null,
      order: [],
      pendingEntry: null,
      resolvedEntry: null,
      snapshots: {},
    });
  },
}));
