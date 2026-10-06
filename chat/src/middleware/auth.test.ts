/**
 * [INPUT]: 依赖 Bun test、可控 Auth HTTP/时钟与真实 authMiddleware
 * [OUTPUT]: 锁定身份缓存 45 秒期限/1024 项上限、失败不缓存、并发去重与请求取消隔离
 * [POS]: Chat 身份边界回归；仅模拟 Supabase 返回，用户身份仍必须来自验证成功的响应
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";

import { authMiddleware } from "./auth";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;
let now = Date.now();
let clock: ReturnType<typeof spyOn>;
let sequence = 0;
beforeEach(() => {
  now += 100_000;
  sequence++;
  clock = spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => { globalThis.fetch = originalFetch; clock.mockRestore(); });

function request(token: string, signal = new AbortController().signal) {
  let userId: string | undefined;
  let continued = false;
  const result = authMiddleware({
    req: { header: () => `Bearer ${token}`, raw: { signal } },
    get: () => ({ set: (_name: string, value: string) => { userId = value; } }),
    json: (body: unknown, status: number) => Response.json(body, { status }),
  } as unknown as Parameters<typeof authMiddleware>[0], async () => { continued = true; });
  return { result, userId: () => userId, continued: () => continued };
}

test("同 token 的并发身份验证只回源一次，完成后命中缓存", async () => {
  let calls = 0;
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>((done) => { resolve = done; });
  globalThis.fetch = (async () => { calls++; return response; }) as unknown as typeof fetch;
  const first = request(`parallel-${sequence}`);
  const second = request(`parallel-${sequence}`);
  const simultaneousCalls = calls;
  resolve(Response.json({ id: USER_ID }));
  await Promise.all([first.result, second.result]);
  expect(simultaneousCalls).toBe(1);
  expect(first.userId()).toBe(USER_ID);
  expect(second.userId()).toBe(USER_ID);
  await request(`parallel-${sequence}`).result;
  expect(calls).toBe(1);
});

test("身份成功缓存不续期，45 秒后必须重新验证；401 不缓存", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? Response.json({ id: USER_ID }) : new Response(null, { status: 401 });
  }) as unknown as typeof fetch;
  await request(`expiry-${sequence}`).result;
  now += 44_999;
  await request(`expiry-${sequence}`).result;
  expect(calls).toBe(1);
  now++;
  const expired = request(`expiry-${sequence}`);
  expect((await expired.result as Response).status).toBe(401);
  expect(expired.continued()).toBe(false);
  expect((await request(`expiry-${sequence}`).result as Response).status).toBe(401);
  expect(calls).toBe(3);
});

test("身份缓存最多 1024 项，token 轮换后淘汰最早成功身份", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ id: USER_ID }); }) as unknown as typeof fetch;
  for (let index = 0; index < 1025; index++) await request(`capacity-${sequence}-${index}`).result;
  expect(calls).toBe(1025);
  await request(`capacity-${sequence}-1024`).result;
  expect(calls).toBe(1025);
  await request(`capacity-${sequence}-0`).result;
  expect(calls).toBe(1026);
});

test("一个请求取消不终止同 token 的其他等待者，已取消请求不进入业务路由", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls++;
    return await new Promise<Response>((resolve, reject) => {
      const abort = () => reject(init.signal?.reason);
      init.signal?.addEventListener("abort", abort, { once: true });
      void gate.then(() => {
        init.signal?.removeEventListener("abort", abort);
        resolve(Response.json({ id: USER_ID }));
      });
    });
  }) as unknown as typeof fetch;
  const controller = new AbortController();
  const first = request(`cancel-${sequence}`, controller.signal);
  const second = request(`cancel-${sequence}`);
  controller.abort();
  expect((await first.result as Response).status).toBe(502);
  expect(first.continued()).toBe(false);
  release();
  await second.result;
  expect(second.userId()).toBe(USER_ID);
  expect(second.continued()).toBe(true);
  expect(calls).toBe(1);
});

test("缓存命中期间立即取消也不能进入业务路由", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ id: USER_ID }); }) as unknown as typeof fetch;
  await request(`cached-cancel-${sequence}`).result;
  const controller = new AbortController();
  const cancelled = request(`cached-cancel-${sequence}`, controller.signal);
  controller.abort();
  expect((await cancelled.result as Response).status).toBe(502);
  expect(cancelled.continued()).toBe(false);
  expect(calls).toBe(1);
});
