/**
 * [INPUT]: 依赖 Zustand 的 create
 * [OUTPUT]: 对外提供只含 open/close/toggle 的 useAgentPanelStore
 * [POS]: shared/store 的薄 UI 状态；只控制 AgentPanel 外壳可见性，禁止镜像 useChat 消息、错误或流状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

type AgentPanelState = {
  isOpen: boolean;
  close(): void;
  open(): void;
  toggle(): void;
};

export const useAgentPanelStore = create<AgentPanelState>((set) => ({
  isOpen: true,
  close: () => set({ isOpen: false }),
  open: () => set({ isOpen: true }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
