/**
 * [INPUT]: 依赖 Zustand、Canvas V2 API 文档/回执与 canvasDocument 的纯投影
 * [OUTPUT]: 对外提供单一 canvasWorkspaceStore，逻辑分为服务端文档、交互会话与持久化状态三组字段和命令
 * [POS]: shared/store 的 Canvas Workspace 唯一客户端状态源；不复制 memo 正文、不持有计时器或网络重试，后两者只属于 CanvasSaveCoordinator
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type {
  CanvasDetail,
  CanvasMutationResult,
} from "../api/canvas";
import {
  applyCanvasIntents,
  applyCanvasMutationResult,
  type CanvasIntent,
} from "./canvasDocument";

export type CanvasPersistenceStatus =
  | "idle"
  | "recovering"
  | "saving"
  | "unsaved"
  | "conflict"
  | "recovery_error"
  | "local_recovery_unavailable";

type CanvasDocumentSlice = {
  userId: string | null;
  canvasId: string | null;
  serverDocument: CanvasDetail | null;
  document: CanvasDetail | null;
};

type CanvasInteractionSlice = {
  selectedNodeIds: string[];
  previewNodeId: string | null;
  editingTextNodeId: string | null;
  connectionSourceId: string | null;
  aiSourceNodeId: string | null;
  aiLoading: boolean;
  libraryOpen: boolean;
  assistantOpen: boolean;
};

type CanvasPersistenceSlice = {
  persistenceStatus: CanvasPersistenceStatus;
  persistenceMessage: string | null;
  pendingCount: number;
};

type CanvasWorkspaceActions = {
  beginSession(input: {
    userId: string;
    canvasId: string;
    detail: CanvasDetail;
    focusNodeId?: string | null;
    libraryOpen: boolean;
    assistantOpen: boolean;
  }): void;
  applyLocal(intent: CanvasIntent): void;
  replaceServer(detail: CanvasDetail, pending: readonly CanvasIntent[]): void;
  confirmMutation(
    intents: readonly CanvasIntent[],
    result: CanvasMutationResult,
    pending: readonly CanvasIntent[],
  ): void;
  setPersistence(
    status: CanvasPersistenceStatus,
    pendingCount: number,
    message?: string | null,
  ): void;
  selectNodes(nodeIds: readonly string[]): void;
  openPreview(nodeId: string | null): void;
  editText(nodeId: string | null): void;
  startConnection(nodeId: string | null): void;
  setAiLoading(loading: boolean, sourceNodeId?: string | null): void;
  setCanvasChrome(input: { libraryOpen?: boolean; assistantOpen?: boolean }): void;
  reset(): void;
};

export type CanvasWorkspaceState =
  & CanvasDocumentSlice
  & CanvasInteractionSlice
  & CanvasPersistenceSlice
  & CanvasWorkspaceActions;

const initialState: CanvasDocumentSlice & CanvasInteractionSlice & CanvasPersistenceSlice = {
  aiLoading: false,
  aiSourceNodeId: null,
  assistantOpen: false,
  canvasId: null,
  connectionSourceId: null,
  document: null,
  editingTextNodeId: null,
  libraryOpen: false,
  pendingCount: 0,
  persistenceMessage: null,
  persistenceStatus: "idle",
  previewNodeId: null,
  selectedNodeIds: [],
  serverDocument: null,
  userId: null,
};

const uniqueExistingIds = (
  detail: CanvasDetail | null,
  ids: readonly string[],
): string[] => {
  if (detail === null) return [];
  const existing = new Set(detail.nodes.map((node) => node.id));
  return [...new Set(ids)].filter((id) => existing.has(id));
};

export const useCanvasWorkspaceStore = create<CanvasWorkspaceState>()((set, get) => ({
  ...initialState,

  beginSession(input) {
    set({
      ...initialState,
      assistantOpen: input.assistantOpen,
      canvasId: input.canvasId,
      document: input.detail,
      libraryOpen: input.libraryOpen,
      selectedNodeIds: input.focusNodeId === null || input.focusNodeId === undefined
        ? []
        : uniqueExistingIds(input.detail, [input.focusNodeId]),
      serverDocument: input.detail,
      userId: input.userId,
    });
  },

  applyLocal(intent) {
    const document = get().document;
    if (document === null) return;
    const next = applyCanvasIntents(document, [intent]);
    set({
      document: next,
      selectedNodeIds: uniqueExistingIds(next, get().selectedNodeIds),
    });
  },

  replaceServer(detail, pending) {
    const document = applyCanvasIntents(detail, pending);
    set({
      document,
      selectedNodeIds: uniqueExistingIds(document, get().selectedNodeIds),
      serverDocument: detail,
    });
  },

  confirmMutation(intents, result, pending) {
    const serverDocument = get().serverDocument;
    if (serverDocument === null) return;
    const nextServer = applyCanvasMutationResult(serverDocument, intents, result);
    const document = applyCanvasIntents(nextServer, pending);
    set({
      document,
      selectedNodeIds: uniqueExistingIds(document, get().selectedNodeIds),
      serverDocument: nextServer,
    });
  },

  setPersistence(persistenceStatus, pendingCount, persistenceMessage = null) {
    set({ pendingCount, persistenceMessage, persistenceStatus });
  },

  selectNodes(nodeIds) {
    const next = uniqueExistingIds(get().document, nodeIds);
    const current = get().selectedNodeIds;
    if (
      current.length === next.length
      && current.every((id, index) => id === next[index])
    ) {
      return;
    }
    set({ selectedNodeIds: next });
  },

  openPreview(previewNodeId) {
    set({
      connectionSourceId: null,
      editingTextNodeId: null,
      previewNodeId,
    });
  },

  editText(editingTextNodeId) {
    set({
      connectionSourceId: null,
      editingTextNodeId,
      previewNodeId: null,
    });
  },

  startConnection(connectionSourceId) {
    set({
      connectionSourceId,
      editingTextNodeId: null,
      previewNodeId: null,
    });
  },

  setAiLoading(aiLoading, sourceNodeId = null) {
    set({
      aiLoading,
      aiSourceNodeId: aiLoading ? sourceNodeId : null,
    });
  },

  setCanvasChrome(input) {
    set((state) => ({
      assistantOpen: input.assistantOpen ?? state.assistantOpen,
      libraryOpen: input.libraryOpen ?? state.libraryOpen,
    }));
  },

  reset() {
    set(initialState);
  },
}));
