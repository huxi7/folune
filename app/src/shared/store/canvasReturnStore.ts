/**
 * [INPUT]: 依赖 Zustand、CanvasViewport 与 workspaceChromeStore 的助手尺寸类型
 * [OUTPUT]: 对外提供标签页内含助手模式/自定义浮窗的CanvasReturnDescriptor及set/clear命令
 * [POS]: shared/store 的 Canvas→原文→Canvas 返回描述；只保存路由/视口/选择/临时 Panel，不持久化业务数据或 WAL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { CanvasViewport } from "../api/canvas";
import type { AssistantFrame, AssistantSize } from "./workspaceChromeStore";

export type CanvasReturnDescriptor = {
  assistantSize?: AssistantSize;
  assistantFrame?: AssistantFrame | null;
  canvasId: string;
  libraryOpen: boolean;
  selectedNodeId: string | null;
  title: string;
  viewport: CanvasViewport;
};

type CanvasReturnStore = {
  descriptor: CanvasReturnDescriptor | null;
  clear(): void;
  set(descriptor: CanvasReturnDescriptor): void;
};

export const useCanvasReturnStore = create<CanvasReturnStore>((set) => ({
  descriptor: null,
  clear: () => set({ descriptor: null }),
  set: (descriptor) => set({ descriptor }),
}));
