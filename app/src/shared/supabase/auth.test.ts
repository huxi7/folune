/**
 * [INPUT]: 依赖 Bun spy、happy-dom 与真实 auth 服务，替换 SDK 和桌面 bridge
 * [OUTPUT]: 验证 PKCE、桌面交接、主邮箱自定义提供商，不访问真实认证
 * [POS]: shared/supabase 的 OAuth 边界回归；UI 和桌面策略另有各自测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { DesktopBridge } from "../desktop/bridge";

const browserWindow = new Window({ url: "https://folune.example/login" });
Object.assign(globalThis, { window: browserWindow });
const { supabase } = await import("./client");
const auth = await import("./auth");

afterEach(() => {
  mock.restore();
  delete window.foluneDesktop;
});

describe.each([
  ["google", auth.signInWithGoogle],
  ["custom:github", auth.signInWithGitHub],
] as const)("%s OAuth", (provider, signIn) => {
  test("浏览器回调只取当前 origin，继续使用 SDK 的 PKCE 导航", async () => {
    const sdk = spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider, url: "https://example.supabase.co/auth/v1/authorize" }, error: null,
    });
    await signIn();
    expect(sdk).toHaveBeenCalledWith({ provider, options: {
      redirectTo: "https://folune.example/auth/callback", skipBrowserRedirect: false,
    } });
  });

  test("桌面使用宿主回调并只把授权 URL 交给系统浏览器", async () => {
    const redirectTo = "folune://auth/callback?state=transaction";
    const url = `https://example.supabase.co/auth/v1/authorize?provider=${provider}`;
    const openOAuth = mock(async () => undefined);
    window.foluneDesktop = { prepareOAuth: mock(async () => redirectTo), openOAuth } as unknown as DesktopBridge;
    const sdk = spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({ data: { provider, url }, error: null });
    await signIn();
    expect(sdk).toHaveBeenCalledWith({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    expect(openOAuth).toHaveBeenCalledWith(url);
  });

  test("SDK 失败直接传播，不打开系统浏览器", async () => {
    const failure = new Error("OAuth unavailable");
    const openOAuth = mock(async () => undefined);
    window.foluneDesktop = { prepareOAuth: async () => "folune://auth/callback", openOAuth } as unknown as DesktopBridge;
    spyOn(supabase.auth, "signInWithOAuth").mockRejectedValue(failure);
    await expect(signIn()).rejects.toBe(failure);
    expect(openOAuth).not.toHaveBeenCalled();
  });
});

test("未启用提供商的反馈不误指向 Google 或暴露配置细节", () => {
  expect(auth.getAuthErrorMessage({ code: "oauth_provider_not_supported" }))
    .toBe("此登录方式暂未启用，请选择其他方式。");
});
