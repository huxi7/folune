/**
 * [INPUT]: 依赖 Zustand 的 create
 * [OUTPUT]: 对外提供 useAgentPanelStore 与 isPermissionReady：账号隔离、默认完全访问的展示及发送确认门禁
 * [POS]: shared/store 的 AgentPanel 权限薄状态；默认值只用于首屏展示，发送必须等当前账号的 API 确认
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { AiPermissionMode } from "../api/ai";

export type AiPermissionStatus = "idle" | "loading" | "ready" | "saving" | "error";

type AgentPanelState = {
  permissionError: string | null;
  permissionMode: AiPermissionMode;
  permissionStatus: AiPermissionStatus;
  permissionUserId: string | null;
  beginPermissionLoad(userId: string): void;
  beginPermissionSave(): void;
  failPermission(error: string): void;
  resolvePermission(mode: AiPermissionMode): void;
};

export const isPermissionReady = (state: AgentPanelState, userId: string) =>
  state.permissionUserId === userId && state.permissionStatus === "ready";

export const useAgentPanelStore = create<AgentPanelState>((set) => ({
  permissionError: null,
  permissionMode: "full_access",
  permissionStatus: "idle",
  permissionUserId: null,
  beginPermissionLoad: (permissionUserId) => set((state) => ({
    permissionError: null,
    permissionMode: state.permissionUserId === permissionUserId ? state.permissionMode : "full_access",
    permissionStatus: "loading",
    permissionUserId,
  })),
  beginPermissionSave: () => set({ permissionError: null, permissionStatus: "saving" }),
  failPermission: (permissionError) => set({ permissionError, permissionStatus: "error" }),
  resolvePermission: (permissionMode) => set({
    permissionError: null,
    permissionMode,
    permissionStatus: "ready",
  }),
}));
