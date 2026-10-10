/**
 * [INPUT]: 依赖真实画布来源 Hook、Canvas Store 与可控画布读取
 * [OUTPUT]: 验证默认引用随页面切换、手动引用保留及发送快照隔离
 * [POS]: Composer 来源生命周期回归；不访问真实网络或用户数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { CanvasDetail } from "../../shared/api/canvas";
import type { FoluneUIMessage } from "../../shared/api/ai";

const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document });
const canvasA = { id: "canvas-a", title: "画布 A" };
const canvasB = { id: "canvas-b", title: "画布 B" };
const detail = (id: string) => ({
  canvas: { node_id: id, version: 4 },
  nodes: [{ id: "card-a", target_node_id: "memo-a", target: { deleted_at: null } }],
  edges: [],
}) as unknown as CanvasDetail;
let readCanvas = async (id: string, _signal?: AbortSignal) => detail(id);
const api = await import("../../shared/api/canvas");
mock.module("../../shared/api/canvas", () => ({
  ...api,
  getCanvas: (_token: string, id: string, signal?: AbortSignal) => readCanvas(id, signal),
}));
const { act, cleanup, renderHook, waitFor } = await import("@testing-library/react");
const { useCanvasChatSource } = await import("./useCanvasChatSource");
const { useCanvasWorkspaceStore } = await import("../../shared/store/canvasWorkspaceStore");
type Input = Parameters<typeof useCanvasChatSource>[0];
const base = { accessToken: "test", initialMessages: [] };
const history: FoluneUIMessage[] = [{
  id: "user-message", role: "user", parts: [{ type: "text", text: "已发送的问题" }],
  metadata: {
    canvas_title: "旧画布标题",
    context: {
      active_memo_id: null, reference_memo_ids: [], revisions: {},
      canvas: { canvas_id: canvasA.id, mode: "selected", memo_ids: ["memo-a"], version: 3 },
    },
  },
}];
const mount = (input: Input) => renderHook((props: Input) => useCanvasChatSource(props), { initialProps: input });

afterEach(() => {
  cleanup();
  useCanvasWorkspaceStore.getState().reset();
  readCanvas = async (id) => detail(id);
});

test("画布返回笔记清除默认画布，再进入另一画布替换来源", async () => {
  const hook = mount({ ...base, currentCanvas: canvasA });
  expect(hook.result.current.source).toMatchObject({ id: canvasA.id, mode: "all" });
  hook.rerender({ ...base, currentCanvas: null, currentMemoId: "memo-a" });
  expect(hook.result.current.source).toBeNull();
  hook.rerender({ ...base, currentCanvas: canvasB });
  expect(hook.result.current.source).toMatchObject({ id: canvasB.id, mode: "all" });
  await waitFor(() => expect(hook.result.current.detail?.canvas.node_id).toBe(canvasB.id));
});

test("从笔记进入画布及直接切换画布均采用当前页面来源", async () => {
  const input = { ...base, currentCanvas: null, currentMemoId: "memo-a" };
  const hook = mount(input);
  hook.rerender({ ...input, currentCanvas: canvasA, currentMemoId: null });
  expect(hook.result.current.source?.id).toBe(canvasA.id);
  hook.rerender({ ...input, currentCanvas: canvasB, currentMemoId: null });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  await act(async () => {});
});

test("移除仅抑制当前页面，换画布或离开后返回恢复默认引用", async () => {
  const hook = mount({ ...base, currentCanvas: canvasA });
  act(() => hook.result.current.remove());
  hook.rerender({ ...base, currentCanvas: { ...canvasA } });
  expect(hook.result.current.source).toBeNull();
  hook.rerender({ ...base, currentCanvas: canvasB });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  act(() => hook.result.current.remove());
  hook.rerender({ ...base, currentCanvas: null, currentMemoId: "memo-a" });
  hook.rerender({ ...base, currentCanvas: canvasB });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  await act(async () => {});
});

test("同画布重绘、改名和卡片点选保留精确范围，跨画布重新默认整图", async () => {
  const hook = mount({ ...base, currentCanvas: canvasA });
  act(() => hook.result.current.setSource({ ...canvasA, mode: "selected", memoIds: ["memo-a"] }));
  const selection = hook.result.current.source;
  act(() => useCanvasWorkspaceStore.setState({ selectedNodeIds: ["card-b"] }));
  hook.rerender({ ...base, currentCanvas: { ...canvasA } });
  expect(hook.result.current.source).toBe(selection);
  hook.rerender({ ...base, currentCanvas: { ...canvasA, title: "新标题" } });
  expect(hook.result.current.source).toEqual({ ...selection!, title: "新标题" });
  hook.rerender({ ...base, currentCanvas: canvasB });
  expect(hook.result.current.source).toEqual({ ...canvasB, mode: "all", memoIds: [] });
  await act(async () => {});
});

test("当前笔记或另一画布优先于历史来源，同画布恢复精确范围", async () => {
  const note = mount({ ...base, currentMemoId: "memo-a", initialMessages: history });
  expect(note.result.current.source).toBeNull();
  const other = mount({ ...base, currentCanvas: canvasB, initialMessages: history });
  expect(other.result.current.source).toEqual({ ...canvasB, mode: "all", memoIds: [] });
  const same = mount({ ...base, currentCanvas: canvasA, initialMessages: history });
  expect(same.result.current.source).toEqual({ ...canvasA, mode: "selected", memoIds: ["memo-a"] });
  await act(async () => {});
});

test("无当前对象时恢复历史，选中笔记后立即让出默认来源", () => {
  const hook = mount({ ...base, initialMessages: history });
  expect(hook.result.current.source?.id).toBe(canvasA.id);
  hook.rerender({ ...base, currentMemoId: "memo-b", initialMessages: history });
  expect(hook.result.current.source).toBeNull();
});

test("显式 @画布不受页面切换覆盖，移除后下一页面恢复默认规则", async () => {
  const hook = mount({ ...base, currentMemoId: "memo-a" });
  act(() => hook.result.current.select(canvasB.id, canvasB.title));
  hook.rerender({ ...base, currentMemoId: "memo-b" });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  hook.rerender({ ...base, currentCanvas: canvasA });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  act(() => hook.result.current.remove());
  hook.rerender({ ...base, currentCanvas: { ...canvasA } });
  expect(hook.result.current.source).toBeNull();
  hook.rerender({ ...base, currentCanvas: canvasB });
  expect(hook.result.current.source?.id).toBe(canvasB.id);
  await act(async () => {});
});

test("来源切换取消旧读取，迟到响应不能覆盖新画布", async () => {
  let resolveOld!: (value: CanvasDetail) => void;
  let oldSignal: AbortSignal | undefined;
  readCanvas = (id, signal) => id === canvasA.id
    ? new Promise((resolve) => { resolveOld = resolve; oldSignal = signal; })
    : Promise.resolve(detail(id));
  const hook = mount({ ...base, currentCanvas: canvasA });
  hook.rerender({ ...base, currentCanvas: canvasB });
  await waitFor(() => expect(hook.result.current.detail?.canvas.node_id).toBe(canvasB.id));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolveOld(detail(canvasA.id)));
  expect(hook.result.current.detail?.canvas.node_id).toBe(canvasB.id);
});

test("冻结期间切换笔记只更新下一轮来源，本轮仍发送原画布范围", async () => {
  let finishPrepare!: () => void;
  const prepare = () => new Promise<void>((resolve) => { finishPrepare = resolve; });
  const hook = mount({ ...base, currentCanvas: canvasA, prepare });
  act(() => hook.result.current.setSource({ ...canvasA, mode: "selected", memoIds: ["memo-a"] }));
  let frozen!: ReturnType<typeof hook.result.current.freeze>;
  act(() => { frozen = hook.result.current.freeze(); });
  hook.rerender({ ...base, currentMemoId: "memo-b", prepare });
  expect(hook.result.current.source).toBeNull();
  await act(async () => finishPrepare());
  expect(await frozen).toEqual({ canvas_id: canvasA.id, mode: "selected", memo_ids: ["memo-a"], version: 4 });
  expect(history[0]?.metadata?.context?.canvas?.version).toBe(3);
});
