/**
 * [INPUT]: 依赖 Bun test、真实 userinfo 路由和 GitHub HTTP 替身
 * [OUTPUT]: 验证只接受已验证主邮箱、分页、不缓存和凭据拒绝；不连接真实账号
 * [POS]: GitHub 主邮箱认证门禁；保护 Supabase 自动关联收到的唯一邮箱事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Hono } from "hono";
import { githubAuthRouter } from "../src/router/github-auth.router.ts";
import { errorHandler } from "../src/middleware/error-handler.ts";
const app = new Hono().route("/auth/github", githubAuthRouter);
app.onError(errorHandler);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const user = { id: 123, login: "octocat", name: null, email: "secondary@example.com", avatar_url: "https://avatars.githubusercontent.com/u/123" };
function mockGitHub(pages: unknown[][], status = 200) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://api.github.com");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer github-test-token");
    if (status !== 200) return new Response("provider diagnostic", { status });
    return Response.json(url.pathname === "/user" ? user : pages[Number(url.searchParams.get("page")) - 1]);
  }) as unknown as typeof fetch;
}
function request() { return app.request("/auth/github/userinfo", { headers: { Authorization: "Bearer github-test-token" } }); }
test("公开邮箱和多个备用邮箱不参与匹配，标准 JSON 只返回已验证主邮箱", async () => {
  mockGitHub([[{ email: "secondary@example.com", primary: false, verified: true }, { email: "Main@Example.com", primary: true, verified: true }]]);
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.sub).toBe("123"); expect(data.email).toBe("main@example.com"); expect(data.email_verified).toBe(true);
  expect(JSON.stringify(data)).not.toContain("secondary@example.com");
});
test("主邮箱在下一页时继续查找，不采用第一页备用邮箱", async () => {
  mockGitHub([Array.from({ length: 100 }, (_, i) => ({ email: `secondary${i}@example.com`, primary: false, verified: true })), [{ email: "primary@example.com", primary: true, verified: true }]]);
  expect((await (await request()).json()).email).toBe("primary@example.com");
});
test.each([
  [[], 403],
  [[{ email: "secondary@example.com", primary: false, verified: true }], 403],
  [[{ email: "primary@example.com", primary: true, verified: false }], 403],
  [[{ email: "one@example.com", primary: true, verified: true }, { email: "two@example.com", primary: true, verified: true }], 502],
] as const)("没有合法主邮箱时拒绝，不回退到备用邮箱：%j", async (emails, status) => {
  mockGitHub([[...emails]]);
  expect((await request()).status).toBe(status);
});
test("缺少凭据不访问 GitHub，错误凭据不泄露提供商原文", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("private provider diagnostic", { status: 401 }); }) as unknown as typeof fetch;
  expect((await app.request("/auth/github/userinfo")).status).toBe(401);
  expect(calls).toBe(0);
  const response = await request(); expect(response.status).toBe(401);
  expect(await response.text()).not.toContain("private provider diagnostic");
});
