/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实 KnowledgeCanvas/React Flow 节点层与可观测 Canvas 协调器替身
 * [OUTPUT]: 覆盖 Pane 双击/空间文字、文件树 memo 精准落入统一 WAL、框选、移除/撤销、来源确认、Esc 收束与 Panel 开合不穿透画布，以及正常保存静默/异常可重试
 * [POS]: KnowledgeCanvas 的浏览器 DOM 纵向交互测试；不绕过组件去单测 reducer/RPC，锁定 selectionOnDrag 下空间文字、来源确认与移除回执从真实 DOM 到 WAL/协调器/mutation 的完整链路，并证明左右 Panel 只是 Stage 浮层、开合不进入画布状态。键盘事件一律从 document.body 派发而不是 window：真实浏览器里 keydown 落在焦点元素上再冒泡 document → window，直接打在 window 上会跳过 document 这一层，而 Escape 的层级仲裁恰恰依赖这一层先于壳层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useWorkspaceChromeStore } from "../../shared/store/workspaceChromeStore";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type {
  CanvasDetail,
  CanvasMutationRequest,
  CanvasMutationResult,
} from "../../shared/api/canvas";
import type { CanvasIntent } from "../../shared/store/canvasDocument";
import { FOLUNE_MEMO_DRAG_MIME } from "../memoLibrary";
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

const tombstoneCanvas = (): CanvasDetail => {
  const detail = relationCanvas();
  const tombstone = detail.nodes[0]!;
  return {
    ...detail,
    edges: [],
    nodes: [{
      ...tombstone,
      snapshot_title: "已经永久删除的笔记",
      target: null,
      target_node_id: null,
    }],
  };
};

const originCanvas = (): CanvasDetail => ({
  ...relationCanvas(),
  canvas: {
    ...relationCanvas().canvas,
    canvas_kind: "memo_default",
    origin_node_id: "memo-a",
    origin_revision: 1,
  },
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
      entryChrome={{ libraryOpen: false }}
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

const cardButton = async (nodeId: string, label: string) => await waitFor(() => {
  const card = document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${nodeId}"]`,
  );
  expect(card).not.toBeNull();
  const button = card?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  return button!;
});

const buttonWithText = async (text: string) => await waitFor(() => {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === text);
  expect(button).not.toBeUndefined();
  return button!;
});

describe("KnowledgeCanvas 持久化反馈", () => {
  for (const status of ["idle", "saving", "recovering"] as const) {
    test(`${status} 与待提交队列保持静默`, () => {
      useCanvasWorkspaceStore.getState().replaceServer(emptyCanvas(), []);
      useCanvasWorkspaceStore.getState().setPersistence(status, 2);
      renderCanvas();
      expect(document.querySelector(".canvas-save-state")).toBeNull();
    });
  }
  test("同步失败保留可访问的异常说明和重试入口", () => {
    useCanvasWorkspaceStore.getState().replaceServer(emptyCanvas(), []);
    useCanvasWorkspaceStore.getState().setPersistence("unsaved", 2, "网络连接失败");
    renderCanvas();
    const status = document.querySelector('.canvas-save-state[role="status"]');
    expect(status?.textContent).toContain("尚未同步");
    expect(status?.textContent).toContain("网络连接失败");
    expect(status?.querySelector("button")?.textContent).toBe("重试");
  });
});

describe("KnowledgeCanvas 文件树拖入", () => {
  test("memo 拖到画布后复用 add_memo 意图并进入 WAL", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(emptyCanvas(), []);
    renderCanvas();
    const surface = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(".knowledge-canvas");
      expect(element).not.toBeNull();
      return element!;
    });
    const payload = JSON.stringify({
      id: "memo-dropped",
      kind: "memo",
      revision: 4,
      title: "拖入的笔记",
    });
    const dataTransfer = {
      dropEffect: "none",
      getData: (type: string) => type === FOLUNE_MEMO_DRAG_MIME ? payload : "",
      types: [FOLUNE_MEMO_DRAG_MIME],
    };

    fireEvent.dragOver(surface, { dataTransfer });
    expect(surface.dataset["memoDropActive"]).toBe("true");
    fireEvent.drop(surface, { clientX: 260, clientY: 180, dataTransfer });

    await waitFor(() => expect(
      useCanvasWorkspaceStore.getState().document?.nodes[0]?.target_node_id,
    ).toBe("memo-dropped"));
    const record = [...walStorage.records.values()][0];
    expect(record?.intents[0]?.operation).toMatchObject({
      target_node_id: "memo-dropped",
      type: "add_memo",
    });
  });
});

