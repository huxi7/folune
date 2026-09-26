/**
 * [INPUT]: 依赖 Bun test、真实 AI SDK 流处理与可控模型/审批/落库替身
 * [OUTPUT]: 验证 finish 不等 EOF、流内错误正确落库、静默期限、主动取消、审批顺序与正文即时可见
 * [POS]: Chat 生命周期回归门禁，不调用模型、不读写业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import type { UIMessage, UIMessageChunk } from "ai";
import { createChatResponseStream } from "./chat-stream";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(chunks: UIMessageChunk[], closed = true) {
  const saves: Array<{ message: UIMessage; status: string }> = [];
  let cancelled = false;
  const upstream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (closed) controller.close();
    },
    cancel() { cancelled = true; },
  });
  const options = {
    messages: [] as UIMessage[], messageId: "reply", signal: new AbortController().signal,
    createStream: async (_signal: AbortSignal) => upstream,
    approveTool: async (_chunk: Extract<UIMessageChunk, { type: "tool-input-available" }>): Promise<UIMessageChunk | null> => null,
    persist: async (message: UIMessage, status: "complete" | "error" | "aborted") => { saves.push({ message, status }); },
    onPersistenceError: () => undefined,
    idleMs: 50,
  };
  return { options, saves, cancelled: () => cancelled };
}

const answer: UIMessageChunk[] = [
  { type: "start-step" }, { type: "text-start", id: "answer" },
  { type: "text-delta", id: "answer", delta: "连接正常" },
  { type: "text-end", id: "answer" }, { type: "finish-step" },
];

async function collect(options: Parameters<typeof createChatResponseStream>[0]) {
  const chunks: UIMessageChunk[] = [];
  for await (const chunk of createChatResponseStream(options)) chunks.push(chunk);
  return chunks;
}

test("finish 已到但上游不关 socket，回复仍完成并释放 reader", async () => {
  const f = fixture([...answer, { type: "finish", finishReason: "stop" }], false);
  const chunks = await collect(f.options);
  expect(chunks.at(-1)?.type).toBe("finish");
  expect(f.saves[0]?.status).toBe("complete");
  expect(f.cancelled()).toBe(true);
  expect(f.saves[0]?.message.parts.some((part) => part.type === "text" && part.text === "连接正常")).toBe(true);
});

test("流内 error 不依赖 throw/EOF，保留正文并落成 error", async () => {
  const f = fixture([...answer, { type: "error", errorText: "private upstream detail" }], false);
  const chunks = await collect(f.options);
  expect(chunks.at(-1)).toEqual({ type: "error", errorText: "AI 回复中断，请重新发送消息。" });
  expect(f.saves[0]?.status).toBe("error");
  expect(JSON.stringify(chunks)).not.toContain("private upstream detail");
});

test("只有错误 finish 或没有 finish 的 EOF 都不能记作成功", async () => {
  for (const chunks of [[...answer, { type: "finish", finishReason: "error" }], answer, [{ type: "finish", finishReason: "stop" }]] as UIMessageChunk[][]) {
    const f = fixture(chunks);
    expect((await collect(f.options)).at(-1)?.type).toBe("error");
    expect(f.saves[0]?.status).toBe("error");
  }
});

test("模型启动和流中途静默都有期限，并取消真实模型信号", async () => {
  for (const startup of [true, false]) {
    const f = fixture([], false);
    let signal!: AbortSignal;
    const createStream = f.options.createStream;
    f.options.createStream = (value) => {
      signal = value;
      return startup ? new Promise(() => undefined) : createStream(value);
    };
    const chunks = await collect(f.options);
    expect(chunks.at(-1)).toEqual({ type: "error", errorText: "AI 长时间没有响应，请重试。" });
    expect(signal.aborted).toBe(true);
    expect(f.saves[0]?.status).toBe("error");
  }
});

test("用户取消发 abort 且落库 aborted，不冒充网络错误", async () => {
  const controller = new AbortController();
  const f = fixture([], false);
  f.options.signal = controller.signal;
  const pending = collect(f.options);
  controller.abort();
  expect((await pending).at(-1)?.type).toBe("abort");
  expect(f.saves[0]?.status).toBe("aborted");
});

test("两次落库均失败时不把关闭流当作成功，阻止客户端执行待写工具", async () => {
  const f = fixture([
    { type: "tool-input-available", toolCallId: "write", toolName: "edit_node", input: {} },
    { type: "finish", finishReason: "tool-calls" },
  ]);
  let attempts = 0;
  let reported = false;
  f.options.persist = async () => { attempts++; throw new Error("storage unavailable"); };
  f.options.onPersistenceError = () => { reported = true; };
  await expect(collect(f.options)).rejects.toThrow("回复保存失败");
  expect(attempts).toBe(2);
  expect(reported).toBe(true);
});

test("正文先可见；审批必须先于 finish，落库完成后才关闭流", async () => {
  const approval = deferred<UIMessageChunk | null>();
  const persisted = deferred<void>();
  const f = fixture([
    ...answer,
    { type: "tool-input-available", toolCallId: "write", toolName: "edit_node", input: {} },
    { type: "finish", finishReason: "tool-calls" },
  ], false);
  f.options.approveTool = () => approval.promise;
  f.options.persist = () => persisted.promise;
  const reader = createChatResponseStream(f.options).getReader();
  const chunks: UIMessageChunk[] = [];
  for (let i = 0; i < 7; i++) chunks.push((await reader.read()).value!);
  expect(chunks.some((chunk) => chunk.type === "text-delta")).toBe(true);
  approval.resolve({ type: "tool-approval-request", approvalId: "approval", toolCallId: "write" });
  expect((await reader.read()).value?.type).toBe("tool-approval-request");
  expect((await reader.read()).value?.type).toBe("finish");
  let closed = false;
  const end = reader.read().then((value) => { closed = value.done; });
  await Promise.resolve();
  expect(closed).toBe(false);
  persisted.resolve();
  await end;
  expect(closed).toBe(true);
});

test("98 项审批并发有界，总时长超过单项期限仍能正常完成", async () => {
  const tools = Array.from({ length: 98 }, (_, index): UIMessageChunk => ({
    type: "tool-input-available", toolName: "edit_node", toolCallId: `call-${index}`, input: {},
  }));
  const f = fixture([{ type: "start-step" }, ...tools, { type: "finish-step" }, { type: "finish", finishReason: "tool-calls" }]);
  let active = 0;
  let peak = 0;
  let completed = 0;
  f.options.approveTool = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    completed++;
    return null;
  };
  const chunks = await collect(f.options);
  expect(peak).toBe(4);
  expect(completed).toBe(98);
  expect(chunks.at(-1)?.type).toBe("finish");
  expect(f.saves[0]?.status).toBe("complete");
});
