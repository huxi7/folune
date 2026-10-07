/**
 * [INPUT]: 依赖 happy-dom、Testing Library、Router 与可替换的认证交换服务
 * [OUTPUT]: 验证共享 OAuth 回调的单次交换、成功导航、冲突选择、返回原登录布局、绑定确认与提供商诊断隔离
 * [POS]: pages 的认证路由回归；不调用真实 Supabase
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/auth/callback" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Node: browserWindow.Node,
  ResizeObserver: browserWindow.ResizeObserver,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
});
const { cleanup, fireEvent, render } = await import("@testing-library/react/pure");
const { StrictMode } = await import("react");
const { MemoryRouter, Route, Routes } = await import("react-router-dom");
const auth = await import("../shared/supabase/auth");
const { AuthCallbackPage } = await import("./AuthCallbackPage");
const { LoginPage } = await import("./LoginPage");

afterEach(() => { cleanup(); auth.clearGitHubLinkIntent(); mock.restore(); });

function renderCallback(query: string) {
  browserWindow.happyDOM.setURL(`http://localhost:10000/auth/callback${query}`);
  return render(<StrictMode><MemoryRouter initialEntries={["/auth/callback"]}><Routes>
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/app" element={<p>工作区</p>} />
    <Route path="/login" element={<LoginPage />} />
  </Routes></MemoryRouter></StrictMode>);
}

test("StrictMode 下授权码只交换一次，成功后进入工作区", async () => {
  const exchange = spyOn(auth, "completeOAuthSignIn").mockResolvedValue(undefined);
  const view = renderCallback("?code=single-use-code");
  await view.findByText("工作区");
  expect(exchange).toHaveBeenCalledTimes(1);
  expect(exchange).toHaveBeenCalledWith("single-use-code");
});

test.each([
  ["", "OAuth 回调缺少授权码，请重新登录。"],
  ["?error=access_denied&error_description=Authorization+cancelled", "授权未完成，请重新登录或选择其他方式。"],
  ["?error=server_error&error_code=unexpected_failure&error_description=Internal+account+diagnostic", "认证服务暂时不可用，请稍后再试。"],
  ["?error=access_denied", "授权未完成，请重新登录或选择其他方式。"],
])("授权拒绝或缺码时不交换，可返回登录：%s", async (query, message) => {
  const exchange = spyOn(auth, "completeOAuthSignIn");
  const view = renderCallback(query);
  expect(view.getByRole("heading").textContent).toBe("未能完成登录");
  expect(view.getByRole("alert").textContent).toBe(message);
  expect(exchange).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "返回登录" }));
  await view.findByRole("heading", { level: 1 });
  expect(view.container.querySelector(".auth-composition")).not.toBeNull();
});

test("交换失败显示统一错误，不跳转工作区", async () => {
  spyOn(auth, "completeOAuthSignIn").mockRejectedValue({ code: "unknown" });
  const view = renderCallback("?code=expired-code");
  await view.findByText("认证服务暂时不可用，请稍后再试。");
  expect(view.queryByText("工作区")).toBeNull();
});

test("多账号冲突只提供登录选择，不显示匿名候选邮箱或诊断", async () => {
  const exchange = spyOn(auth, "completeOAuthSignIn");
  const view = renderCallback("?error=server_error&error_description=" + encodeURIComponent("Multiple accounts with the same email address in the same linking domain detected: default"));
  await view.findByText("登录你要使用的账号，继续绑定 GitHub");
  expect(view.container.querySelectorAll(".auth-card")).toHaveLength(1);
  expect(view.container.querySelector(".auth-artwork video")).not.toBeNull();
  expect(view.container.querySelector(".auth-callback-card")).toBeNull();
  expect(view.queryByText(/linking domain/)).toBeNull();
  expect(view.queryByText("使用 GitHub 账号继续")).toBeNull();
  expect(view.queryByRole("button", { name: "注册" })).toBeNull();
  expect(exchange).not.toHaveBeenCalled();
});

test("选择账号的 Google 回调先确认邮箱，不直接进入工作区", async () => {
  auth.beginGitHubAccountSelection();
  spyOn(auth, "completeOAuthSignIn").mockResolvedValue(undefined);
  spyOn(auth, "getGitHubLinkAccount").mockResolvedValue({ id: "chosen", email: "chosen@example.com", hasGitHub: false });
  const link = spyOn(auth, "linkGitHubIdentity").mockResolvedValue(undefined);
  const view = renderCallback("?code=selection-code");
  await view.findByText("确认 GitHub 登录账号");
  expect(view.queryByText("工作区")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "确认并继续" }));
  await Promise.resolve();
  expect(link).toHaveBeenCalledTimes(1);
  expect(link).toHaveBeenCalledWith("chosen");
});


test("确认时换个账号回到同一卡片登录，不发起绑定", async () => {
  auth.beginGitHubAccountSelection();
  spyOn(auth, "completeOAuthSignIn").mockResolvedValue(undefined);
  spyOn(auth, "getGitHubLinkAccount").mockResolvedValue({ id: "chosen", email: "chosen@example.com", hasGitHub: false });
  const link = spyOn(auth, "linkGitHubIdentity");
  const view = renderCallback("?code=selection-code");
  await view.findByText("chosen@example.com");
  fireEvent.click(view.getByRole("button", { name: "换个账号" }));
  await view.findByText("登录你要使用的账号，继续绑定 GitHub");
  expect(view.container.querySelectorAll(".auth-card")).toHaveLength(1);
  expect(view.queryByText("chosen@example.com")).toBeNull();
  expect(link).not.toHaveBeenCalled();
});
