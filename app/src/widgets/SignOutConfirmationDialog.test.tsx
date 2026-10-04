/**
 * [INPUT]: 依赖happy-dom、Testing Library、真实菜单/账户退出入口与SignOutConfirmationDialog；退出命令由可控Promise代替
 * [OUTPUT]: 验证两入口确认、取消/焦点、处理中防重/禁止取消、失败重试与英文文案
 * [POS]: widgets的退出确认交互门禁；不调用真实Auth、不终止用户会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { useState } from "react";
import type { Profile } from "../shared/api/profile";
const browser = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement,
  Element: browser.Element, Node: browser.Node, SVGElement: browser.SVGElement,
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
  getComputedStyle: browser.getComputedStyle.bind(browser) });
const { render, cleanup, fireEvent, waitFor, act } = await import("@testing-library/react/pure");
const { SignOutConfirmationDialog } = await import("./SignOutConfirmationDialog");
const { AccountSecurityPanel } = await import("./AccountSecurityPanel");
const { UserMenu, ToastProvider, Dialog } = await import("../shared/design-system/components");
const { LocaleContext, localizedValues } = await import("../shared/locale");
afterEach(cleanup);
const noop = () => {};
const profile = { id: "profile", email: "link@example.test" } as Profile;
function Fixture({ onConfirm, settings = false, english = false }: { onConfirm: () => Promise<void>; settings?: boolean; english?: boolean }) {
  const [open, setOpen] = useState(false);
  const request = async () => { setOpen(true); };
  const content = <ToastProvider>
    {settings ? <Dialog open title="设置" onOpenChange={noop}><AccountSecurityPanel profile={profile} onSignOut={request} /></Dialog>
      : <UserMenu email={profile.email!} name="link" onOpenProfile={noop} onOpenSettings={noop} onOpenSubscription={noop} onSignOut={request} />}
    <SignOutConfirmationDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
  </ToastProvider>;
  return english ? <LocaleContext.Provider value={{ ...localizedValues("en"), setLocale: noop }}>{content}</LocaleContext.Provider> : content;
}
async function openMenu(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "打开用户菜单" }));
  fireEvent.click(await view.findByRole("menuitem", { name: "退出登录" }));
}

test("菜单与设置均先确认，取消不会调用真实退出", async () => {
  for (const settings of [false, true]) {
    let calls = 0;
    const view = render(<Fixture settings={settings} onConfirm={async () => { calls++; }} />);
    if (settings) fireEvent.click(view.getByRole("button", { name: "退出" })); else await openMenu(view);
    const confirmation = await view.findByRole("dialog", { name: "退出登录?" });
    expect(confirmation.getAttribute("data-backdrop")).toBe("dim");
    expect(calls).toBe(0);
    fireEvent.click(view.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(view.queryByRole("dialog", { name: "退出登录?" })).toBeNull());
    expect(calls).toBe(0);
    if (settings) expect(view.getByRole("dialog", { name: "设置" })).toBeTruthy();
    view.unmount();
  }
});

test("焦点默认在取消，Escape和遮罩只取消确认", async () => {
  let calls = 0;
  const view = render(<Fixture onConfirm={async () => { calls++; }} />);
  await openMenu(view);
  await waitFor(() => expect(document.activeElement === view.getByRole("button", { name: "取消" })).toBe(true));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
  await openMenu(view);
  await view.findByRole("dialog");
  fireEvent.click(document.querySelector(".ds-dialog-backdrop")!);
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
  expect(calls).toBe(0);
});

test("确认只执行一次，处理中不能取消，成功后结束确认", async () => {
  let calls = 0;
  let finish!: () => void;
  const work = new Promise<void>(resolve => { finish = resolve; });
  const view = render(<Fixture onConfirm={() => { calls++; return work; }} />);
  await openMenu(view);
  const confirm = await view.findByRole("button", { name: "退出登录" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(calls).toBe(1);
  expect((view.getByRole("button", { name: "取消" }) as HTMLButtonElement).disabled).toBe(true);
  expect(view.getByRole("button", { name: "退出登录" }).getAttribute("aria-busy")).toBe("true");
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(document.querySelector(".ds-dialog-backdrop")!);
  expect(view.getByRole("dialog")).toBeTruthy();
  await act(async () => { finish(); await work; });
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
});

test("失败保留工作区入口并可重试，不显示内部错误", async () => {
  let calls = 0;
  const view = render(<Fixture onConfirm={async () => { if (++calls === 1) throw new Error("private provider error"); }} />);
  await openMenu(view);
  const confirm = await view.findByRole("button", { name: "退出登录" });
  fireEvent.click(confirm);
  await waitFor(() => expect(document.querySelector(".signout-confirmation-error")?.textContent).toBe("退出未完成，请稍后重试。"));
  expect(document.body.textContent?.includes("private provider error")).toBe(false);
  expect(document.querySelector('button[aria-label="打开用户菜单"]') !== null).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "退出登录" }));
  await waitFor(() => expect(document.querySelector('.ds-dialog-overlay[role="dialog"]') === null).toBe(true));
  expect(calls).toBe(2);
});

test("英文确认只有取消/退出两个动作，不额外添加关闭叉或提示", async () => {
  const view = render(<Fixture english settings onConfirm={async () => {}} />);
  fireEvent.click(view.getByRole("button", { name: "Sign out" }));
  await view.findByRole("dialog", { name: "Sign out?" });
  const surface = document.querySelector(".signout-confirmation")!;
  expect(surface.querySelectorAll("button")).toHaveLength(2);
  expect(surface.querySelector('[data-warm-tooltip-trigger]')).toBeNull();
  expect(view.getByRole("button", { name: "Cancel" })).toBeTruthy();
});
