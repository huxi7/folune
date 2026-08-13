/**
 * [INPUT]: 依赖 Zustand 的 create
 * [OUTPUT]: 对外提供按用户 hydrate 并持久化 open/close/toggle，以及后端确认式审批模式加载/保存状态的 useAgentPanelStore
 * [POS]: shared/store 的 AgentPanel 薄 UI 状态；不复制消息或文件树，审批模式只缓存 API 已确认事实并保留失败状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { AiPermissionMode } from "../api/ai";

export type AiPermissionStatus = "idle" | "loading" | "ready" | "saving" | "error";

type AgentPanelState = {
  isOpen: boolean;
  permissionError: string | null;
  permissionMode: AiPermissionMode;
  permissionStatus: AiPermissionStatus;
  userId: string | null;
  beginPermissionLoad(): void;
  beginPermissionSave(): void;
  close(): void;
  failPermission(error: string): void;
  hydrate(userId: string): void;
  open(): void;
  resolvePermission(mode: AiPermissionMode): void;
  toggle(): void;
};

const PANEL_OPEN_KEY_PREFIX = "supernote:agent-panel-open:";

export const agentPanelStorageKey = (userId: string): string =>
  `${PANEL_OPEN_KEY_PREFIX}${userId}`;

export const parseAgentPanelOpen = (stored: string | null): boolean =>
  stored === null ? true : stored === "true";

const persistOpen = (userId: string | null, isOpen: boolean): void => {
  if (userId !== null) {
    window.localStorage.setItem(agentPanelStorageKey(userId), String(isOpen));
  }
};

export const useAgentPanelStore = create<AgentPanelState>((set) => ({
  isOpen: true,
  permissionError: null,
  permissionMode: "ask",
  permissionStatus: "idle",
  userId: null,
  beginPermissionLoad: () => set({ permissionError: null, permissionStatus: "loading" }),
  beginPermissionSave: () => set({ permissionError: null, permissionStatus: "saving" }),
  close: () => set((state) => {
    persistOpen(state.userId, false);
    return { isOpen: false };
  }),
  hydrate: (userId) => set(() => {
    const stored = window.localStorage.getItem(agentPanelStorageKey(userId));
    return {
      userId,
      isOpen: parseAgentPanelOpen(stored),
      permissionError: null,
      permissionMode: "ask",
      permissionStatus: "idle",
    };
  }),
  failPermission: (permissionError) => set({ permissionError, permissionStatus: "error" }),
  open: () => set((state) => {
    persistOpen(state.userId, true);
    return { isOpen: true };
  }),
  resolvePermission: (permissionMode) => set({
    permissionError: null,
    permissionMode,
    permissionStatus: "ready",
  }),
  toggle: () => set((state) => {
    const isOpen = !state.isOpen;
    persistOpen(state.userId, isOpen);
    return { isOpen };
  }),
}));