describe("KnowledgeCanvas 移除回执", () => {
  test("普通节点移除后可原子恢复节点身份、发现来源、坐标、关系与理由", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(relationCanvas(), []);
    renderCanvas();

    fireEvent.click(await cardButton("memo-card-b", "从画布移除"));
    await waitFor(() => expect(
      useCanvasWorkspaceStore.getState().document?.nodes,
    ).toHaveLength(1));
    expect(document.body.textContent).toContain("已从 Canvas 移除");
    expect(document.body.textContent).toContain("同时移除了 1 条关联");
    await coordinatorRef.current?.flush();

    fireEvent.click(await buttonWithText("撤销"));
    await waitFor(() => {
      expect(useCanvasWorkspaceStore.getState().document?.nodes).toHaveLength(2);
      expect(useCanvasWorkspaceStore.getState().document?.edges).toHaveLength(1);
    });
    await coordinatorRef.current?.flush();

    expect(mutationRequests[0]?.operations).toEqual([{
      node_id: "memo-card-b",
      type: "remove_node",
    }]);
    expect(mutationRequests[1]?.operations).toEqual([
      {
        discovered_from_id: "memo-card-a",
        node_id: "memo-card-b",
        target_node_id: "memo-b",
        type: "add_memo",
        x: 420,
        y: 220,
      },
      {
        edge_id: "edge-related",
        rationale: "两篇笔记都在追问记录如何保留真实经验。",
        source_id: "memo-card-a",
        target_id: "memo-card-b",
        type: "upsert_edge",
      },
    ]);
  });

  test("Delete 多选只写一条 WAL 记录，并以一次 mutation 移除全部节点", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(relationCanvas(), []);
    useCanvasWorkspaceStore.getState().selectNodes(["memo-card-a", "memo-card-b"]);
    renderCanvas();

    fireEvent.keyDown(document.body, { key: "Delete" });
    await waitFor(() => expect(walStorage.records.size).toBe(1));
    const record = [...walStorage.records.values()][0];
    expect(record?.intents.map((intent) => intent.operation)).toEqual([
      { node_id: "memo-card-a", type: "remove_node" },
      { node_id: "memo-card-b", type: "remove_node" },
    ]);
    await coordinatorRef.current?.flush();
    expect(mutationRequests).toHaveLength(1);
    expect(mutationRequests[0]?.operations).toHaveLength(2);
    expect(document.body.textContent).toContain("已从 Canvas 移除 2 个节点");
  });

  test("墓碑卡片只给无法撤销的诚实回执", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(tombstoneCanvas(), []);
    renderCanvas();

    fireEvent.click(await cardButton("memo-card-a", "从画布移除"));
    await waitFor(() => expect(document.body.textContent).toContain(
      "原笔记已永久删除，这次清理无法撤销。",
    ));
    expect(document.querySelector(".ds-toast-action")).toBeNull();
  });

  test("源笔记卡片取消移除后不发 mutation", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(originCanvas(), []);
    renderCanvas();

    fireEvent.click(await cardButton("memo-card-a", "从画布移除"));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    expect(document.body.textContent).toContain("原笔记完全不受影响");
    expect(document.body.textContent).toContain("永久转为独立画布");
    expect(document.body.textContent).toContain("会创建一张新的画布");

    fireEvent.click(await buttonWithText("取消"));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(walStorage.records.size).toBe(0);
    expect(mutationRequests).toHaveLength(0);
    expect(useCanvasWorkspaceStore.getState().document?.canvas.canvas_kind)
      .toBe("memo_default");
  });

  test("源笔记卡片确认后转为独立画布，回执不含撤销按钮", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(originCanvas(), []);
    renderCanvas();

    fireEvent.click(await cardButton("memo-card-a", "从画布移除"));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    expect(walStorage.records.size).toBe(0);
    expect(useCanvasWorkspaceStore.getState().document?.canvas.canvas_kind)
      .toBe("memo_default");

    fireEvent.click(await buttonWithText("解除并移除"));
    await waitFor(() => expect(
      useCanvasWorkspaceStore.getState().document?.canvas.canvas_kind,
    ).toBe("standalone"));
    expect(walStorage.records.size).toBe(1);
    expect(document.body.textContent).toContain(
      "「交互测试 Canvas」已转为独立画布",
    );
    expect(document.querySelector(".ds-toast-action")).toBeNull();
  });

  test("包含源笔记卡片的批量删除同样确认，并保持一次原子入队", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(originCanvas(), []);
    useCanvasWorkspaceStore.getState().selectNodes(["memo-card-a", "memo-card-b"]);
    renderCanvas();

    fireEvent.keyDown(document.body, { key: "Delete" });
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    expect(document.body.textContent).toContain("所选 2 个节点中包含源笔记卡片");
    expect(walStorage.records.size).toBe(0);

    fireEvent.click(await buttonWithText("解除并移除"));
    await waitFor(() => expect(walStorage.records.size).toBe(1));
    const record = [...walStorage.records.values()][0];
    expect(record?.intents.map((intent) => intent.operation)).toEqual([
      { node_id: "memo-card-a", type: "remove_node" },
      { node_id: "memo-card-b", type: "remove_node" },
    ]);
    expect(document.body.textContent).toContain(
      "撤销只恢复普通节点及仍可恢复的关联",
    );
    fireEvent.click(await buttonWithText("撤销普通节点"));
    await waitFor(() => expect(
      useCanvasWorkspaceStore.getState().document?.nodes.map((node) => node.id),
    ).toEqual(["memo-card-b"]));
    expect(useCanvasWorkspaceStore.getState().document?.canvas.canvas_kind)
      .toBe("standalone");
  });

  test("确认框内按 Esc 只关闭确认，不取消节点选择", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(originCanvas(), []);
    useCanvasWorkspaceStore.getState().selectNodes(["memo-card-a"]);
    renderCanvas();

    fireEvent.keyDown(document.body, { key: "Backspace" });
    const confirmButton = await buttonWithText("解除并移除");
    fireEvent.keyDown(confirmButton, { key: "Escape" });

    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(useCanvasWorkspaceStore.getState().selectedNodeIds).toEqual([
      "memo-card-a",
    ]);
    expect(walStorage.records.size).toBe(0);
  });
});

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

