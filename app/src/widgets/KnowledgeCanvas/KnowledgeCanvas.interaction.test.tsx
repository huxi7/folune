/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实 KnowledgeCanvas/React Flow 节点层与可观测 Canvas 协调器替身
 * [OUTPUT]: 覆盖 Pane 双击到 textarea、内容边界提交、再次编辑不跳变、清空已有文字即删除、四角等比缩放、多选立刻成框且与 React Flow 自带框互斥、关系注册与理由的键盘/保持查看、统一持久化，以及新建空白和 Esc 取消不入队的交互回归测试
 * [POS]: KnowledgeCanvas 的浏览器 DOM 纵向交互测试；不绕过组件去单测 reducer/RPC，专门锁定 selectionOnDrag 下空间文字从入口到 WAL/协调器/mutation 的完整链路
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

const relationCanvas = (): CanvasDetail => ({
  ...emptyCanvas(),
  edges: [{
    created_by: "ai",
    id: "edge-related",
    rationale: "两篇笔记都在追问记录如何保留真实经验。",
    source_id: "memo-card-a",
    target_id: "memo-card-b",
  }],
  nodes: [
    {
      created_by: "user",
      discovered_from_id: null,
      height: null,
      id: "memo-card-a",
      kind: "memo_ref",
      snapshot_excerpt: "记录让经验可以被再次理解。",
      snapshot_revision: 1,
      snapshot_title: "我们为什么记录",
      target: {
        deleted_at: null,
        excerpt: "记录让经验可以被再次理解。",
        node_id: "memo-a",
        revision: 1,
        title: "我们为什么记录",
      },
      target_node_id: "memo-a",
      text: null,
      text_scale: null,
      width: null,
      x: 0,
      y: 0,
    },
    {
      created_by: "ai",
      discovered_from_id: "memo-card-a",
      height: null,
      id: "memo-card-b",
      kind: "memo_ref",
      snapshot_excerpt: "回看使零散片段重新获得关系。",
      snapshot_revision: 1,
      snapshot_title: "回看的意义",
      target: {
        deleted_at: null,
        excerpt: "回看使零散片段重新获得关系。",
        node_id: "memo-b",
        revision: 1,
        title: "回看的意义",
      },
      target_node_id: "memo-b",
      text: null,
      text_scale: null,
      width: null,
      x: 420,
      y: 220,
    },
  ],
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
const { CanvasEdgeReasonInspector } = await import("./CanvasCordEdge");

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
      entryChrome={{ assistantOpen: false, libraryOpen: false }}
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

const setMeasuredTextSize = (width: number, height: number) => {
  const measure = document.querySelector<HTMLElement>(".canvas-text-measure");
  expect(measure).not.toBeNull();
  Object.defineProperties(measure!, {
    offsetHeight: { configurable: true, value: height },
    offsetWidth: { configurable: true, value: width },
    scrollHeight: { configurable: true, value: height },
    scrollWidth: { configurable: true, value: width },
  });
};

describe("KnowledgeCanvas 自由文字纵向交互", () => {
  test("两张卡片保留关系注册，AI 理由可聚焦查看并点击保持", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(relationCanvas(), []);
    renderCanvas();

    await waitFor(() => expect(document.querySelectorAll(
      ".canvas-card-center-handle",
    )).toHaveLength(4));
    render(
      <CanvasEdgeReasonInspector
        createdBy="ai"
        onRemove={() => undefined}
        rationale="两篇笔记都在追问记录如何保留真实经验。"
      />,
    );
    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="查看AI 关联理由"]',
    );
    expect(trigger).not.toBeNull();

    fireEvent.focus(trigger!);
    await waitFor(() => expect(document.body.textContent).toContain(
      "两篇笔记都在追问记录如何保留真实经验。",
    ));
    fireEvent.click(trigger!);
    fireEvent.blur(trigger!);

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("AI 关联理由");
  });

  /*
   * 选择只能有一个所有者。本地 Store 与 React Flow 互为输入时, 进入默认 Canvas
   * 的那一刻两边就会开始一帧一帧互相纠正(Store 已有聚焦节点, React Flow 这一帧
   * 还是空的), React 直接抛 Maximum update depth exceeded。这条测试因此既锁定
   * "入口聚焦确实到达画布", 也锁定"它到达之后一切静止"。
   */
  test("带聚焦节点进入画布，聚焦卡片选中且镜像静止在同一个答案", async () => {
    useCanvasWorkspaceStore.getState().beginSession({
      assistantOpen: false,
      canvasId: "test-canvas",
      detail: relationCanvas(),
      focusNodeId: "memo-card-a",
      libraryOpen: false,
      userId: "test-user",
    });
    renderCanvas();

    await waitFor(() => expect(document.querySelectorAll(
      '.canvas-card[data-selected="true"]',
    )).toHaveLength(1));
    expect(useCanvasWorkspaceStore.getState().selectedNodeIds).toEqual([
      "memo-card-a",
    ]);
    // 静止单选交给卡片自己的描边, 不额外套一个只贴着它的成组框
    expect(document.querySelector(".canvas-selection-bounds-rect")).toBeNull();
  });

  /*
   * 用户看到的框必须在选中的那一刻就在, 而不是等 React Flow 的 NodesSelection
   * 在框选松手后短暂出现一下; 两个框也不能同时存在, 否则松手时会看到框叠一层。
   */
  test("多选立刻出现成组外接框，矩形是两张卡片的并集且不与自带框并存", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(relationCanvas(), []);
    useCanvasWorkspaceStore.getState().selectNodes(["memo-card-a", "memo-card-b"]);
    renderCanvas();

    const rect = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        ".canvas-selection-bounds-rect",
      );
      expect(element).not.toBeNull();
      return element!;
    });
    // memo 卡片固定 280x360, b 在 (420, 220): 并集是落在原点的 700x580
    expect(rect.style.width).toBe("700px");
    expect(rect.style.height).toBe("580px");
    expect(rect.style.transform).toBe("translate(0px,0px)");
    expect(document.querySelector(".react-flow__nodesselection")).toBeNull();
  });

  test("Pane 双击创建 textarea，失焦后进入协调器并成为唯一节点", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.change(editor, { target: { value: "从 Pane 写下的真实文字" } });
    setMeasuredTextSize(216, 48);
    const pane = document.querySelector<HTMLElement>(".react-flow__pane")!;
    fireEvent.pointerDown(pane);
    fireEvent.pointerDown(pane);

    await waitFor(() => expect(walStorage.records.size).toBe(1));
    expect([...walStorage.records.values()][0]?.intents[0]?.operation).toMatchObject({
      text: "从 Pane 写下的真实文字",
      height: 48,
      text_scale: 1,
      type: "create_text",
      width: 217,
    });
    expect(await coordinatorRef.current?.flush()).toEqual({
      persisted: true,
      synced: true,
    });
    expect(mutationRequests).toHaveLength(1);
    expect(mutationRequests[0]?.operations[0]).toMatchObject({
      text: "从 Pane 写下的真实文字",
      height: 48,
      text_scale: 1,
      type: "create_text",
      width: 217,
    });
    expect(walStorage.records.size).toBe(0);
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(1);
    expect(useCanvasWorkspaceStore.getState().document?.nodes[0]?.text)
      .toBe("从 Pane 写下的真实文字");
  });

  test("已有自由文字再次双击编辑，更新后仍只有一个持久节点", async () => {
    const firstEditor = await openTextEditorFromPane();
    fireEvent.change(firstEditor, { target: { value: "初稿" } });
    setMeasuredTextSize(120, 48);
    fireEvent.blur(firstEditor);
    await coordinatorRef.current?.flush();

    const textNode = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(".canvas-text-node");
      expect(element).not.toBeNull();
      return element!;
    });
    const beforeEditSurface = textNode.querySelector<HTMLElement>(".canvas-text-surface");
    expect(beforeEditSurface?.style.cssText).toContain("transform: scale(1)");
    fireEvent.doubleClick(textNode, { button: 0 });
    const editor = await waitFor(() => {
      const element = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="自由文字"]',
      );
      expect(element).not.toBeNull();
      return element!;
    });
    expect(textNode.querySelector<HTMLElement>(".canvas-text-surface")?.style.cssText)
      .toBe(beforeEditSurface?.style.cssText);
    fireEvent.change(editor, { target: { value: "修改后的正文" } });
    setMeasuredTextSize(180, 72);
    fireEvent.blur(editor);
    await coordinatorRef.current?.flush();

    expect(mutationRequests).toHaveLength(2);
    expect(mutationRequests[1]?.operations[0]).toMatchObject({
      text: "修改后的正文",
      height: 72,
      type: "update_node",
      width: 181,
    });
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(1);
    expect(useCanvasWorkspaceStore.getState().document?.nodes[0]?.text)
      .toBe("修改后的正文");
  });

  test("已有自由文字清空后点击 Pane，经统一 mutation 删除节点", async () => {
    const firstEditor = await openTextEditorFromPane();
    fireEvent.change(firstEditor, { target: { value: "待删除文字" } });
    setMeasuredTextSize(120, 48);
    fireEvent.blur(firstEditor);
    await coordinatorRef.current?.flush();
    const nodeId = useCanvasWorkspaceStore.getState().document?.nodes[0]?.id;
    if (nodeId === undefined) throw new Error("测试前置自由文字创建失败");

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
    fireEvent.change(editor, { target: { value: "" } });
    const pane = document.querySelector<HTMLElement>(".react-flow__pane")!;
    fireEvent.pointerDown(pane, { button: 0 });

    await waitFor(() => expect(textNode.isConnected).toBe(false));
    await waitFor(() => expect(walStorage.records.size).toBe(1));
    expect([...walStorage.records.values()][0]?.intents[0]?.operation).toEqual({
      node_id: nodeId,
      type: "remove_node",
    });
    expect(await coordinatorRef.current?.flush()).toEqual({
      persisted: true,
      synced: true,
    });
    expect(mutationRequests).toHaveLength(2);
    expect(mutationRequests[1]?.operations).toEqual([{
      node_id: nodeId,
      type: "remove_node",
    }]);
    expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(0);
  });

  test("选中自由文字只渲染四个角点，不产生侧边缩放控件", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.change(editor, { target: { value: "等比缩放" } });
    setMeasuredTextSize(160, 64);
    fireEvent.blur(editor);
    await coordinatorRef.current?.flush();

    const textNode = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(".canvas-text-node");
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.click(textNode, { button: 0 });

    const handles = await waitFor(() => {
      const elements = [...document.querySelectorAll<HTMLElement>(
        ".canvas-node-resize-handle",
      )];
      expect(elements).toHaveLength(4);
      return elements;
    });
    expect(handles.map((handle) => handle.className)).toEqual([
      expect.stringContaining("top left"),
      expect.stringContaining("top right"),
      expect.stringContaining("bottom left"),
      expect.stringContaining("bottom right"),
    ]);
    expect(document.querySelectorAll(".canvas-node-resize-line")).toHaveLength(0);
  });

  test("编辑态只显示输入光标，不显示选择边框和缩放角点", async () => {
    const editor = await openTextEditorFromPane();
    const textNode = document.querySelector<HTMLElement>(".canvas-text-node");

    expect(textNode).not.toBeNull();
    expect(textNode?.dataset.editing).toBe("true");
    expect(document.activeElement).toBe(editor);
    expect(document.querySelectorAll(".canvas-node-resize-handle")).toHaveLength(0);
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
