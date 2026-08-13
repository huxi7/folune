/**
 * [INPUT]: 依赖 Zustand 的 create
 * [OUTPUT]: 对外提供后端确认式审批模式加载/保存状态的 useAgentPanelStore
 * [POS]: shared/store 的 AgentPanel 权限薄状态；可见性归 WorkspaceChromeState，当前 Store 只缓存 API 已确认权限事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { AiPermissionMode } from "../api/ai";

export type AiPermissionStatus = "idle" | "loading" | "ready" | "saving" | "error";

type AgentPanelState = {
  permissionError: string | null;
  permissionMode: AiPermissionMode;
  permissionStatus: AiPermissionStatus;
  beginPermissionLoad(): void;
  beginPermissionSave(): void;
  failPermission(error: string): void;
  resolvePermission(mode: AiPermissionMode): void;
};

export const useAgentPanelStore = create<AgentPanelState>((set) => ({
  permissionError: null,
  permissionMode: "ask",
  permissionStatus: "idle",
  beginPermissionLoad: () => set({ permissionError: null, permissionStatus: "loading" }),
  beginPermissionSave: () => set({ permissionError: null, permissionStatus: "saving" }),
  failPermission: (permissionError) => set({ permissionError, permissionStatus: "error" }),
  resolvePermission: (permissionMode) => set({
    permissionError: null,
    permissionMode,
    permissionStatus: "ready",
  }),
}));
