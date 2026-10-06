/**
 * [INPUT]: 依赖 Bun test、真实 Storage 适配器与响应体/连接故障 HTTP 替身
 * [OUTPUT]: 验证 Storage 上传/删除完整响应期限、写入不重放、成功响应体读完及网络错误净化
 * [POS]: 头像对象基础设施回归；故障只发生在本地 fetch 替身，绝不请求远端 Storage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, spyOn, test } from "bun:test";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = "https://profile-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_profile_test";
const { removeAvatarObject, uploadAvatarObject } = await import("../src/lib/supabase-storage.ts");
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;

afterEach(() => { globalThis.fetch = originalFetch; });

const upload = () => uploadAvatarObject({
  accessToken: "test-token",
  body: new Uint8Array([1, 2, 3]).buffer,
  contentType: "image/png",
  objectPath: "user/avatar.png",
});

test("Storage 成功响应必须读完 body，完整请求才可完成", async () => {
  const response = new Response("{\"Key\":\"avatars/user/avatar.png\"}");
  globalThis.fetch = (async () => response) as unknown as typeof fetch;
  await upload();
  expect(response.bodyUsed).toBe(true);
});

test("Storage 连接失败和响应体断连均净化为统一错误，写入不重放", async () => {
  for (const stage of ["headers", "body"]) {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      const error = new TypeError("private-upstream-details");
      if (stage === "headers") throw error;
      return new Response(new ReadableStream({ start(controller) { controller.error(error); } }));
    }) as unknown as typeof fetch;
    await expect(upload()).rejects.toMatchObject({
      status: 502,
      code: "SUPABASE_STORAGE_ERROR",
      message: "Supabase Storage is unavailable",
    });
    expect(calls).toBe(1);
  }
});

test("Storage 上传与删除的响应体挂起受 12 秒共享期限约束", async () => {
  const timeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler, delay?: number) =>
    originalSetTimeout(callback, delay === 12_000 ? 1 : delay)) as typeof setTimeout);
  try {
    for (const operation of [upload, () => removeAvatarObject("user/avatar.png", "test-token")]) {
      let calls = 0;
      globalThis.fetch = (async (_url, init) => {
        calls++;
        return new Response(new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
          },
        }));
      }) as typeof fetch;
      await expect(operation()).rejects.toMatchObject({ code: "SUPABASE_STORAGE_ERROR" });
      expect(calls).toBe(1);
    }
    expect(timeoutSpy.mock.calls.filter(([, delay]) => delay === 12_000)).toHaveLength(2);
  } finally {
    timeoutSpy.mockRestore();
  }
});
