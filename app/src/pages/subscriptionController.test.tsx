/**
 * [INPUT]: 依赖真实 Data Router、Dashboard controller、Memo Store 与可控正文 API
 * [OUTPUT]: 验证独立订阅来回保持笔记/画布身份和挂载实例，直接深链不被首屏恢复或自动新建劫持
 * [POS]: pages 的订阅导航集成门禁；只替换正文网络，控制器初始化与路由调度仍运行生产代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { useEffect, useLayoutEffect } from "react";
import { Window } from "happy-dom";
import type { MemoDetailNode, MemoTreeNode } from "../shared/api/memo";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
window.requestIdleCallback = () => 1;
window.cancelIdleCallback = () => undefined;
const { act, cleanup, render, waitFor } = await import("@testing-library/react/pure");
const { createMemoryRouter, RouterProvider, useLocation } = await import("react-router-dom");
const memoApi = await import("../shared/api/memo");
const { useAppDashboardController } = await import("./useAppDashboardController");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const { useMemoDocumentStore } = await import("../shared/store/memoDocumentStore");
const { ToastProvider } = await import("../shared/design-system/components/Toast");
const { ThemeProvider } = await import("../shared/theme/ThemeProvider");
const { SUBSCRIPTION_PATH, isSubscriptionPath, subscriptionReturnPath } = await import("./subscriptionNavigation");

const detail = (id: string): MemoDetailNode => ({
  id, title: id, children: [], parent_id: null, node_type: "memo", sort_order: "1000", revision: 1,
  user_id: "subscription-user", metadata: {}, color: null, icon: null, deleted_at: null, deleted_root_id: null,
  created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z",
  memo: { node_id: id, user_id: "subscription-user", content_mdx: "保留的草稿", excerpt: null, word_count: 0, metadata: {},
    created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z" },
});
const canvas: MemoTreeNode = { ...detail("canvas-one"), node_type: "canvas", memo: null, canvas: { kind: "standalone", origin_node_id: null } };
let controller: ReturnType<typeof useAppDashboardController>;
let router: ReturnType<typeof createMemoryRouter>;
let getMemoSpy: ReturnType<typeof spyOn<typeof memoApi, "getMemo">>;
let createMemoSpy: ReturnType<typeof spyOn<typeof memoApi, "createMemo">>;
const mounts: string[] = [];
const unmounts: string[] = [];

function MountProbe({ id }: { id: string }) {
  useEffect(() => { mounts.push(id); return () => { unmounts.push(id); }; }, [id]);
  return <textarea aria-label="未保存草稿" defaultValue="草稿仍在" />;
}
function Harness() {
  const value = useAppDashboardController();
  const location = useLocation();
  useLayoutEffect(() => { controller = value; });
  return <>
    <div hidden={isSubscriptionPath(location.pathname)}>
      <MountProbe key={value.routeMemoId} id={value.routeMemoId ?? "empty"} />
    </div>
    <output data-testid="route-node">{value.routeMemoId ?? "empty"}</output>
  </>;
}
async function setup(path: string, tree: MemoTreeNode[] = [detail("memo-one"), canvas]) {
  router = createMemoryRouter([{ path: "/app", loader: () => ({ accessToken: "test-token", entryId: null,
    profile: { id: "subscription-user", username: "Test", email: null, bio: null, avatarUrl: null }, memoTree: tree,
  }), shouldRevalidate: () => false, hydrateFallbackElement: <span>加载中</span>,
  element: <ThemeProvider><ToastProvider><Harness /></ToastProvider></ThemeProvider>,
  children: [{ path: "notes/:noteId", element: null }, { path: "subscription", element: null }, { index: true, element: null }] }], { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await waitFor(() => expect(view.getByTestId("route-node")).toBeTruthy());
  return view;
}
beforeEach(() => {
  mounts.length = 0;
  unmounts.length = 0;
  window.localStorage.clear();
  getMemoSpy = spyOn(memoApi, "getMemo").mockImplementation(async (_token, id) => detail(id));
  createMemoSpy = spyOn(memoApi, "createMemo").mockImplementation(async () => detail("created"));
});
afterEach(() => {
  cleanup();
  router?.dispose();
  useMemoTreeStore.getState().reset();
  useMemoDocumentStore.getState().reset();
  getMemoSpy.mockRestore();
  createMemoSpy.mockRestore();
});

describe("Dashboard 的独立订阅导航", () => {
  test.each(["memo-one", "canvas-one"])("从 %s 打开订阅再返回，底层身份和挂载实例保持", async (id) => {
    const originalPath = `/app/notes/${id}`;
    const view = await setup(originalPath);
    const draft = view.getByRole("textbox") as HTMLTextAreaElement;
    draft.value = "刚写下还没提交的内容";
    const originalNode = controller.selectedMemo;
    await act(async () => { await router.navigate(SUBSCRIPTION_PATH, { state: { workspacePath: originalPath } }); });
    expect(controller.routeMemoId).toBe(id);
    expect(controller.selectedMemo).toBe(originalNode);
    expect(mounts).toEqual([id]);
    expect(unmounts).toEqual([]);
    expect(view.queryByRole("textbox")).toBeNull();
    await act(async () => { await router.navigate(subscriptionReturnPath(router.state.location.state), { replace: true }); });
    expect(view.getByRole("textbox")).toBe(draft);
    expect(draft.value).toBe("刚写下还没提交的内容");
    expect(router.state.location.pathname).toBe(originalPath);
    expect(createMemoSpy).not.toHaveBeenCalled();
  });

  test.each([SUBSCRIPTION_PATH, `${SUBSCRIPTION_PATH}/`])("直接订阅深链 %s 不会恢复最近笔记；主动返回后原恢复流程才生效", async (path) => {
    window.localStorage.setItem("folune:last-memo:subscription-user", "memo-one");
    await setup(path);
    expect(router.state.location.pathname).toBe(path);
    expect(controller.routeMemoId).toBeNull();
    expect(createMemoSpy).not.toHaveBeenCalled();
    await act(async () => { await router.navigate("/app", { replace: true }); });
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/notes/memo-one"));
  });

  test("空账户直达订阅不自动创建笔记，返回工作区再初始化", async () => {
    await setup(SUBSCRIPTION_PATH, []);
    expect(router.state.location.pathname).toBe(SUBSCRIPTION_PATH);
    expect(createMemoSpy).not.toHaveBeenCalled();
    await act(async () => { await router.navigate("/app", { replace: true }); });
    await waitFor(() => expect(createMemoSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/notes/created"));
  });
});
