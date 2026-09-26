/**
 * [INPUT]: 依赖 happy-dom、真实 useChat/AgentPanel、可控 SDK 直通流和延迟工具结果
 * [OUTPUT]: 验证正文首分块在 step/finish 前立即显示、工具间隙稳定、独立工具并发和停止后不续写
 * [POS]: AgentPanel 整轮活动集成门禁；子进程隔离 module mock，只替换传输/持久化边界，保留生产生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { UIMessageChunk } from "ai";

if (process.env.FOLUNE_STREAM_TEST_CHILD !== "1") {
  test("隔离运行真实 AgentPanel 流式生命周期回归", async () => {
    const child = Bun.spawn([process.execPath, "test", import.meta.path], {
      cwd: new URL("../../..", import.meta.url).pathname,
      env: { ...process.env, FOLUNE_STREAM_TEST_CHILD: "1" },
      stdout: "pipe", stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    if (exitCode !== 0) throw new Error(`${stdout}\n${stderr}`);
    expect(exitCode).toBe(0);
  });
} else {
const browserWindow = new Window();
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
});
browserWindow.HTMLElement.prototype.scrollTo = () => undefined;

const thread = {
  id: "stream-test", title: "流式测试", references: [], user_id: "user-test",
  created_at: "2026-09-24T00:00:00Z", updated_at: "2026-09-24T00:00:00Z", last_message_at: null,
};
const streams: ReadableStreamDefaultController<UIMessageChunk>[] = [];
const toolResults: Array<(result: unknown) => void> = [];
mock.module("./chatTransport", () => ({
  createMemoChatTransport: () => ({
    sendMessages: async () => new ReadableStream<UIMessageChunk>({
      start: (controller) => { streams.push(controller); },
    }),
    reconnectToStream: async () => null,
  }),
}));
mock.module("./memoToolExecution", () => ({
  executeMemoToolPlan: () => new Promise((resolve) => { toolResults.push(resolve); }),
}));
mock.module("./useAiThreads", () => ({
  useAiThreads: () => ({
    conversationKey: thread.id, pinnedMemoIds: [], ensureThread: async () => thread.id,
    selectedThread: thread, messages: [], threads: [thread], selectedLoading: false,
    selectedLoadError: null, loading: false, mutating: false,
    commitLocalMessages: async () => undefined, refreshSelected: async () => undefined,
    replaceReferences: async () => undefined,
  }),
}));
mock.module("./aiSettingsCache", () => ({
  readAiSettings: async () => ({ permission_mode: "ask" }),
  writeAiSettings: () => undefined,
}));
const { cleanup, fireEvent, render, act, waitFor } = await import("@testing-library/react");
const { AgentPanel } = await import("./AgentPanel");
const { ToastProvider } = await import("../../shared/design-system/components");
afterEach(() => {
  cleanup();
  streams.length = 0;
  toolResults.length = 0;
});

async function emit(index: number, chunks: UIMessageChunk[], close = false) {
  await act(async () => {
    for (const chunk of chunks) streams[index]!.enqueue(chunk);
    if (close) streams[index]!.close();
  });
}

async function startConversation() {
  const view = render(<ToastProvider><AgentPanel
    accessToken="test" userId="user-test" currentMemo={null} memoTree={[]}
    onApplyOrganize={async () => undefined} onRejectOrganize={async () => undefined}
    onPrepareMutation={async () => undefined} onClose={() => undefined}
    onSelectedThreadChange={() => undefined} organizeBusy={false} organizeRun={null}
  /></ToastProvider>);
  const input = view.getByRole("textbox", { name: "输入消息" });
  input.textContent = "读取两次结构再回答";
  fireEvent.input(input);
  fireEvent.click(view.getByRole("button", { name: "发送消息" }));
  await waitFor(() => expect(streams).toHaveLength(1));
  return view;
}

test("真实 SDK 连续两轮 ready/工具/自动续写只在最终正文到达时折叠一次", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "assistant-test" }, { type: "start-step" },
    { type: "reasoning-start", id: "r0" },
    { type: "reasoning-delta", id: "r0", delta: "先检查结构。" },
  ]);
  await waitFor(() => expect(view.container.querySelector(".agent-process-disclosure")?.getAttribute("data-expanded")).toBe("true"));
  const disclosure = view.container.querySelector(".agent-process-disclosure")!;
  const expandedChanges: string[] = [];
  const observer = new browserWindow.MutationObserver((records) => {
    for (const record of records) if (record.attributeName === "data-expanded") expandedChanges.push(disclosure.getAttribute("data-expanded")!);
  });
  observer.observe(disclosure as unknown as Parameters<typeof observer.observe>[0], { attributes: true });
  try {
    for (let step = 0; step < 2; step++) {
      if (step > 0) await emit(step, [
        { type: "start", messageId: "assistant-test" }, { type: "start-step" },
        { type: "reasoning-start", id: `r${step}` },
        { type: "reasoning-delta", id: `r${step}`, delta: "再核实一次。" },
      ]);
      await emit(step, [
        { type: "reasoning-end", id: `r${step}` },
      ]);
      expect(disclosure.getAttribute("data-expanded")).toBe("true");
      expect(view.container.querySelector(".ds-streaming-text")).toBeNull();
      await emit(step, [
        { type: "tool-input-start", toolCallId: `read-${step}`, toolName: "read_tree" },
        { type: "tool-input-available", toolCallId: `read-${step}`, toolName: "read_tree", input: {} },
        { type: "finish-step" }, { type: "finish", finishReason: "tool-calls" },
      ], true);
      await waitFor(() => expect(toolResults).toHaveLength(step + 1));
      expect(disclosure.getAttribute("data-expanded")).toBe("true");
      expect(view.container.querySelector(".ds-streaming-text")).toBeNull();
      expect(expandedChanges).toEqual([]);
      await act(async () => { toolResults[step]!({ nodes: [], total: 0 }); });
      await waitFor(() => expect(streams).toHaveLength(step + 2));
      expect(disclosure.getAttribute("data-expanded")).toBe("true");
    }
    await emit(2, [
      { type: "start", messageId: "assistant-test" }, { type: "start-step" },
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "已经核实。" },
    ]);
    await waitFor(() => expect(disclosure.getAttribute("data-expanded")).toBe("false"));
    expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe("已经核实。");
    // 此时模型尚未结束正文，更没有 finish-step；首分块必须已经可见。
    await emit(2, [{ type: "text-delta", id: "answer", delta: "现在给出建议。" }]);
    await waitFor(() => expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe("已经核实。现在给出建议。"));
    await emit(2, [
      { type: "text-end", id: "answer" }, { type: "finish-step" },
      { type: "finish", finishReason: "stop" },
    ], true);
    await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
    expect(expandedChanges).toEqual(["false"]);
  } finally {
    observer.disconnect();
  }
});

test("停止含待执行写工具的流后折叠过程，不再启动写工具或自动续写", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "assistant-stop" }, { type: "start-step" },
    { type: "reasoning-start", id: "r" },
    { type: "reasoning-delta", id: "r", delta: "准备读取。" },
    { type: "reasoning-end", id: "r" },
    { type: "tool-input-start", toolCallId: "write-stop", toolName: "edit_node" },
    { type: "tool-input-available", toolCallId: "write-stop", toolName: "edit_node", input: { op: "create", node_type: "memo", title: "测试" } },
  ]);
  await waitFor(() => expect(view.container.querySelector(".agent-process-disclosure")?.getAttribute("data-expanded")).toBe("true"));
  fireEvent.click(view.getByRole("button", { name: "停止生成" }));
  // 测试 transport 不处理 abortSignal，以关闭流模拟已终止连接的 reader 收尾。
  await emit(0, [], true);
  await waitFor(() => expect(view.container.querySelector(".agent-process-disclosure")?.getAttribute("data-expanded")).toBe("false"));
  expect(toolResults).toHaveLength(0);
  expect(streams).toHaveLength(1);
});

test("三个独立只读调用在流结束前全部启动，慢工具不阻塞下一个调用", async () => {
  const view = await startConversation();
  await emit(0, [{ type: "start", messageId: "parallel-reads" }, { type: "start-step" }]);
  for (let index = 0; index < 3; index++) {
    await emit(0, [
      { type: "tool-input-start", toolCallId: `read-${index}`, toolName: "read_tree" },
      { type: "tool-input-available", toolCallId: `read-${index}`, toolName: "read_tree", input: {} },
    ]);
    await waitFor(() => expect(toolResults).toHaveLength(index + 1));
  }
  expect(streams).toHaveLength(1);
  // 无一个结果已完成，三个执行都已开始，且不需要 finish-step/服务端落账。
  await emit(0, [{ type: "finish-step" }, { type: "finish", finishReason: "tool-calls" }], true);
  await act(async () => { toolResults[0]!({ nodes: [], total: 0 }); });
  expect(streams).toHaveLength(1);
  await act(async () => { toolResults[1]!({ nodes: [], total: 0 }); toolResults[2]!({ nodes: [], total: 0 }); });
  await waitFor(() => expect(streams).toHaveLength(2));
  expect(toolResults).toHaveLength(3);
  await emit(1, [{ type: "start", messageId: "parallel-reads" }, { type: "start-step" }, { type: "text-start", id: "done" }, { type: "text-delta", id: "done", delta: "完成。" }, { type: "text-end", id: "done" }, { type: "finish-step" }, { type: "finish", finishReason: "stop" }], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
});

test("同轮独立写工具通过流末审批门禁后一起执行，不等待前一项结果", async () => {
  const view = await startConversation();
  await emit(0, [{ type: "start", messageId: "parallel-writes" }, { type: "start-step" }]);
  for (let index = 0; index < 3; index++) await emit(0, [
    { type: "tool-input-start", toolCallId: `write-${index}`, toolName: "edit_node" },
    { type: "tool-input-available", toolCallId: `write-${index}`, toolName: "edit_node", input: { op: "create", node_type: "memo", title: `测试${index}` } },
  ]);
  expect(toolResults).toHaveLength(0);
  await emit(0, [{ type: "finish-step" }, { type: "finish", finishReason: "tool-calls" }], true);
  await waitFor(() => expect(toolResults).toHaveLength(3));
  await act(async () => { for (const resolve of toolResults) resolve({}); });
  await waitFor(() => expect(streams).toHaveLength(2));
  await emit(1, [{ type: "start", messageId: "parallel-writes" }, { type: "start-step" }, { type: "text-start", id: "done" }, { type: "text-delta", id: "done", delta: "完成。" }, { type: "text-end", id: "done" }, { type: "finish-step" }, { type: "finish", finishReason: "stop" }], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
});

test("首 token 前超时或失败，空 assistant 也必须退出思考占位", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "empty-failure" },
    { type: "error", errorText: "AI 长时间没有响应，请重试。" },
  ], true);
  await waitFor(() => expect(view.getByRole("alert").textContent).toContain("AI 长时间没有响应"));
  await waitFor(() => expect(view.container.querySelector(".agent-live-thinking") === null).toBe(true));
  expect(view.queryByRole("button", { name: "停止生成" })).toBeNull();
  expect(streams).toHaveLength(1);
});

test("流内错误结束思考并显示错误，不执行尚未确认的写工具或续写", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "failed-turn" }, { type: "start-step" },
    { type: "reasoning-start", id: "r-error" },
    { type: "reasoning-delta", id: "r-error", delta: "准备处理。" },
    { type: "reasoning-end", id: "r-error" },
    { type: "tool-input-available", toolCallId: "write-error", toolName: "edit_node", input: { op: "create", node_type: "memo", title: "不应创建" } },
    { type: "error", errorText: "AI 回复中断，请重新发送消息。" },
  ], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
  expect(view.getByRole("alert").textContent).toContain("AI 回复中断");
  expect(view.container.querySelector(".agent-process-disclosure")?.getAttribute("data-expanded")).toBe("false");
  expect(toolResults).toHaveLength(0);
  expect(streams).toHaveLength(1);
});

test("提前读取完成后若用户停止，不发布结果也不自动续写", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "stopped-read" }, { type: "start-step" },
    { type: "tool-input-start", toolCallId: "read-stop", toolName: "read_tree" },
    { type: "tool-input-available", toolCallId: "read-stop", toolName: "read_tree", input: {} },
  ]);
  await waitFor(() => expect(toolResults).toHaveLength(1));
  fireEvent.click(view.getByRole("button", { name: "停止生成" }));
  await act(async () => { toolResults[0]!({ nodes: [], total: 0 }); });
  await emit(0, [], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
  expect(streams).toHaveLength(1);
});

}
