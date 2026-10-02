/**
 * [INPUT]: 依赖真实 UserMenu/Toast/ThemeProvider、happy-dom 与语言/主题/刷新回调
 * [OUTPUT]: 验证真实主题偏好切换后的当前项、中美国旗、1px子菜单避让与悬停/键盘/触屏/焦点生命周期
 * [POS]: 账户菜单交互门禁；数据获取仍属上层，本测试只确认组件事件与真实 DOM 生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { ComponentProps } from "react";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
  cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
});
window.matchMedia = ((query: string) => ({ matches: true, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
})) as typeof window.matchMedia;
const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { UserMenu } = await import("./UserMenu");
const { ToastProvider } = await import("./Toast");
const { ThemeProvider, useTheme } = await import("../../theme/ThemeProvider");
afterEach(cleanup);
const noop = () => {};

test("主题当前项随真实偏好切换，语言使用中美国旗且保持两项", () => {
  function Account() {
    const { theme, setTheme } = useTheme();
    return <UserMenu name="Lin" email="test@example.test" theme={theme} onThemeChange={setTheme}
      locale="zh-CN" onLocaleChange={noop} onOpenProfile={noop} onOpenSettings={noop}
      onOpenSubscription={noop} onSignOut={async () => {}} />;
  }
  const previousTheme = window.localStorage.getItem("folune-theme");
  window.localStorage.setItem("folune-theme", "system");
  try {
    const view = render(<ThemeProvider><ToastProvider><Account /></ToastProvider></ThemeProvider>);
    for (const [label, current] of [["白天", "跟随系统"], ["黑暗", "白天"], ["跟随系统", "黑暗"]]) {
      fireEvent.click(view.getByRole("button", { name: "打开用户菜单" }));
      fireEvent.click(view.getByRole("menuitem", { name: `界面主题：${current}` }));
      expect(view.getByRole("menuitemradio", { name: current }).getAttribute("aria-checked")).toBe("true");
      expect(view.getByRole("menuitemradio", { name: label }).getAttribute("aria-checked")).toBe("false");
      fireEvent.click(view.getByRole("menuitemradio", { name: label }));
    }
    fireEvent.click(view.getByRole("button", { name: "打开用户菜单" }));
    fireEvent.click(view.getByRole("menuitem", { name: "界面语言：简体中文" }));
    const menu = view.getByRole("menu", { name: "界面语言" });
    expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(2);
    expect(view.getByRole("menuitemradio", { name: "简体中文" }).querySelector('img')?.getAttribute('src')).toBe('/account/flag-cn.svg');
    expect(view.getByRole("menuitemradio", { name: "English" }).querySelector('img')?.getAttribute('src')).toBe('/account/flag-us.svg');
  } finally {
    cleanup();
    if (previousTheme === null) window.localStorage.removeItem("folune-theme");
    else window.localStorage.setItem("folune-theme", previousTheme);
  }
});

function setup(onOpen: () => void = noop, onOpenSettings: () => void = noop, overrides: Partial<ComponentProps<typeof UserMenu>> = {}) {
  return render(<ToastProvider><UserMenu name="Lin" email="test@example.test" planName="免费版"
    remainingCredits={125} onOpen={onOpen} onOpenSettings={onOpenSettings}
    onOpenProfile={noop} onOpenSubscription={noop} onOpenUsage={noop} onOpenBilling={noop}
    onSignOut={async () => {}} theme="system" onThemeChange={noop} locale="zh-CN" onLocaleChange={noop} {...overrides} /></ToastProvider>);
}

test("鼠标与键盘每次打开只刷新一次，主题展开不重复刷新", async () => {
  let refreshes = 0;
  const view = setup(() => { refreshes++; });
  const trigger = view.getByRole("button", { name: "打开用户菜单" });
  fireEvent.click(trigger);
  expect(refreshes).toBe(1);
  fireEvent.click(view.getByRole("menuitem", { name: "界面主题：跟随系统" }));
  expect(refreshes).toBe(1);
  fireEvent.click(trigger);
  expect(refreshes).toBe(1);
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(refreshes).toBe(2);
  await waitFor(() => expect(document.activeElement === view.getByRole("menuitem", { name: "打开 Lin 的个人资料" })).toBe(true));
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement === view.getByRole("menuitem", { name: "退出登录" })).toBe(true);
});

test("Escape 先收起主题选择，第二次关闭菜单并归还触发器焦点", () => {
  const view = setup();
  const trigger = view.getByRole("button", { name: "打开用户菜单" });
  fireEvent.click(trigger);
  const themeTrigger = view.getByRole("menuitem", { name: "界面主题：跟随系统" });
  fireEvent.click(themeTrigger);
  const light = view.getByRole("menuitemradio", { name: "白天" });
  light.focus();
  fireEvent.keyDown(light, { key: "Escape" });
  expect(view.queryByRole("menuitemradio", { name: "白天" })).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement === themeTrigger).toBe(true);
  fireEvent.keyDown(themeTrigger, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement === trigger).toBe(true);
});

test("进入设置前焦点已回到原菜单触发器", () => {
  let focusAtAction: Element | null = null;
  const view = setup(noop, () => { focusAtAction = document.activeElement; });
  const trigger = view.getByRole("button", { name: "打开用户菜单" });
  fireEvent.click(trigger);
  fireEvent.click(view.getByRole("menuitem", { name: "设置" }));
  expect((focusAtAction as Element | null) === trigger).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});


test("悬停展开独立语言浮层，跨越间隔后仍可选择且离开后关闭", async () => {
  let chosen = "";
  const view = setup(noop, noop, { onLocaleChange: (locale) => { chosen = locale; } });
  fireEvent.click(view.getByRole("button", { name: "打开用户菜单" }));
  const languageTrigger = view.getByRole("menuitem", { name: "界面语言：简体中文" });
  fireEvent.pointerEnter(languageTrigger, { pointerType: "mouse" });
  const sub = view.getByRole("menu", { name: "界面语言" });
  expect(languageTrigger.closest('[role="menu"]')?.contains(sub)).toBe(false);
  fireEvent.pointerLeave(languageTrigger, { pointerType: "mouse" });
  fireEvent.pointerEnter(sub, { pointerType: "mouse" });
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(view.getByRole("menuitemradio", { name: "English" })).toBeTruthy();
  fireEvent.pointerDown(view.getByRole("menuitemradio", { name: "English" }));
  expect(view.getByRole("button", { name: "打开用户菜单" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(view.getByRole("menuitemradio", { name: "English" }));
  expect(chosen).toBe("en");
  expect(view.queryByRole("menu", { name: "用户菜单" })).toBeNull();
});

test("方向键只在当前子菜单游走，左键归还父项，触屏可展开主题", async () => {
  let chosen = "";
  const view = setup(noop, noop, { onThemeChange: (theme) => { chosen = theme; } });
  fireEvent.click(view.getByRole("button", { name: "打开用户菜单" }));
  const languageTrigger = view.getByRole("menuitem", { name: "界面语言：简体中文" });
  languageTrigger.focus();
  fireEvent.keyDown(languageTrigger, { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement === view.getByRole("menuitemradio", { name: "简体中文" })).toBe(true));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement === view.getByRole("menuitemradio", { name: "English" })).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement === view.getByRole("menuitemradio", { name: "简体中文" })).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
  expect(document.activeElement === languageTrigger).toBe(true);
  expect(view.queryByRole("menu", { name: "界面语言" })).toBeNull();
  const theme = view.getByRole("menuitem", { name: "界面主题：跟随系统" });
  fireEvent.pointerEnter(theme, { pointerType: "touch" });
  expect(view.queryByRole("menu", { name: "界面主题" })).toBeNull();
  fireEvent.click(theme);
  fireEvent.click(view.getByRole("menuitemradio", { name: "黑暗" }));
  expect(chosen).toBe("dark");
});

test("悬停移出关闭子菜单，Portal 外部点击关闭整个账户菜单", async () => {
  const view = setup();
  const trigger = view.getByRole("button", { name: "打开用户菜单" });
  fireEvent.click(trigger);
  const theme = view.getByRole("menuitem", { name: "界面主题：跟随系统" });
  fireEvent.pointerEnter(theme, { pointerType: "mouse" });
  fireEvent.pointerLeave(theme, { pointerType: "mouse" });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
  expect(view.queryByRole("menu", { name: "界面主题" }) === null).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(document.body);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("英文菜单与真实积分购买入口由 props 驱动，动作先关闭菜单", () => {
  let focusAtAction: Element | null = null;
  const view = setup(noop, noop, { locale: "en", onOpenCredits: () => { focusAtAction = document.activeElement; } });
  const trigger = view.getByRole("button", { name: "Open user menu" });
  fireEvent.click(trigger);
  expect(view.getByRole("menuitem", { name: "Language: English" })).toBeTruthy();
  expect(view.getByRole("menuitem", { name: "Appearance: System" })).toBeTruthy();
  fireEvent.click(view.getByRole("menuitem", { name: "Add credits" }));
  expect(focusAtAction === trigger).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test.each([
  { triggerName: "界面主题：跟随系统", menuName: "界面主题", lastName: "黑暗", height: 122, top: "260px" },
  { triggerName: "界面语言：简体中文", menuName: "界面语言", lastName: "English", height: 86, top: "296px" },
])("$menuName 向左避让，末行对齐触发行后其余项向上排列", ({ triggerName, menuName, lastName, height, top }) => {
  const previousWidth = window.innerWidth;
  const previousHeight = window.innerHeight;
  Object.defineProperties(window, { innerWidth: { value: 720, configurable: true }, innerHeight: { value: 500, configurable: true } });
  try {
    const view = setup();
    const trigger = view.getByRole("button", { name: "打开用户菜单" });
    trigger.getBoundingClientRect = () => ({ x: 600, y: 430, top: 430, left: 600, right: 704, bottom: 486, width: 104, height: 56, toJSON: () => ({}) });
    fireEvent.click(trigger);
    const menu = view.getByRole("menu", { name: "用户菜单" });
    Object.defineProperty(menu, "offsetHeight", { value: 350, configurable: true });
    menu.getBoundingClientRect = () => ({ x: 456, y: 72, top: 72, left: 456, right: 712, bottom: 422, width: 256, height: 350, toJSON: () => ({}) });
    const submenuTrigger = view.getByRole("menuitem", { name: triggerName });
    submenuTrigger.getBoundingClientRect = () => ({ x: 463, y: 340, top: 340, left: 463, right: 705, bottom: 374, width: 242, height: 34, toJSON: () => ({}) });
    fireEvent.resize(window);
    expect(menu.style.left).toBe("456px");
    expect(menu.style.top).toBe("72px");
    fireEvent.click(submenuTrigger);
    const submenu = view.getByRole("menu", { name: menuName });
    Object.defineProperty(submenu, "offsetHeight", { value: height, configurable: true });
    submenu.style.padding = "6px";
    submenu.style.border = "1px solid transparent";
    Object.defineProperty(view.getByRole("menuitemradio", { name: lastName }), "offsetHeight", { value: 36, configurable: true });
    fireEvent.resize(window);
    expect(submenu.dataset["side"]).toBe("left");
    expect(submenu.style.left).toBe("295px");
    expect(submenu.style.top).toBe(top);
    // 末行中心距浮层底边25px，两列的行中心应同为357px。
    expect(Number.parseFloat(submenu.style.top) + submenu.offsetHeight - 25).toBe(357);
    expect(submenu.style.transformOrigin).toBe("bottom right");
  } finally {
    Object.defineProperties(window, { innerWidth: { value: previousWidth, configurable: true }, innerHeight: { value: previousHeight, configurable: true } });
  }
});
