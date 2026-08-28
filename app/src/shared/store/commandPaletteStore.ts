/**
 * [INPUT]: 依赖 Zustand，不依赖 React、DOM 或业务数据
 * [OUTPUT]: 对外提供全局 Command Palette 的唯一开合状态、Canvas 次级动作适配器登记与 CommandCanvasAdapter/CommandAddTarget 类型
 * [POS]: shared/store 的全局搜索唯一状态所有者；Sidebar、Paper 与 Canvas 都只是同一个 Command Surface 的入口，任何组件不得再持有第二份搜索开关或第二个相似 Dialog
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

/** 加入画布只需要这三件事，Palette 不认识 Canvas 的图结构 */
export type CommandAddTarget = {
  id: string;
  revision: number;
  title: string;
};

/**
 * Canvas 会话挂载期间登记的次级动作。Palette 因此不需要第二套 Picker：
 * 有适配器就提供「加入当前画布」，没有就只提供打开。
 */
export type CommandCanvasAdapter = {
  canvasId: string;
  onAdd: (target: CommandAddTarget) => Promise<void>;
};

type CommandPaletteStore = {
  canvas: CommandCanvasAdapter | null;
  open: boolean;
  close(): void;
  openPalette(): void;
  registerCanvas(adapter: CommandCanvasAdapter | null): void;
  toggle(): void;
};

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  canvas: null,
  open: false,
  close: () => set({ open: false }),
  openPalette: () => set({ open: true }),
  registerCanvas: (canvas) => set({ canvas }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
