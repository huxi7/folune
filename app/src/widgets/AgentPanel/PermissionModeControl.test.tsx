/**
 * [INPUT]: 依赖真实权限控件/Store/缓存、happy-dom、ToastProvider 与延迟 API
 * [OUTPUT]: 覆盖默认显示、刷新重挂载、凭据刷新期间保存、账号隔离与失败重试
 * [POS]: 审批选择器生命周期门禁；子进程隔离模块替身，不访问真实账号
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { AiPermissionMode, AiUserSettings } from "../../shared/api/ai";

if (process.env.FOLUNE_PERMISSION_TEST_CHILD !== "1") {
  test("隔离运行权限选择器生命周期", async () => {
    const child = Bun.spawn([process.execPath, "test", import.meta.path], {
      cwd: new URL("../../..", import.meta.url).pathname,
      env: { ...process.env, FOLUNE_PERMISSION_TEST_CHILD: "1" }, stdout: "pipe", stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`${stdout}\n${stderr}`);
    expect(code).toBe(0);
  });
} else {
  const browser = new Window();
  Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement });
  const fixture = (permission_mode: AiPermissionMode, user_id = "user-a"): AiUserSettings => ({
    permission_mode, user_id, created_at: "2026-09-27T00:00:00Z", updated_at: "2026-09-27T00:00:00Z",
  });
  let get = async (_token: string) => fixture("full_access");
  let save = async (_token: string, mode: AiPermissionMode) => fixture(mode);
  const api = await import("../../shared/api/ai");
  mock.module("../../shared/api/ai", () => ({
    ...api, getAiSettings: (token: string) => get(token),
    updateAiSettings: (token: string, mode: AiPermissionMode) => save(token, mode),
  }));
  const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { ToastProvider } = await import("../../shared/design-system/components");
  const { PermissionModeControl } = await import("./PermissionModeControl");
  const { resetAiSettingsCacheForTests, readAiSettings } = await import("./aiSettingsCache");
  const { isPermissionReady, useAgentPanelStore } = await import("../../shared/store/agentPanelStore");
  const control = (token = "token-a", userId = "user-a") => <ToastProvider><PermissionModeControl
    accessToken={token} userId={userId} busy={false} /></ToastProvider>;
  const ready = () => waitFor(() => expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(true));
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
  }
  afterEach(() => {
    cleanup(); resetAiSettingsCacheForTests();
    useAgentPanelStore.setState(useAgentPanelStore.getInitialState());
    get = async () => fixture("full_access");
    save = async (_token, mode) => fixture(mode);
  });

  test("首屏为完全访问，慢读取期间不放行，手动询问刷新后仍保留", async () => {
    const pending = deferred<AiUserSettings>(); get = () => pending.promise;
    const view = render(control());
    expect((view.getByRole("button", { name: "审批模式：完全访问" }) as HTMLButtonElement).disabled).toBe(true);
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(false);
    await act(async () => pending.resolve(fixture("ask")));
    await ready();
    expect(view.getByRole("button", { name: "审批模式：每次询问" })).not.toBeNull();
    view.unmount();
    resetAiSettingsCacheForTests();
    useAgentPanelStore.setState(useAgentPanelStore.getInitialState());
    get = async () => fixture("ask");
    const reopened = render(control()); await ready();
    expect(reopened.getByRole("button", { name: "审批模式：每次询问" })).not.toBeNull();
  });

  test("保存期间凭据刷新和卸载后重挂都等待同一保存结果", async () => {
    get = async () => fixture("ask");
    const pending = deferred<AiUserSettings>(); save = () => pending.promise;
    const view = render(control()); await ready();
    fireEvent.click(view.getByRole("button", { name: "审批模式：每次询问" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: /完全访问/ }));
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(false);
    view.rerender(control("refreshed-token"));
    view.unmount();
    const reopened = render(control("refreshed-token"));
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(false);
    await act(async () => pending.resolve(fixture("full_access")));
    await ready();
    expect(reopened.getByRole("button", { name: "审批模式：完全访问" })).not.toBeNull();
    expect((await readAiSettings("refreshed-token", "user-a")).permission_mode).toBe("full_access");
  });

  test("读取失败后可以重选当前完全访问并保存，不能把同值选择当成无操作", async () => {
    get = async () => { throw new Error("离线"); };
    let saved = 0; save = async (_token, mode) => { saved++; return fixture(mode); };
    const view = render(control());
    await waitFor(() => expect(useAgentPanelStore.getState().permissionStatus).toBe("error"));
    fireEvent.click(view.getByRole("button", { name: "审批模式：完全访问" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: /完全访问/ }));
    await ready(); expect(saved).toBe(1);
  });

  test("切账号后旧账号保存完成不覆盖新账号，旧账号缓存仍正确落地", async () => {
    const pending = deferred<AiUserSettings>(); save = () => pending.promise;
    const view = render(control()); await ready();
    fireEvent.click(view.getByRole("button", { name: "审批模式：完全访问" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: /每次询问/ }));
    get = async () => fixture("auto_approve", "user-b");
    view.rerender(control("token-b", "user-b"));
    await waitFor(() => expect(useAgentPanelStore.getState().permissionMode).toBe("auto_approve"));
    await act(async () => pending.resolve(fixture("ask")));
    expect(useAgentPanelStore.getState().permissionMode).toBe("auto_approve");
    expect((await readAiSettings("token-a", "user-a")).permission_mode).toBe("ask");
  });
}
