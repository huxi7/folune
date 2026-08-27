/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实 KnowledgeCanvas/React Flow 节点层与可观测 Canvas 协调器替身
 * [OUTPUT]: 覆盖 Pane 双击到 textarea、提交 intent/乐观持久化，以及空白和 Esc 取消不入队的交互回归测试
 * [POS]: KnowledgeCanvas 的浏览器 DOM 纵向交互测试；不绕过组件去单测 reducer，专门锁定 selectionOnDrag 下的自由文字入口与保存链
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type {
  CanvasDetail,
  CanvasMutationRequest,
  CanvasMutationResult,
} from "../../shared/api/canvas";
import type { CanvasIntent } from "../../shared/store/canvasDocument";
import {
  CanvasSaveCoordinator,
  type CanvasCoordinatorSink,
} from "../../shared/store/CanvasSaveCoordinator";
import {
  createMemoryCanvasWalStorage,
  type CanvasWalStorage,
} from "../../shared/store/canvasWal";

const browserWindow = new Window({ url: "http://localhost:10000/app/canvas/test-canvas" });
const coordinatorRef: { current: CanvasSaveCoordinator | null } = { current: null };
const mutationRequests: CanvasMutationRequest[] = [];
let walStorage: ReturnType<typeof createMemoryCanvasWalStorage>;

mock.module("./useCanvasSessionCoordinator", () => ({
  useCanvasSessionCoordinator() {
    return {
      coordinatorRef,
      loadStatus: "ready" as const,
    };
  },
}));

const emptyCanvas = (): CanvasDetail => ({
  canvas: {
    canvas_kind: "standalone",
    created_at: "2026-08-27T00:00:00.000Z",
    metadata: {},
    node_id: "test-canvas",
    origin_node_id: null,
    origin_revision: null,
    updated_at: "2026-08-27T00:00:00.000Z",
    user_id: "test-user",
    version: 1,
    viewport: { user_moved: false, x: 0, y: 0, zoom: 1 },
  },
  edges: [],
  node: {
    children: [],
    color: null,
    created_at: "2026-08-27T00:00:00.000Z",
    deleted_at: null,
    deleted_root_id: null,
    id: "test-canvas",
    icon: null,
    memo: null,
    metadata: {},
    node_type: "canvas",
    parent_id: null,
    revision: 1,
    sort_order: "a0",
    title: "交互测试 Canvas",
    updated_at: "2026-08-27T00:00:00.000Z",
    user_id: "test-user",
  },
  nodes: [],
});

Object.assign(globalThis, {
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  HTMLInputElement: browserWindow.HTMLInputElement,
  HTMLTextAreaElement: browserWindow.HTMLTextAreaElement,
  KeyboardEvent: browserWindow.KeyboardEvent,
  MouseEvent: browserWindow.MouseEvent,
  MutationObserver: browserWindow.MutationObserver,
  navigator: browserWindow.navigator,
  PointerEvent: browserWindow.PointerEvent,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  ResizeObserver: browserWindow.ResizeObserver,
  window: browserWindow,
});

const { cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react/pure");
const { useCanvasWorkspaceStore } =
  await import("../../shared/store/canvasWorkspaceStore");
const { ToastProvider } =
  await import("../../shared/design-system/components");
const { KnowledgeCanvas } = await import("./KnowledgeCanvas");

beforeEach(() => {
  mutationRequests.length = 0;
  useCanvasWorkspaceStore.getState().beginSession({
    assistantOpen: false,
    canvasId: "test-canvas",
    detail: emptyCanvas(),
    libraryOpen: false,
    userId: "test-user",
  });
  walStorage = createMemoryCanvasWalStorage();
  const sink: CanvasCoordinatorSink = {
    applyLocal(intent: CanvasIntent) {
      useCanvasWorkspaceStore.getState().applyLocal(intent);
    },
    confirm(intents, result, pending) {
      useCanvasWorkspaceStore.getState().confirmMutation(intents, result, pending);
    },
    getServerVersion() {
      return useCanvasWorkspaceStore.getState().serverDocument?.canvas.version ?? 1;
    },
    replaceServer(detail, pending) {
      useCanvasWorkspaceStore.getState().replaceServer(detail, pending);
    },
    setPersistence(status, count, message) {
      useCanvasWorkspaceStore.getState().setPersistence(status, count, message);
    },
  };
  coordinatorRef.current = new CanvasSaveCoordinator({
    scope: { canvasId: "test-canvas", userId: "test-user" },
    sink,
    storage: walStorage as CanvasWalStorage,
    transport: {
      async commitExpansion() {
        throw new Error("本测试不应触发 AI 拓展");
      },
      async getCanvas() {
        return emptyCanvas();
      },
      keepalive() {
        return false;
      },
      async mutate(request) {
        mutationRequests.push(request);
        return {
          aliases: [],
          dropped: [],
          expansion_status: null,
          intent_digest: "a".repeat(64),
          mutation_id: request.mutation_id,
          noops: [],
          removed_edge_ids: [],
          removed_node_ids: [],
          upserted_edges: [],
          upserted_nodes: [],
          version: request.base_version + 1,
        } satisfies CanvasMutationResult;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  coordinatorRef.current?.dispose();
  coordinatorRef.current = null;
  useCanvasWorkspaceStore.getState().reset();
});

const renderCanvas = () => render(
  <ToastProvider>
    <KnowledgeCanvas
      accessToken="test-token"
      canvasId="test-canvas"
      initialAssistantOpen={false}
      initialLibraryOpen={false}
      onEditMemo={() => undefined}
      onSelectMemo={() => undefined}
      userId="test-user"
    />
  </ToastProvider>,
);

const openTextEditorFromPane = async () => {
  renderCanvas();
  const pane = await waitFor(() => {
    const element = document.querySelector<HTMLElement>(".react-flow__pane");
    expect(element).not.toBeNull();
    return element!;
  });
  fireEvent.doubleClick(pane, { button: 0, clientX: 160, clientY: 120 });
  return await waitFor(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="自由文字"]',
    );
    expect(editor).not.toBeNull();
    return editor!;
  });
};

describe("KnowledgeCanvas 自由文字纵向交互", () => {
  test("Pane 双击创建 textarea，失焦后进入协调器并成为唯一节点", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.change(editor, { target: { value: "从 Pane 写下的真实文字" } });
    fireEvent.blur(editor);

    await waitFor(() => expect(walStorage.records.size).toBe(1));
    expect([...walStorage.records.values()][0]?.intents[0]?.operation).toMatchObject({
      text: "从 Pane 写下的真实文字",
      type: "create_text",
    });
    expect(await coordinatorRef.current?.flush()).toEqual({
      persisted: true,
      synced: true,
    });
    expect(mutationRequests).toHaveLength(1);
    expect(mutationRequests[0]?.operations[0]).toMatchObject({
      text: "从 Pane 写下的真实文字",
      type: "create_text",
    });
    expect(walStorage.records.size).toBe(0);
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(1);
    expect(useCanvasWorkspaceStore.getState().document?.nodes[0]?.text)
      .toBe("从 Pane 写下的真实文字");
  });

  test("已有自由文字再次双击编辑，更新后仍只有一个持久节点", async () => {
    const firstEditor = await openTextEditorFromPane();
    fireEvent.change(firstEditor, { target: { value: "初稿" } });
    fireEvent.blur(firstEditor);
    await coordinatorRef.current?.flush();

    const textNode = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(".canvas-text-node");
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.doubleClick(textNode, { button: 0 });
    const editor = await waitFor(() => {
      const element = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="自由文字"]',
      );
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.change(editor, { target: { value: "修改后的正文" } });
    fireEvent.blur(editor);
    await coordinatorRef.current?.flush();

    expect(mutationRequests).toHaveLength(2);
    expect(mutationRequests[1]?.operations[0]).toMatchObject({
      text: "修改后的正文",
      type: "update_node",
    });
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(1);
    expect(useCanvasWorkspaceStore.getState().document?.nodes[0]?.text)
      .toBe("修改后的正文");
  });

  test("空内容失焦不入队，也不产生节点", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.blur(editor);

    await waitFor(() => expect(document.querySelector(
      'textarea[aria-label="自由文字"]',
    )).toBeNull());
    expect(mutationRequests).toHaveLength(0);
    expect(walStorage.records.size).toBe(0);
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(0);
  });

  test("按 Esc 取消不入队，也不产生节点", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.change(editor, { target: { value: "这段应当被取消" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    await waitFor(() => expect(document.querySelector(
      'textarea[aria-label="自由文字"]',
    )).toBeNull());
    expect(mutationRequests).toHaveLength(0);
    expect(walStorage.records.size).toBe(0);
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(0);
  });
});
