/**
 * [INPUT]: 依赖 Bun test、共享命令 HTTP client 与可取消的网络替身
 * [OUTPUT]: 验证写命令携带响应期限、失联时退出且不自动重放
 * [POS]: AI 工具队列的网络终止门禁，不提交真实业务命令
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { createAiCommand, type CreateAiCommandInput } from "./ai";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const command: CreateAiCommandInput = {
  operation: "trash_node", input: {}, idempotency_key: "request-test",
  thread_id: "thread-test", tool_call_id: "call-test", target_node_id: "memo-test", expected_revision: 1,
  approval_source: "full_access", risk: "high", approval_reason: "测试请求，不访问业务服务。",
};

test("命令默认带有期限且完整保留幂等键", async () => {
  let request!: Request;
  globalThis.fetch = (async (url, init) => {
    request = new Request(url, init);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return Response.json({ code: "ok", message: "OK", data: { status: "succeeded" } });
  }) as typeof fetch;
  expect((await createAiCommand("test", command)).status).toBe("succeeded");
  expect((await request.json()).idempotency_key).toBe("request-test");
});

test("命令网络不响应时随信号退出，写请求只发送一次", async () => {
  let calls = 0;
  const controller = new AbortController();
  globalThis.fetch = (async (_url, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
      controller.abort();
    });
  }) as typeof fetch;
  await expect(createAiCommand("test", command, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toBe(1);
});
