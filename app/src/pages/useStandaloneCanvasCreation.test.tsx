/**
 * [INPUT]: 依赖 happy-dom、真实画布创建 Hook/Tree Store 与可控 Canvas API
 * [OUTPUT]: 验证连续新建读取最新同级编号、同帧重复提交被拦截、服务端回名被接纳与失败后可重试
 * [POS]: pages 的独立画布创建回归门禁；只替换创建网络，命名、树合并和导航仍走生产编排
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { MemoTreeNode } from "../shared/api/memo";
import type { CanvasEntryResult } from "../shared/api/canvas";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node });
const { act, cleanup, renderHook } = await import("@testing-library/react/pure");
const canvasApi = await import("../shared/api/canvas");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const { useStandaloneCanvasCreation } = await import("./useStandaloneCanvasCreation");
const TIME = "2026-10-03T00:00:00.000Z";
const node = (title: string, parentId: string | null = null): MemoTreeNode => ({
  id: crypto.randomUUID(), user_id: "test-user", parent_id: parentId, node_type: "canvas", title,
  sort_order: "1000", revision: 1, color: null, icon: null, metadata: {}, memo: null,
  deleted_at: null, deleted_root_id: null, created_at: TIME, updated_at: TIME, children: [],
});
const entry = (title: string, parentId: string | null = null): CanvasEntryResult => {
  const created = node(title, parentId);
  return { node: created, created: true, focus_node_id: null, canvas: {
    node_id: created.id, user_id: created.user_id, canvas_kind: "standalone", origin_node_id: null,
    origin_revision: null, version: 0, viewport: {}, metadata: {}, created_at: TIME, updated_at: TIME,
  } };
};
let createSpy: ReturnType<typeof spyOn<typeof canvasApi, "createStandaloneCanvas">>;
afterEach(() => { cleanup(); createSpy?.mockRestore(); useMemoTreeStore.getState().reset(); });
const setup = () => {
  const navigations: string[] = [];
  const failures: unknown[] = [];
  const hook = renderHook(() => useStandaloneCanvasCreation({
    accessToken: "test-token", mergeServerNode: useMemoTreeStore.getState().mergeServerNode,
    navigate: (target) => { navigations.push(String(target)); }, toast: (input) => { failures.push(input); },
  }));
  return { ...hook, navigations, failures };
};

test("连续创建复用最新树的同级编号，并接纳服务端让号结果", async () => {
  const folder = { ...node("目录"), node_type: "folder" as const };
  folder.children = [node("未命名 Canvas 7", folder.id)];
  useMemoTreeStore.setState({ nodes: [node("未命名 Canvas 99"), folder] });
  const proposed: string[] = [];
  createSpy = spyOn(canvasApi, "createStandaloneCanvas").mockImplementation(async (_token, input) => {
    const title = input.title ?? "";
    proposed.push(title);
    return entry(proposed.length === 1 ? "未命名 Canvas 10" : title, input.parent_id);
  });
  const view = setup();
  await act(async () => { await view.result.current.createCanvas(folder.id); });
  await act(async () => { await view.result.current.createCanvas(folder.id); });
  expect(proposed).toEqual(["未命名 Canvas 8", "未命名 Canvas 11"]);
  expect(view.navigations).toHaveLength(2);
  expect(view.failures).toHaveLength(0);
});

test("同帧重复点击只提交一次，创建失败后门禁释放允许重试", async () => {
  let reject!: (error: Error) => void;
  createSpy = spyOn(canvasApi, "createStandaloneCanvas").mockImplementationOnce(() =>
    new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  const view = setup();
  await act(async () => {
    const pending = view.result.current.createCanvas(null);
    await view.result.current.createCanvas(null);
    expect(createSpy).toHaveBeenCalledTimes(1);
    reject(new Error("创建失败"));
    await pending;
  });
  expect(view.failures).toHaveLength(1);
  expect(view.navigations).toHaveLength(0);
  expect(view.result.current.creatingCanvas).toBe(false);
  createSpy.mockImplementation(async (_token, input) => entry(input.title ?? ""));
  await act(async () => { await view.result.current.createCanvas(null); });
  expect(createSpy).toHaveBeenCalledTimes(2);
  expect(view.navigations).toHaveLength(1);
});
