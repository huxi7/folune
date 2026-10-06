/**
 * [INPUT]: 依赖 Bun test、真实认证 service 与受控 Supabase Auth HTTP 替身
 * [OUTPUT]: 验证大量轮换 token 的身份缓存保持固定容量，淘汰后重新验证且保留近期命中
 * [POS]: 认证缓存资源边界回归；不读取缓存内部状态，也不连接远端或保存真实凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = "https://profile-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_profile_test";
const { authService } = await import("../src/service/auth.service.ts");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  authService.resetIdentityCacheForTests();
});

test("轮换 token 超过缓存容量后淘汰最早身份，近期身份仍复用验证", async () => {
  authService.resetIdentityCacheForTests();
  let validations = 0;
  globalThis.fetch = (async () => {
    validations++;
    return Response.json({ id: "11111111-1111-4111-8111-111111111111" });
  }) as unknown as typeof fetch;

  for (let index = 0; index < 1_025; index++) {
    await authService.authenticate(`rotated-test-token-${index}`);
  }
  expect(validations).toBe(1_025);
  await authService.authenticate("rotated-test-token-1024");
  expect(validations).toBe(1_025);
  await authService.authenticate("rotated-test-token-0");
  expect(validations).toBe(1_026);
});
