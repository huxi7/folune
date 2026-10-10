/**
 * [INPUT]: 依赖真实 AgentPanel/useAiThreads/useChat/transport、happy-dom 与可控 API/SSE 边界
 * [OUTPUT]: 验证笔记/画布胶囊切换与草稿保留、首发引用冻结、失败重试、异步选择隔离与权限门禁
 * [POS]: 草稿到持久会话的集成门禁；隔离子进程防止 module mock 污染其余用例
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { AiThreadBootstrap, AiThreadDetail } from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import type { CanvasDetail } from "../../shared/api/canvas";

if (process.env.FOLUNE_DRAFT_TEST_CHILD !== "1") {
  test("隔离运行草稿与首次发送的真实生命周期", async () => {
    const child = Bun.spawn([process.execPath, "test", import.meta.path], {
      cwd: new URL("../../..", import.meta.url).pathname,
      env: { ...process.env, FOLUNE_DRAFT_TEST_CHILD: "1" }, stdout: "pipe", stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`${stdout}\n${stderr}`);
    expect(code).toBe(0);
  });
} else {
const browserWindow = new Window();
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document, HTMLElement: browserWindow.HTMLElement, NodeFilter: browserWindow.NodeFilter });
browserWindow.HTMLElement.prototype.scrollTo = () => undefined;
const thread: AiThreadDetail = {
  id: "thread-saved", title: "新会话", references: [], user_id: "user-draft",
  created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z", last_message_at: "2026-09-26T00:00:00Z",
};
const empty: AiThreadBootstrap = { threads: [], selectedThread: null, messages: [] };
let bootstrap = async () => empty;
let create = async () => thread;
let creates = 0;
let failReferences = false;
const referenceWrites: Array<{ id: string; memoIds: readonly string[] }> = [];
const chatBodies: Array<Record<string, unknown>> = [];
let content = async (): Promise<{ selectedThread: AiThreadDetail; messages: [] }> => ({ selectedThread: thread, messages: [] });
const api = await import("../../shared/api/ai");
mock.module("../../shared/api/ai", () => ({
  ...api,
  getAiThreadBootstrap: () => bootstrap(),
  createAiThread: () => { creates++; return create(); },
  replaceAiThreadReferences: async (_token: string, id: string, memoIds: readonly string[]) => {
    referenceWrites.push({ id, memoIds });
    if (failReferences) throw new Error("引用暂时无法保存");
    return memoIds.map((memo_id) => ({ memo_id, thread_id: id, user_id: thread.user_id, created_at: thread.created_at }));
  },
  getAiThreadContent: () => content(), listAiThreads: async () => [], deleteAiThread: async () => undefined,
}));
const auth = await import("../../shared/supabase/auth");
mock.module("../../shared/supabase/auth", () => ({ ...auth, getAuthenticatedAccessToken: async () => "test" }));
const canvasApi = await import("../../shared/api/canvas");
mock.module("../../shared/api/canvas", () => ({
  ...canvasApi,
  getCanvas: async (_token: string, id: string) => ({ canvas: { node_id: id, version: 4 }, nodes: [], edges: [] }) as unknown as CanvasDetail,
}));
const settings = await import("./aiSettingsCache");
let readPermission = async () => ({ permission_mode: "ask" });
let savePermission = async () => ({ permission_mode: "full_access" });
mock.module("./aiSettingsCache", () => ({
  ...settings,
  readAiSettings: () => readPermission(), saveAiSettings: () => savePermission(), writeAiSettings: () => undefined,
}));
const originalFetch = globalThis.fetch;
globalThis.fetch = Object.assign(async (_input: unknown, init?: RequestInit) => {
  chatBodies.push(JSON.parse(String(init?.body)));
  const chunks = [
    { type: "start", messageId: "assistant-draft" }, { type: "start-step" },
    { type: "text-start", id: "answer" }, { type: "text-delta", id: "answer", delta: "收到首条消息。" },
    { type: "text-end", id: "answer" }, { type: "finish-step" }, { type: "finish", finishReason: "stop" },
  ];
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
  });
}, { preconnect: originalFetch.preconnect }) as typeof fetch;
const { act, cleanup, fireEvent, render, renderHook, waitFor } = await import("@testing-library/react");
const { useAiThreads } = await import("./useAiThreads");
const { resetAiThreadSnapshotsForTests, readAiThreadSnapshot, writeAiThreadSnapshot } = await import("./aiThreadCache");
const { AgentPanel } = await import("./AgentPanel");
const { ToastProvider } = await import("../../shared/design-system/components");
const { useMemoTreeStore } = await import("../../shared/store/memoTreeStore");
const memo = { id: "memo-one", title: "引用笔记", node_type: "memo", revision: 3, parent_id: null, children: [], memo: { content_mdx: "内容" } } as unknown as MemoTreeNode;
const input = { accessToken: "test", userId: "user-draft" };
afterEach(() => {
  cleanup(); resetAiThreadSnapshotsForTests(); browserWindow.localStorage.clear();
  creates = 0; referenceWrites.length = 0; chatBodies.length = 0; failReferences = false;
  bootstrap = async () => empty; create = async () => thread;
  content = async () => ({ selectedThread: thread, messages: [] });
  readPermission = async () => ({ permission_mode: "ask" });
  savePermission = async () => ({ permission_mode: "full_access" });
});
function panelElement(currentMemo: MemoTreeNode | null, currentCanvas: { id: string; title: string } | null = null, tree = currentMemo ? [currentMemo] : []) {
  return <ToastProvider><AgentPanel {...input} currentMemo={currentMemo} currentCanvas={currentCanvas} memoTree={tree}
    onApplyOrganize={async () => undefined} onRejectOrganize={async () => undefined}
    onPrepareMutation={async () => undefined} onClose={() => undefined}
    onSelectedThreadChange={() => undefined} organizeBusy={false} organizeRun={null}
  /></ToastProvider>;
}
async function panel(currentMemo: MemoTreeNode | null = null) {
  const view = render(panelElement(currentMemo));
  await waitFor(() => expect(view.queryByRole("textbox", { name: "输入消息" })).not.toBeNull());
  return view;
}
function send(view: Awaited<ReturnType<typeof panel>>, text: string) {
  const textbox = view.getByRole("textbox", { name: "输入消息" });
  textbox.textContent = text; fireEvent.input(textbox);
  fireEvent.click(view.getByRole("button", { name: "发送消息" }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

test.each(["note", "canvas"] as const)("草稿中连续切换笔记和画布，胶囊与发送的 %s 来源一致且输入实例不重建", async (destination) => {
  const otherMemo = { ...memo, id: "memo-two", title: "另一篇笔记" };
  const tree = [memo, otherMemo];
  const firstCanvas = { id: "canvas-one", title: "第一个画布" };
  const secondCanvas = { id: "canvas-two", title: "第二个画布" };
  useMemoTreeStore.setState({ nodes: tree });
  const view = await panel(memo);
  const composer = view.getByRole("textbox", { name: "输入消息" });
  composer.textContent = "保留这段草稿"; fireEvent.input(composer);
  view.rerender(panelElement(otherMemo, null, tree));
  expect(view.queryByRole("button", { name: "移除引用 引用笔记" })).toBeNull();
  expect(view.getByRole("button", { name: "移除引用 另一篇笔记" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "置顶引用 另一篇笔记" }));
  await act(async () => {});

  view.rerender(panelElement(null, firstCanvas, tree));
  await waitFor(() => expect(view.getByRole("button", { name: "发送消息" }).hasAttribute("disabled")).toBe(false));
  expect(view.getByRole("button", { name: firstCanvas.title })).toBeTruthy();
  expect(view.getByRole("button", { name: "取消置顶 另一篇笔记" })).toBeTruthy();
  view.rerender(panelElement(null, secondCanvas, tree));
  await waitFor(() => expect(view.getByRole("button", { name: "发送消息" }).hasAttribute("disabled")).toBe(false));
  expect(view.queryByRole("button", { name: firstCanvas.title })).toBeNull();
  expect(view.getByRole("button", { name: secondCanvas.title })).toBeTruthy();

  if (destination === "note") {
    view.rerender(panelElement(memo, null, tree));
    expect(view.queryByRole("button", { name: "移除画布引用" })).toBeNull();
    expect(view.queryByText("画布问答 · 只读")).toBeNull();
    expect(view.getByRole("button", { name: "移除引用 引用笔记" })).toBeTruthy();
  }
  expect(view.getByRole("textbox", { name: "输入消息" })).toBe(composer);
  expect(composer.textContent).toBe("保留这段草稿");
  await waitFor(() => expect(view.getByRole("button", { name: "发送消息" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(view.getByRole("button", { name: "发送消息" }));
  await waitFor(() => expect(chatBodies).toHaveLength(1));
  expect(chatBodies[0]?.reference_memo_ids).toEqual(destination === "note" ? [memo.id, otherMemo.id] : [otherMemo.id]);
  if (destination === "note") expect(chatBodies[0]?.canvas).toBeUndefined();
  else expect(chatBodies[0]?.canvas).toEqual({ canvas_id: secondCanvas.id, mode: "all", memo_ids: [], version: 4 });
  await waitFor(() => expect(view.getByText("收到首条消息。")).toBeTruthy());
});

test("首开权限未确认和切换保存期间，点击发送、Enter 与直接提交都不能走旧模式", async () => {
  const loading = deferred<{ permission_mode: string }>();
  readPermission = () => loading.promise;
  const view = await panel();
  const textbox = view.getByRole("textbox", { name: "输入消息" });
  textbox.textContent = "创建笔记"; fireEvent.input(textbox);
  const button = view.getByRole("button", { name: "发送消息" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.keyDown(textbox, { key: "Enter" });
  fireEvent.submit(textbox.closest("form")!);
  expect(chatBodies).toHaveLength(0); expect(creates).toBe(0);
  await act(async () => loading.resolve({ permission_mode: "ask" }));
  await waitFor(() => expect(button.disabled).toBe(false));
  const saving = deferred<{ permission_mode: string }>(); savePermission = () => saving.promise;
  fireEvent.click(view.getByRole("button", { name: "审批模式：每次询问" }));
  fireEvent.click(view.getByRole("menuitemradio", { name: /完全访问/ }));
  expect(button.disabled).toBe(true);
  fireEvent.click(button); fireEvent.keyDown(textbox, { key: "Enter" });
  fireEvent.submit(textbox.closest("form")!);
  expect(chatBodies).toHaveLength(0); expect(creates).toBe(0);
  await act(async () => saving.resolve({ permission_mode: "full_access" }));
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(chatBodies).toHaveLength(1));
  expect(creates).toBe(1);
});

test("首次打开、反复新建与从历史返回均不写空会话", async () => {
  const view = await panel();
  await act(async () => {
    for (let i = 0; i < 5; i++) fireEvent.click(view.getByRole("button", { name: "新对话" }));
  });
  expect(creates).toBe(0);
  expect(view.getByRole("button", { name: "新对话" }).getAttribute("aria-busy")).not.toBe("true");
  fireEvent.click(view.getByRole("button", { name: "会话历史" }));
  await act(async () => { fireEvent.click(view.getByRole("button", { name: "新对话" })); });
  expect(view.getByRole("textbox", { name: "输入消息" })).toBeTruthy();
  expect(readAiThreadSnapshot(input.userId)?.snapshot.threads).toEqual([]);
});

test("首发等待合并到消息状态，引用落库且同一 Composer/消息实例完整续流", async () => {
  useMemoTreeStore.setState({ nodes: [memo] });
  const pending = deferred<AiThreadDetail>(); create = () => pending.promise;
  const view = await panel(memo);
  const composer = view.getByRole("textbox", { name: "输入消息" });
  fireEvent.click(view.getByRole("button", { name: "置顶引用 引用笔记" }));
  await act(async () => {});
  expect(referenceWrites).toEqual([]); expect(creates).toBe(0);
  send(view, "帮我整理引用");
  await waitFor(() => expect(creates).toBe(1));
  expect(view.getByText("帮我整理引用")).toBeTruthy();
  expect(view.getByRole("button", { name: "新对话" }).getAttribute("aria-busy")).not.toBe("true");
  expect(chatBodies).toHaveLength(0);
  await act(async () => { pending.resolve(thread); });
  await waitFor(() => expect(view.getByText("收到首条消息。")).toBeTruthy());
  expect(view.getByRole("textbox", { name: "输入消息" })).toBe(composer);
  expect(creates).toBe(1);
  expect(referenceWrites).toEqual([{ id: thread.id, memoIds: [memo.id] }]);
  expect(chatBodies[0]?.thread_id).toBe(thread.id);
  expect(chatBodies[0]?.reference_memo_ids).toContain(memo.id);
  await waitFor(() => expect(readAiThreadSnapshot(input.userId)?.snapshot.messages).toHaveLength(2));
});

test("创建失败退出发送状态；再次发送可以恢复", async () => {
  create = async () => { throw new Error("创建暂时失败"); };
  const view = await panel(); send(view, "第一条消息");
  await waitFor(() => expect(view.getByRole("alert").textContent).toContain("创建暂时失败"));
  expect(view.queryByRole("button", { name: "停止生成" })).toBeNull();
  create = async () => thread; send(view, "重试第一条消息");
  await waitFor(() => expect(view.getByText("收到首条消息。")).toBeTruthy());
  expect(creates).toBe(2); expect(chatBodies).toHaveLength(1);
});

test("并发首发只建一次，引用写失败重试复用已经创建的 ID", async () => {
  const { result } = renderHook(() => useAiThreads(input));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.replaceReferences([memo.id]); });
  failReferences = true;
  await act(async () => {
    const first = result.current.ensureThread(); const second = result.current.ensureThread();
    expect(first).toBe(second);
    await expect(first).rejects.toThrow("引用暂时无法保存");
  });
  failReferences = false;
  await act(async () => { expect(await result.current.ensureThread()).toBe(thread.id); });
  expect(creates).toBe(1); expect(result.current.pinnedMemoIds).toEqual([memo.id]);
});

test("删除最后一个会话进入草稿，不再自动创建", async () => {
  writeAiThreadSnapshot(input.userId, { messages: [], selectedThread: thread, threads: [thread] });
  const { result } = renderHook(() => useAiThreads(input));
  await act(async () => { await result.current.removeThread(thread.id); });
  expect(result.current.selectedThread).toBeNull(); expect(result.current.threads).toEqual([]);
  expect(creates).toBe(0);
});

test("初始化和历史内容迟到时不能覆盖用户刚打开的草稿", async () => {
  const pending = deferred<AiThreadBootstrap>(); bootstrap = () => pending.promise;
  const { result } = renderHook(() => useAiThreads(input));
  act(() => result.current.startDraft());
  const key = result.current.conversationKey;
  await act(async () => { pending.resolve({ threads: [thread], selectedThread: thread, messages: [] }); });
  expect(result.current.selectedThread).toBeNull(); expect(result.current.conversationKey).toBe(key);
  expect(result.current.threads).toEqual([thread]);
  const delayedContent = deferred<{ selectedThread: AiThreadDetail; messages: [] }>();
  content = () => delayedContent.promise;
  let selecting!: Promise<AiThreadDetail>;
  act(() => { selecting = result.current.selectThread(thread.id); });
  act(() => result.current.startDraft());
  await act(async () => { delayedContent.resolve({ selectedThread: thread, messages: [] }); await selecting; });
  expect(result.current.selectedThread).toBeNull(); expect(result.current.selectedLoading).toBe(false);
});
}
