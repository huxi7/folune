/**
 * [INPUT]: 依赖 Bun test、可控 fetch 与 upstream-http
 * [OUTPUT]: 锁定响应体超时、读取重试新连接、写入不重试及主动取消
 * [POS]: Chat Auth/Business API 完整 HTTP 生命周期回归
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { fetchUpstreamResponse } from "./upstream-http";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("响应头已到但 body 停滞也超时，GET 换新连接重试成功", async () => {
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    if (calls.length > 1) return Response.json({ ok: true });
    return new Response(new ReadableStream({
      start(controller) {
        init.signal!.addEventListener("abort", () => controller.error(init.signal!.reason));
      },
    }));
  }) as unknown as typeof fetch;
  const response = await fetchUpstreamResponse("https://example.test", {}, { timeoutMs: 10, retryRead: true });
  expect(await response.json()).toEqual({ ok: true });
  expect(calls).toHaveLength(2);
  expect(calls[1]?.keepalive).toBe(false);
});

test("POST 响应丢失也不能自动重试", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new TypeError("network"); }) as unknown as typeof fetch;
  await expect(fetchUpstreamResponse("https://example.test", { method: "POST" }, { retryRead: true })).rejects.toThrow();
  expect(calls).toBe(1);
});

test("主动取消不触发读取重试", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (async () => { calls++; controller.abort(); throw controller.signal.reason; }) as unknown as typeof fetch;
  await expect(fetchUpstreamResponse("https://example.test", { signal: controller.signal }, { retryRead: true })).rejects.toThrow();
  expect(calls).toBe(1);
});
