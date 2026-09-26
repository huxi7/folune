/**
 * [INPUT]: 依赖真实 Data Router、Dashboard controller、Memo Store、AppSidebar 与可延迟/乱序完成的创建 API
 * [OUTPUT]: 验证快速新建时每次点击结束即选中最新行，服务端回包和旧画布保存不抢回选择，失败仅回退当前创建
 * [POS]: 页面到文件树的时序回归；仅替换网络与无关后台预取，保留真实路由调度以捕获乐观树/选中不同步
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { useLayoutEffect } from "react";
import type { MemoDetailNode } from "../shared/api/memo";

const browserWindow = new Window({ url: "http://localhost:10000/app/notes/existing" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  CSS: browserWindow.CSS,
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
mock.module("../widgets/CanvasWorkspace", () => ({ preloadKnowledgeCanvas() {} }));
const { useAppDashboardController } = await import("./useAppDashboardController");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const { AppSidebar } = await import("../widgets/AppSidebar");
const { ToastProvider } = await import("../shared/design-system/components/Toast");
let controller: ReturnType<typeof useAppDashboardController>;
const noop = () => undefined;
function Harness() {
  const current = useAppDashboardController();
  useLayoutEffect(() => { controller = current; });
  return <AppSidebar activeView={current.activeView} archiveTarget={null} memoTree={current.memoTree}
    mutating={false} onCreateMemo={current.handleCreateMemo} onCreateCanvas={noop} onClose={noop}
    onMoveNode={async () => true} onPrefetchMemo={noop} onOpenDesignSystem={noop} onOpenProfile={noop}
    onOpenSettings={noop} onOpenSearch={noop} onOpenSubscription={noop} onRenameNode={async () => undefined}
    onSoftDeleteNode={async () => undefined} onRequestCreateFolder={noop} onSelectMemo={current.handleSelectMemo}
    onSelectView={current.handleSelectAuxView} onSignOut={async () => undefined} profile={current.profile}
    reveal={current.revealTarget} revealContent={false} selectedMemoId={current.routeMemoId === null ? null : current.resolveMemoId(current.routeMemoId)}
    skeletonVisible={false} treeStatus={current.renderedTreeStatus} />;
}
let router: ReturnType<typeof createMemoryRouter>;
async function setup() {
  router = createMemoryRouter([{ path: "/app", loader: () => ({ accessToken: "test", entryId: null,
    profile: { id: "test-user", username: "Test", email: null, bio: null, avatarUrl: null },
    memoTree: [detail("existing"), detail("another")],
  }), shouldRevalidate: () => false, hydrateFallbackElement: <span>加载中</span>, element: <ToastProvider><Harness /></ToastProvider>,
  children: [{ path: "notes/:noteId", element: null }, { index: true, element: null }] }], { initialEntries: ["/app/notes/existing"] });
  const view = render(<RouterProvider router={router} />);
  await waitFor(() => expect(view.getByRole("button", { name: "新建备忘录" }).hasAttribute("disabled")).toBe(false));
  return view;
}
const activeId = (container: HTMLElement) => container.querySelector('[aria-current="page"][data-memo-tree-row-id]')?.getAttribute("data-memo-tree-row-id");
const settle = async (index: number, id: string) => {
  const optimistic = useMemoTreeStore.getState().nodes.find((node) => node.id === id)!;
  await act(async () => requests[index]!.resolve({ ...detail(`server-${index}`), sort_order: optimistic.sort_order, title: optimistic.title }));
};
beforeEach(() => { requests.length = 0; frames.clear(); scrolls.length = 0; window.localStorage.clear(); });
afterEach(() => { cleanup(); router?.dispose(); useMemoTreeStore.getState().reset(); });

test("连续八次点击不等待网络或下一轮任务，路由与高亮每次立即落到最新笔记", async () => {
  const view = await setup();
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
    const id = useMemoTreeStore.getState().nodes[0]!.id;
    ids.push(id);
    expect(activeId(view.container)).toBe(id);
    expect(router.state.location.pathname).toBe(`/app/notes/${id}`);
    expect(controller.focusMemoClientKey).toBe(id);
  }
  // 只执行最新仍有效的定位回调，不允许旧目标留下平滑滚动。
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); });
  expect(scrolls).toEqual([{ id: ids[7], behavior: "instant" }]);
  await settle(7, ids[7]!);
  for (let i = 6; i >= 0; i--) {
    await settle(i, ids[i]!);
    expect(activeId(view.container)).toBe("server-7");
    expect(router.state.location.pathname).toBe("/app/notes/server-7");
  }
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
  expect(scrolls).toEqual([{ id: latest, behavior: "instant" }]);
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
