/**
 * [INPUT]: 依赖 happy-dom、Testing Library、Router 与可替换的认证交换服务
 * [OUTPUT]: 验证共享 OAuth 回调的单次交换、成功导航、冲突选择、直接成功导航与提供商诊断隔离
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

afterEach(() => { cleanup(); mock.restore(); });

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
