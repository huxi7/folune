/**
 * [INPUT]: 依赖真实 Data Router、Dashboard controller、Memo Store、ThemeProvider/AppSidebar 与可延迟/乱序完成的创建 API
 * [OUTPUT]: 验证快速新建时每次点击即插入并选中，但同帧仅挂载最终正文；动画保留，乱序回包、历史导航和失败不抢回新意图
 * [POS]: 页面到文件树的时序回归；仅替换网络与后台预取，Canvas 预载替身逐测恢复并保留组件导出，避免污染壳测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { Suspense, useLayoutEffect } from "react";
import type { MemoDetailNode } from "../shared/api/memo";

const browserWindow = new Window({ url: "http://localhost:10000/app/notes/existing" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  CSS: browserWindow.CSS, DOMRect: browserWindow.DOMRect,
});
window.requestIdleCallback = () => 1;
window.cancelIdleCallback = () => undefined;
window.matchMedia = ((query: string) => ({ matches: true, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
})) as typeof window.matchMedia;
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
window.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
window.cancelAnimationFrame = (id) => { frames.delete(id); };
const scrolls: { id: string | undefined; behavior: ScrollBehavior | undefined }[] = [];
Object.defineProperty(browserWindow.HTMLElement.prototype, "scrollIntoView", { configurable: true,
  value(this: HTMLElement, options: ScrollIntoViewOptions) { scrolls.push({ id: this.dataset["memoTreeRowId"], behavior: options.behavior }); },
});
const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const memoApi = await import("../shared/api/memo");
const requests: ReturnType<typeof deferred<MemoDetailNode>>[] = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const detail = (id: string): MemoDetailNode => ({
  id, title: id, children: [], parent_id: null, node_type: "memo", sort_order: "1000", revision: 1,
  user_id: "test-user", metadata: {}, color: null, icon: null, deleted_at: null, deleted_root_id: null,
  created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z",
  memo: { node_id: id, user_id: "test-user", content_mdx: "", excerpt: null, word_count: 0, metadata: {},
    created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z" },
});
mock.module("../shared/api/memo", () => ({ ...memoApi,
  getMemo: async (token: string, id: string) => detail(id),
  createMemo: () => { const request = deferred<MemoDetailNode>(); requests.push(request); return request.promise; },
}));
mock.module("./useMemoOrganize", () => ({ useMemoOrganize: () => ({ presentationRun: null, organizing: false }) }));
mock.module("./useMemoDocumentPreload", () => ({ useMemoDocumentPreload() {} }));
const canvasWorkspace = await import("../widgets/CanvasWorkspace");
let preloadSpy: ReturnType<typeof spyOn<typeof canvasWorkspace, "preloadKnowledgeCanvas">>;
const { useAppDashboardController } = await import("./useAppDashboardController");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const { AppSidebar } = await import("../widgets/AppSidebar");
const { ToastProvider } = await import("../shared/design-system/components/Toast");
const { ThemeProvider } = await import("../shared/theme/ThemeProvider");
let controller: ReturnType<typeof useAppDashboardController>;
const mountedDocuments: string[] = [];
let blockedDocument: ReturnType<typeof deferred<void>> | null = null;
function DocumentMountProbe({ id }: { id: string }) {
  useLayoutEffect(() => { mountedDocuments.push(id); }, [id]);
  if (id.startsWith("optimistic-") && blockedDocument !== null) throw blockedDocument.promise;
  return null;
}
const noop = () => undefined;
function Harness() {
  const current = useAppDashboardController();
  useLayoutEffect(() => { controller = current; });
  return <><DocumentMountProbe key={current.routeMemoId} id={current.routeMemoId ?? "empty"} /><AppSidebar activeView={current.activeView} archiveTarget={null} memoTree={current.memoTree}
    mutating={false} onCreateMemo={current.handleCreateMemo} onCreateCanvas={noop} onClose={noop}
    onMoveNode={async () => true} onPrefetchMemo={noop} onOpenDesignSystem={noop} onOpenProfile={noop}
    onOpenSettings={noop} onOpenSearch={noop} onOpenSubscription={noop} onRenameNode={async () => undefined}
    onSoftDeleteNode={async () => undefined} onRequestCreateFolder={noop} onSelectMemo={current.handleSelectMemo}
    onSelectView={current.handleSelectAuxView} onSignOut={async () => undefined} profile={current.profile}
    reveal={current.revealTarget} revealContent={false} selectedMemoId={current.sidebarSelectedMemoId}
    skeletonVisible={false} treeStatus={current.renderedTreeStatus} /></>;
}
let router: ReturnType<typeof createMemoryRouter>;
async function setup() {
  router = createMemoryRouter([{ path: "/app", loader: () => ({ accessToken: "test", entryId: null,
    profile: { id: "test-user", username: "Test", email: null, bio: null, avatarUrl: null },
    memoTree: [detail("existing"), detail("another")],
  }), shouldRevalidate: () => false, hydrateFallbackElement: <span>加载中</span>, element: <ThemeProvider><ToastProvider><Harness /></ToastProvider></ThemeProvider>,
  children: [{ path: "notes/:noteId", element: null }, { index: true, element: null }] }], { initialEntries: ["/app/notes/existing"] });
  const view = render(<Suspense fallback={<span>正文准备中</span>}><RouterProvider router={router} /></Suspense>);
  await waitFor(() => expect(view.getByRole("button", { name: "新建备忘录" }).hasAttribute("disabled")).toBe(false));
  return view;
}
const nextFrame = async () => {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
};
const activeId = (container: HTMLElement) => container.querySelector('[aria-current="page"][data-memo-tree-row-id]')?.getAttribute("data-memo-tree-row-id");
const settle = async (index: number, id: string) => {
  const optimistic = useMemoTreeStore.getState().nodes.find((node) => node.id === id)!;
  await act(async () => requests[index]!.resolve({ ...detail(`server-${index}`), sort_order: optimistic.sort_order, title: optimistic.title }));
};
beforeEach(() => {
  preloadSpy = spyOn(canvasWorkspace, "preloadKnowledgeCanvas").mockImplementation(() => {});
  blockedDocument = null; requests.length = 0; mountedDocuments.length = 0; frames.clear(); scrolls.length = 0; window.localStorage.clear();
});
afterEach(() => { cleanup(); router?.dispose(); useMemoTreeStore.getState().reset(); preloadSpy.mockRestore(); });

test("连续 32 次点击立即插入并选中，只为最后一篇挂载正文且不强制同步渲染", async () => {
  const view = await setup();
  const ids: string[] = [];
  const navigations: { path: string; flushSync: boolean }[] = [];
  const unsubscribe = router.subscribe((state, options) => {
    if (state.navigation.state === "idle") navigations.push({ path: state.location.pathname, flushSync: options.flushSync });
  });
  for (let i = 0; i < 32; i++) {
    const create = view.getByRole("button", { name: "新建备忘录" });
    expect(create.hasAttribute("disabled")).toBe(false);
    fireEvent.click(create);
    const id = useMemoTreeStore.getState().nodes[0]!.id;
    ids.push(id);
    expect(activeId(view.container)).toBe(id);
    expect(router.state.location.pathname).toBe("/app/notes/existing");
  }
  expect(requests).toHaveLength(32);
  expect(useMemoTreeStore.getState().nodes).toHaveLength(34);
  expect(mountedDocuments).toEqual(["existing"]);
  expect(navigations).toHaveLength(0);
  await nextFrame();
  expect(navigations).toEqual([{ path: `/app/notes/${ids[31]}`, flushSync: false }]);
  expect(mountedDocuments).toEqual(["existing", ids[31]!]);
  // 可见新行不滚动树，保留行自身的入场；服务器回包也不逐篇挂载正文。
  expect(scrolls).toHaveLength(0);
  await settle(31, ids[31]!);
  for (let i = 30; i >= 0; i--) {
    await settle(i, ids[i]!);
    expect(activeId(view.container)).toBe("server-31");
  }
  await nextFrame();
  expect(router.state.location.pathname).toBe("/app/notes/server-31");
  expect(navigations.every((item) => !item.flushSync)).toBe(true);
  unsubscribe();
});

test("新建后主动选择旧笔记，迟到的创建回包不能抢回高亮", async () => {
  const view = await setup();
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const id = useMemoTreeStore.getState().nodes[0]!.id;
  fireEvent.click(view.getByRole("button", { name: "another" }));
  expect(activeId(view.container)).toBe("another");
  await settle(0, id);
  expect(activeId(view.container)).toBe("another");
});

test("旧创建失败不动当前选择，最新创建失败才同步退到剩余笔记", async () => {
  const view = await setup();
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const latest = useMemoTreeStore.getState().nodes[0]!.id;
  await act(async () => requests[0]!.reject(new Error("older failed")));
  expect(activeId(view.container)).toBe(latest);
  await act(async () => requests[1]!.reject(new Error("latest failed")));
  expect(activeId(view.container)).toBe("another");
});

test("真实画布保存需要等待，但乱序保存完成只能执行最后一次选择", async () => {
  const view = await setup();
  const first = deferred<{ persisted: boolean; synced: boolean }>();
  const last = deferred<{ persisted: boolean; synced: boolean }>();
  let calls = 0;
  controller.handleCanvasSessionReady({
    flush: () => (++calls === 1 ? first.promise : last.promise),
    getReturnDescriptor: () => { throw new Error("本测试不进入画布返回流程"); },
  });
  fireEvent.click(view.getByRole("button", { name: "another" }));
  fireEvent.click(view.getByRole("button", { name: "existing" }));
  await act(async () => last.resolve({ persisted: true, synced: true }));
  await act(async () => first.resolve({ persisted: true, synced: true }));
  expect(activeId(view.container)).toBe("existing");
});

test("旧的显式定位目标不能盖过新建笔记的定位", async () => {
  const view = await setup();
  act(() => controller.setRevealTarget({ nodeId: "another", seq: 1 }));
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const latest = useMemoTreeStore.getState().nodes[0]!.id;
  expect(controller.revealTarget).toBeNull();
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); });
  expect(activeId(view.container)).toBe(latest);
  expect(scrolls).toHaveLength(0);
});

test("新建已落库但画布尚未保存，创建回包不能提前导航", async () => {
  const view = await setup();
  const saving = deferred<{ persisted: boolean; synced: boolean }>();
  controller.handleCanvasSessionReady({ flush: () => saving.promise,
    getReturnDescriptor: () => { throw new Error("本测试不进入画布返回流程"); },
  });
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const latest = useMemoTreeStore.getState().nodes[0]!.id;
  await settle(0, latest);
  expect(activeId(view.container)).toBe("existing");
  await act(async () => saving.resolve({ persisted: true, synced: true }));
  expect(activeId(view.container)).toBe("server-0");
});

test("画布等待期间新建失败，保存完成后也不能导航到已撤回节点", async () => {
  const view = await setup();
  const saving = deferred<{ persisted: boolean; synced: boolean }>();
  controller.handleCanvasSessionReady({ flush: () => saving.promise,
    getReturnDescriptor: () => { throw new Error("本测试不进入画布返回流程"); },
  });
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  await act(async () => requests[0]!.reject(new Error("failed")));
  await act(async () => saving.resolve({ persisted: true, synced: true }));
  expect(activeId(view.container)).toBe("existing");
});

test("正文尚未准备好时仍可连续创建，树的选中不随旧路由退回", async () => {
  const view = await setup();
  blockedDocument = deferred<void>();
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  await nextFrame();
  let latest = "";
  for (let index = 0; index < 4; index++) {
    fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
    latest = useMemoTreeStore.getState().nodes[0]!.id;
    expect(activeId(view.container)).toBe(latest);
    await nextFrame();
    expect(activeId(view.container)).toBe(latest);
  }
  expect(requests).toHaveLength(5);
  const blocked = blockedDocument;
  blockedDocument = null;
  await act(async () => blocked.resolve());
  expect(activeId(view.container)).toBe(latest);
  await nextFrame();
  expect(controller.routeMemoId).toBe(latest);
});

test("首帧前服务器已回包，直接打开真实 ID 且只新增一次历史", async () => {
  const view = await setup();
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const id = useMemoTreeStore.getState().nodes[0]!.id;
  await settle(0, id);
  expect(activeId(view.container)).toBe("server-0");
  expect(controller.routeMemoId).toBe("existing");
  await nextFrame();
  expect(controller.routeMemoId).toBe("server-0");
  await act(async () => { await router.navigate(-1); });
  expect(activeId(view.container)).toBe("existing");
});

test("历史返回取消尚未派发的创建导航，回包不再抢回页面", async () => {
  const view = await setup();
  fireEvent.click(view.getByRole("button", { name: "another" }));
  await nextFrame();
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const id = useMemoTreeStore.getState().nodes[0]!.id;
  await act(async () => { await router.navigate(-1); });
  await settle(0, id);
  await nextFrame();
  expect(controller.routeMemoId).toBe("existing");
  expect(activeId(view.container)).toBe("existing");
});

test("目标离屏才平滑定位，快速选择只定位最终目标", async () => {
  const view = await setup();
  const tree = view.getByRole("tree");
  tree.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200);
  const another = view.getByRole("button", { name: "another" });
  const existing = view.getByRole("button", { name: "existing" });
  another.getBoundingClientRect = () => new DOMRect(0, 240, 200, 32);
  existing.getBoundingClientRect = () => new DOMRect(0, 300, 200, 32);
  fireEvent.click(another);
  fireEvent.click(existing);
  await nextFrame();
  expect(scrolls).toEqual([{ id: "existing", behavior: "smooth" }]);
});
