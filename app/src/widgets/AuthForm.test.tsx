/**
 * [INPUT]: 依赖 happy-dom、Testing Library、MemoryRouter、真实 AuthForm 与可替换的认证服务调用
 * [OUTPUT]: 验证独立页面中的登录成功/失败、注册密码校验及邮箱验证码步骤，不向真实账号或认证服务器发请求
 * [POS]: widgets 的认证迁移回归门禁；只替换服务边界，真实表单事件与局部状态完整运行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/login" });
Object.assign(globalThis, {
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  HTMLInputElement: browserWindow.HTMLInputElement,
  Node: browserWindow.Node,
  window: browserWindow,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
});

const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { MemoryRouter } = await import("react-router-dom");
const auth = await import("../shared/supabase/auth");
const { AuthForm } = await import("./AuthForm");

afterEach(() => {
  cleanup();
  mock.restore();
});

function renderForm() {
  const onAuthenticated = mock(() => undefined);
  const view = render(<MemoryRouter><AuthForm onAuthenticated={onAuthenticated} /></MemoryRouter>);
  fireEvent.change(view.getByLabelText("电子邮箱", { exact: true }), {
    target: { value: "writer@example.com" },
  });
  return { ...view, onAuthenticated };
}

function fillPassword(view: ReturnType<typeof renderForm>, password = "sample-password") {
  fireEvent.change(view.getByLabelText("密码", { exact: true }), {
    target: { value: password },
  });
}

describe("AuthForm", () => {
  test("邮箱登录成功只通知页面，表单不再创建模态或劫持正文", async () => {
    const signIn = spyOn(auth, "signInWithPassword").mockResolvedValue("authenticated");
    const view = renderForm();
    fillPassword(view);
    fireEvent.click(view.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(view.onAuthenticated).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith("writer@example.com", "sample-password");
    expect(view.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  test("认证失败保留邮箱并恢复可提交状态", async () => {
    spyOn(auth, "signInWithPassword").mockRejectedValue({ code: "invalid_credentials" });
    const view = renderForm();
    fillPassword(view);
    fireEvent.click(view.getByRole("button", { name: "登录" }));

    await view.findByText("邮箱或密码不正确。");
    expect(view.onAuthenticated).not.toHaveBeenCalled();
    expect((view.getByLabelText("电子邮箱", { exact: true }) as HTMLInputElement).value)
      .toBe("writer@example.com");
    expect((view.getByRole("button", { name: "登录" }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  test("注册先校验两次密码，不一致时不请求认证服务", async () => {
    const signUp = spyOn(auth, "signUpWithPassword").mockResolvedValue("verification-required");
    const view = renderForm();
    fireEvent.click(view.getByRole("button", { name: "注册" }));
    fillPassword(view);
    fireEvent.change(view.getByLabelText("确认密码", { exact: true }), {
      target: { value: "different-password" },
    });
    fireEvent.click(view.getByRole("button", { name: "注册" }));

    await view.findByText("两次输入的密码不一致。");
    expect(signUp).not.toHaveBeenCalled();
    expect(view.onAuthenticated).not.toHaveBeenCalled();
  });

  test("注册切换到验证码，粘贴六位验证码后完成认证", async () => {
    const signUp = spyOn(auth, "signUpWithPassword").mockResolvedValue("verification-required");
    const verify = spyOn(auth, "verifyEmailOtp").mockResolvedValue(undefined);
    const view = renderForm();
    fireEvent.click(view.getByRole("button", { name: "注册" }));
    fillPassword(view);
    fireEvent.change(view.getByLabelText("确认密码", { exact: true }), {
      target: { value: "sample-password" },
    });
    fireEvent.click(view.getByRole("button", { name: "注册" }));

    await view.findByRole("group", { name: "六位邮箱验证码" });
    expect(signUp).toHaveBeenCalledWith("writer@example.com", "sample-password");
    expect(view.onAuthenticated).not.toHaveBeenCalled();
    fireEvent.paste(view.getByLabelText("验证码第 1 位"), {
      clipboardData: { getData: () => "123456" },
    });

    await waitFor(() => expect(view.onAuthenticated).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledWith("writer@example.com", "123456");
  });
});
