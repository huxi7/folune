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
const savedMessages: Array<{ parts: Array<{ state?: string }> }> = [];
const aiApi = await import("../../shared/api/ai");
mock.module("../../shared/api/ai", () => ({ ...aiApi, syncAiMessage: async (_token: string, _threadId: string, message: { parts: Array<{ state?: string }> }) => { savedMessages.push(message); } }));
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
const aiSettingsModule = await import("./aiSettingsCache");
mock.module("./aiSettingsCache", () => ({
  ...aiSettingsModule,
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
  savedMessages.length = 0;
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
  await waitFor(() => expect(view.getByRole("button", { name: "发送消息" }).hasAttribute("disabled")).toBeFalse());
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


test("98 个独立写工具保留顺序，只有八项转圈且结果到齐后续写", async () => {
  const view = await startConversation();
  const chunks: UIMessageChunk[] = [{ type: "start", messageId: "batch-98" }, { type: "start-step" }];
  for (let index = 0; index < 98; index++) chunks.push({
    type: "tool-input-available", toolCallId: `bulk-${index}`, toolName: "edit_node",
    input: { op: "create", node_type: "memo", title: `测试${index}` },
  });
  chunks.push({ type: "finish-step" }, { type: "finish", finishReason: "tool-calls" });
  await emit(0, chunks, true);
  await waitFor(() => expect(toolResults).toHaveLength(8));
  expect(view.container.querySelectorAll(".ds-tool-call-bubble")).toHaveLength(98);
  expect(view.container.querySelectorAll(".ds-tool-spinner")).toHaveLength(8);
  let resolved = 0;
  while (resolved < 98) {
    const end = Math.min(resolved + 8, 98);
    await waitFor(() => expect(toolResults).toHaveLength(end));
    expect(streams).toHaveLength(1);
    await act(async () => {
      for (; resolved < end; resolved++) toolResults[resolved]!({});
    });
  }
  await waitFor(() => expect(streams).toHaveLength(2));
  await emit(1, [{ type: "start", messageId: "batch-98" }, { type: "start-step" }, { type: "text-start", id: "done" }, { type: "text-delta", id: "done", delta: "完成98项。" }, { type: "text-end", id: "done" }, { type: "finish-step" }, { type: "finish", finishReason: "stop" }], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
});

test("客户端批量执行期间停止，不再启动排队写入或被迟到结果自动续写", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "batch-stop" }, { type: "start-step" },
    ...Array.from({ length: 12 }, (_, index): UIMessageChunk => ({ type: "tool-input-available", toolCallId: `cancel-${index}`, toolName: "edit_node", input: { op: "create", node_type: "memo", title: `停止${index}` } })),
    { type: "finish-step" }, { type: "finish", finishReason: "tool-calls" },
  ], true);
  await waitFor(() => expect(toolResults).toHaveLength(8));
  fireEvent.click(view.getByRole("button", { name: "停止生成" }));
  await act(async () => { for (const resolve of toolResults) resolve({}); });
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
  expect(toolResults).toHaveLength(8);
  expect(streams).toHaveLength(1);
  expect(savedMessages.at(-1)?.parts.filter((part) => part.state === "output-available")).toHaveLength(8);
  expect(savedMessages.at(-1)?.parts.filter((part) => part.state === "output-error")).toHaveLength(4);
});


test("明确批量100项同一工具持续推进，真实八项转圈且一次展开已完成记录", async () => {
  const { useMemoTreeStore } = await import("../../shared/store/memoTreeStore");
  const nodes = Array.from({ length: 100 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, title: `未命名备忘录 ${i}`,
    node_type: "memo", revision: 1, parent_id: null, children: [],
  }));
  useMemoTreeStore.setState({ nodes: nodes as never });
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "explicit-batch" }, { type: "start-step" },
    { type: "tool-input-available", toolName: "edit_nodes", toolCallId: "batch-one", input: { op: "delete", targets: nodes.map((node) => ({ node_id: node.id, expected_revision: 1 })) } },
    { type: "finish-step" }, { type: "finish", finishReason: "tool-calls" },
  ], true);
  await waitFor(() => expect(toolResults).toHaveLength(8));
  expect(view.container.querySelectorAll(".ds-tool-spinner")).toHaveLength(8);
  expect(view.getByText("还有 92 篇等待处理")).toBeTruthy();
  await act(async () => { toolResults[2]!({ id: "command-2", operation: "trash_node", status: "succeeded" }); });
  await waitFor(() => expect(toolResults).toHaveLength(9));
  expect(view.container.querySelectorAll(".ds-tool-spinner")).toHaveLength(8);
  fireEvent.click(view.getByRole("button", { name: "查看全部 1 条记录" }));
  expect(view.getByRole("region", { name: "全部操作记录" })).toBeTruthy();
  for (let i = 0; i < 100; i++) {
    if (i === 2) continue;
    await waitFor(() => expect(toolResults.length).toBeGreaterThan(i));
    await act(async () => { toolResults[i]!({ id: `command-${i}`, operation: "trash_node", status: "succeeded" }); });
  }
  await waitFor(() => expect(streams).toHaveLength(2));
  expect(view.container.querySelectorAll(".ds-tool-spinner")).toHaveLength(0);
  expect(view.getByRole("button", { name: "收起操作记录" })).toBeTruthy();
  expect(view.queryByText("显示更多操作")).toBeNull();
  expect(view.container.querySelectorAll(".agent-batch-record").length).toBeLessThanOrEqual(16);
  const last = savedMessages.at(-1)!;
  expect(last.parts.some((part) => "type" in part && part.type === "data-tool-batch")).toBeTrue();
  await emit(1, [{ type: "start", messageId: "explicit-batch" }, { type: "start-step" }, { type: "text-start", id: "done" }, { type: "text-delta", id: "done", delta: "删除完成。" }, { type: "text-end", id: "done" }, { type: "finish-step" }, { type: "finish", finishReason: "stop" }], true);
  await waitFor(() => expect(view.queryByRole("button", { name: "停止生成" })).toBeNull());
});


test("余额不足显示明确错误，退出思考且不执行工具或自动重发", async () => {
  const view = await startConversation();
  await emit(0, [
    { type: "start", messageId: "balance-error" }, { type: "start-step" },
    { type: "error", errorText: "DeepSeek API 账户余额不足，充值后才能继续使用。" },
  ], true);
  await waitFor(() => expect(view.getByText("AI 服务余额不足")).toBeTruthy());
  expect(view.getByText("DeepSeek API 账户余额不足，充值后才能继续使用。")).toBeTruthy();
  expect(view.queryByRole("button", { name: "停止生成" })).toBeNull();
  expect(view.container.querySelectorAll(".ds-tool-spinner")).toHaveLength(0);
  expect(toolResults).toHaveLength(0);
  expect(streams).toHaveLength(1);
});

}