/*
 * 左右 Panel 是全屏 Stage 上的浮层, 父级轨道永远单列, 所以 Panel 开合在架构
 * 上就不该穿进画布: KnowledgeCanvas 只在入场读一次 entryChrome, 之后
 * setCanvasChrome 不在它的任何订阅里。这一组把这份「不订阅」钉死 —— 手势进行
 * 中开合面板既不能重挂输入, 也不能挪动选择、外接框或提前入队。
 */
describe("KnowledgeCanvas 与左右 Panel 的边界", () => {
  const panelToggles = [
    () => useWorkspaceChromeStore.getState().openAssistant(),
    () => useCanvasWorkspaceStore.getState().setCanvasChrome({ libraryOpen: true }),
    () => useWorkspaceChromeStore.getState().setAssistantSize("compact"),
    () => useWorkspaceChromeStore.getState().closeAssistant(),
    () => useCanvasWorkspaceStore.getState().setCanvasChrome({ libraryOpen: false }),
  ];

  test("多选后反复开合 Panel，选择、坐标与外接框都不动，也不入队", async () => {
    useCanvasWorkspaceStore.getState().replaceServer(relationCanvas(), []);
    useCanvasWorkspaceStore.getState().selectNodes(["memo-card-a", "memo-card-b"]);
    renderCanvas();

    const readGeometry = () => {
      const rect = document.querySelector<HTMLElement>(
        ".canvas-selection-bounds-rect",
      );
      expect(rect).not.toBeNull();
      return {
        bounds: [rect!.style.transform, rect!.style.width, rect!.style.height].join(" "),
        nodes: [...document.querySelectorAll<HTMLElement>(
          ".react-flow__node[data-id]",
        )]
          .map((node) => `${node.dataset.id}@${node.style.transform}`)
          .sort()
          .join("|"),
      };
    };

    const before = await waitFor(() => readGeometry());
    // memo 卡片固定 280x360, b 在 (420, 220): 并集是落在原点的 700x580
    expect(before).toEqual({
      bounds: "translate(0px,0px) 700px 580px",
      nodes: "memo-card-a@translate(0px,0px)|memo-card-b@translate(420px,220px)",
    });

    for (const toggle of panelToggles) {
      toggle();
      await waitFor(() => expect(readGeometry()).toEqual(before));
    }

    expect(useCanvasWorkspaceStore.getState().selectedNodeIds)
      .toEqual(["memo-card-a", "memo-card-b"]);
    expect(walStorage.records.size).toBe(0);
    expect(mutationRequests).toHaveLength(0);
  });

  test("自由文字编辑进行中开合 Panel，输入框不重挂、内容不丢也不提前入队", async () => {
    const editor = await openTextEditorFromPane();
    fireEvent.change(editor, { target: { value: "手势进行中不该被面板打断" } });

    for (const toggle of panelToggles) {
      toggle();
    }

    const live = await waitFor(() => {
      const element = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="自由文字"]',
      );
      expect(element).not.toBeNull();
      return element!;
    });
    expect(live).toBe(editor);
    expect(live.value).toBe("手势进行中不该被面板打断");
    expect(walStorage.records.size).toBe(0);
    expect(mutationRequests).toHaveLength(0);
  });
});
