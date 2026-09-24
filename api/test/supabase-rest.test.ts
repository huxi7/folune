/**
 * [INPUT]: 依赖 Bun test、globalThis.fetch 替身与 lib/supabase-rest 的 supabaseRest、common/HttpError
 * [OUTPUT]: 锁定只读请求断连后重试一次并成功、写请求不重试、连接故障收敛为 503 SUPABASE_UNREACHABLE、调用方主动取消如实透传
 * [POS]: api 网络层可靠性回归门禁；只替换 globalThis.fetch，不触网、不连 Supabase，护住"陈旧连接快速失败而非挂死"的契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";

import { HttpError } from "../src/common/http-error.ts";
import { supabaseRest } from "../src/lib/supabase-rest.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// 模拟陈旧连接被复用时的典型故障：socket 直接断开
const connError = (): never => {
  throw new TypeError("socket connection closed unexpectedly");
};

test("只读请求断连后换新连接重试一次并成功", async () => {
  let calls = 0;
  const connectionModes: Array<boolean | undefined> = [];
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls += 1;
    connectionModes.push(init.keepalive);
    return calls === 1 ? connError() : ok([{ id: "n1" }]);
  }) as unknown as unknown as typeof fetch;

  const result = await supabaseRest<{ id: string }[]>("memo_nodes", {
    accessToken: "t",
  });

  expect(calls).toBe(2);
  expect(connectionModes).toEqual([undefined, false]);
  expect(result).toEqual([{ id: "n1" }]);
});

test("响应体中途断连仍属于同一次读取失败，重试后返回完整数据", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls > 1) return ok([{ id: "n1" }]);
    return new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError("body connection reset")); },
    }));
  }) as unknown as typeof fetch;
  expect(await supabaseRest<{ id: string }[]>("memo_nodes", { accessToken: "t" })).toEqual([{ id: "n1" }]);
  expect(calls).toBe(2);
});

test("写响应体断连只报错一次，不重放已提交的写入", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError("body connection reset")); },
    }));
  }) as unknown as typeof fetch;
  await expect(supabaseRest("memo_nodes", { accessToken: "t", method: "PATCH" })).rejects.toMatchObject({ code: "SUPABASE_UNREACHABLE" });
  expect(calls).toBe(1);
});

test("写请求断连绝不重试，收敛为 503 SUPABASE_UNREACHABLE 以防双写", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return connError();
  }) as unknown as unknown as typeof fetch;

  let caught: unknown;
  try {
    await supabaseRest("memo_nodes", { accessToken: "t", method: "POST", body: "{}" });
  } catch (error) {
    caught = error;
  }

  expect(calls).toBe(1);
  expect(caught).toBeInstanceOf(HttpError);
  expect((caught as HttpError).status).toBe(503);
  expect((caught as HttpError).code).toBe("SUPABASE_UNREACHABLE");
});

test("只读请求两次都断连才失败，且报 503 而不是裸网络错误", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return connError();
  }) as unknown as unknown as typeof fetch;

  let caught: unknown;
  try {
    await supabaseRest("memo_nodes", { accessToken: "t" });
  } catch (error) {
    caught = error;
  }

  expect(calls).toBe(2);
  expect((caught as HttpError).code).toBe("SUPABASE_UNREACHABLE");
});

test("调用方主动取消如实透传，不当连接故障、不重试", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  }) as unknown as unknown as typeof fetch;

  let caught: unknown;
  try {
    await supabaseRest("memo_nodes", { accessToken: "t", signal: controller.signal });
  } catch (error) {
    caught = error;
  }

  expect(calls).toBe(1);
  expect(caught).toBeInstanceOf(DOMException);
  expect(caught).not.toBeInstanceOf(HttpError);
});
