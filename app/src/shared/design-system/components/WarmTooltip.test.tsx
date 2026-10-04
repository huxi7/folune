/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与真实 WarmTooltip/Button/SidebarButton/Dialog 与 useDismissable
 * [OUTPUT]: 验证提示去重、原位 DOM/ref、点击/触屏、延迟取消、禁用、跨区域切换、键盘焦点与菜单/模态分层 Escape
 * [POS]: 全站统一提示的交互门禁，确保提示不改变业务命令和焦点生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createRef, useRef, useState } from "react";

const browser = new Window({ url: "http://localhost:10000" });
Object.assign(globalThis, {
  window: browser, document: browser.document, HTMLElement: browser.HTMLElement,
  Element: browser.Element, SVGElement: browser.SVGElement, Node: browser.Node,
  getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
});
const { render, cleanup, fireEvent, waitFor, act } = await import("@testing-library/react/pure");
const { default: WarmTooltip, WarmTooltipGroup } = await import("./WarmTooltip");
const { useDismissable } = await import("../useDismissable");
const { SidebarButton } = await import("./SidebarButton");
const { Button } = await import("./Button");
const { Dialog } = await import("./Dialog");
afterEach(cleanup);
const hover = (node: Element) => fireEvent.pointerEnter(node, { pointerType: "mouse", buttons: 0 });

test("原位按钮保留父子几何、ref 和点击，title 不再产生第二套提示", async () => {
  const ref = createRef<HTMLButtonElement>();
  let clicked = 0;
  let entered = 0;
  const view = render(<WarmTooltipGroup delay={0}>
    <div data-testid="row"><Button ref={ref} title="关闭" aria-label="关闭窗口" size="square" onPointerEnter={() => entered++} onClick={() => clicked++} /></div>
  </WarmTooltipGroup>);
  const button = view.getByRole("button");
  expect(button.parentElement).toBe(view.getByTestId("row"));
  expect(ref.current === button).toBe(true);
  expect(button.hasAttribute("title")).toBe(false);
  hover(button);
  await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("关闭"));
  expect(entered).toBe(1);
  expect(button.getAttribute("aria-describedby")).toBe(view.getByRole("tooltip").id);
  fireEvent.click(button);
  expect(clicked).toBe(1);
  expect(view.queryByRole("tooltip")).toBeNull();
  view.unmount();
  expect(ref.current).toBeNull();
});

test("已有工具栏包装只保留一层提示，不覆盖业务 ref 和既有描述", async () => {
  const ref = createRef<HTMLButtonElement>();
  const view = render(<WarmTooltipGroup delay={0}><WarmTooltip content="工具栏说明">
    <Button ref={ref} size="square" aria-label="操作" aria-describedby="existing" />
  </WarmTooltip></WarmTooltipGroup>);
  const button = view.getByRole("button");
  expect(ref.current === button).toBe(true);
  expect(view.container.querySelectorAll(".warm-tooltip__trigger")).toHaveLength(1);
  hover(button.parentElement!);
  await waitFor(() => expect(view.getAllByRole("tooltip")).toHaveLength(1));
  expect(button.getAttribute("aria-describedby")).toBe(`existing ${view.getByRole("tooltip").id}`);
  fireEvent.keyDown(button, { key: "Escape" });
  expect(button.getAttribute("aria-describedby")).toBe("existing");
});

test("同组切换只有一个浮层，禁用按钮/展开菜单/纯文字按钮不额外提示", async () => {
  const view = render(<WarmTooltipGroup delay={0}>
    <Button size="square" aria-label="新对话" /><Button size="square" aria-label="收起" />
    <Button size="square" aria-label="禁用" disabled /><Button size="square" aria-label="菜单" aria-haspopup="menu" aria-expanded />
    <Button>确认</Button>
  </WarmTooltipGroup>);
  hover(view.getByRole("button", { name: "新对话" }));
  await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("新对话"));
  hover(view.getByRole("button", { name: "收起" }));
  expect(view.getAllByRole("tooltip")).toHaveLength(1);
  await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("收起"));
  fireEvent.keyDown(document, { key: "Escape" });
  hover(view.getByRole("button", { name: "禁用" }));
  hover(view.getByRole("button", { name: "菜单" }));
  expect(view.queryByRole("tooltip")).toBeNull();
  expect(view.getByRole("button", { name: "确认" }).hasAttribute("data-warm-tooltip-trigger")).toBe(false);
});

test("离开或卸载取消待显示提示，触屏短触保留点击，长按不误触业务", async () => {
  let clicked = 0;
  const view = render(<WarmTooltip content="连接" asChild delay={20} longPress={10}>
    <button onClick={() => clicked++}>连接</button>
  </WarmTooltip>);
  const button = view.getByRole("button");
  hover(button);
  fireEvent.pointerLeave(button, { pointerType: "mouse" });
  await act(() => new Promise(resolve => setTimeout(resolve, 30)));
  expect(view.queryByRole("tooltip")).toBeNull();
  fireEvent.pointerDown(button, { pointerType: "touch", pointerId: 1 });
  fireEvent.pointerUp(button, { pointerType: "touch", pointerId: 1 });
  fireEvent.click(button);
  expect(clicked).toBe(1);
  fireEvent.pointerDown(button, { pointerType: "touch", pointerId: 2 });
  await waitFor(() => expect(view.getByRole("tooltip")).toBeTruthy());
  fireEvent.pointerUp(button, { pointerType: "touch", pointerId: 2 });
  fireEvent.click(button);
  expect(clicked).toBe(1);
  view.unmount();
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

test("React 19 回调 ref 的清理只在真实卸载时执行", async () => {
  let attached = 0;
  let detached = 0;
  const ref = (node: HTMLElement | null) => { if (node) attached++; return () => { detached++; }; };
  const view = render(<WarmTooltip asChild delay={0} content="阅读"><button ref={ref}>阅读</button></WarmTooltip>);
  hover(view.getByRole("button"));
  await waitFor(() => expect(view.getByRole("tooltip")).toBeTruthy());
  expect(attached).toBe(1);
  expect(detached).toBe(0);
  view.unmount();
  expect(detached).toBe(1);
});

test("页面恢复可见不误关当前提示，真正隐藏时才关闭", async () => {
  const view = render(<WarmTooltip asChild delay={0} content="新对话"><button>新对话</button></WarmTooltip>);
  hover(view.getByRole("button"));
  await waitFor(() => expect(view.getByRole("tooltip")).toBeTruthy());
  const descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  try {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    fireEvent(document, new browser.Event("visibilitychange") as unknown as Event);
    expect(view.getByRole("tooltip")).toBeTruthy();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new browser.Event("visibilitychange") as unknown as Event);
    expect(view.queryByRole("tooltip")).toBeNull();
  } finally {
    if (descriptor) Object.defineProperty(document, "hidden", descriptor);
    else Reflect.deleteProperty(document, "hidden");
  }
});

test("延迟期间页面隐藏后不显示排队提示", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  const view = render(<WarmTooltip asChild delay={20} content="关闭"><button>关闭</button></WarmTooltip>);
  try {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    hover(view.getByRole("button"));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new browser.Event("visibilitychange") as unknown as Event);
    await act(() => new Promise(resolve => setTimeout(resolve, 35)));
    expect(view.queryByRole("tooltip")).toBeNull();
  } finally {
    if (descriptor) Object.defineProperty(document, "hidden", descriptor);
    else Reflect.deleteProperty(document, "hidden");
  }
});

function ModalExample() {
  const [open, setOpen] = useState(true);
  return <WarmTooltipGroup delay={0}><Dialog title="设置" open={open} onOpenChange={setOpen}>
    <Button size="square" aria-label="刷新" />
  </Dialog></WarmTooltipGroup>;
}

test("弹窗内第一次 Escape 只收提示，第二次才关弹窗", async () => {
  const view = render(<ModalExample />);
  await waitFor(() => expect(document.activeElement?.classList.contains("ds-dialog-panel")).toBe(true));
  const button = view.getByRole("button", { name: "刷新" });
  hover(button);
  await waitFor(() => expect(view.getByRole("tooltip")).toBeTruthy());
  fireEvent.keyDown(button, { key: "Escape" });
  expect(view.queryByRole("tooltip")).toBeNull();
  expect(view.getByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(button, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
});


test("跨区域快速切换复用浮层，上一按钮离场计时不会关闭新提示", async () => {
  const view = render(<WarmTooltipGroup delay={0}>
    <header><Button size="square" aria-label="文件库" /></header>
    <aside><Button size="square" aria-label="新对话" /></aside>
  </WarmTooltipGroup>);
  const first = view.getByRole("button", { name: "文件库" });
  hover(first);
  await waitFor(() => expect(view.getByRole("tooltip")).toBeTruthy());
  const layer = view.getByRole("tooltip");
  fireEvent.pointerLeave(first, { pointerType: "mouse" });
  hover(view.getByRole("button", { name: "新对话" }));
  expect(view.getByRole("tooltip")).toBe(layer);
  await act(() => new Promise(resolve => setTimeout(resolve, 220)));
  expect(view.getByRole("tooltip").textContent).toBe("新对话");
  expect(first.hasAttribute("aria-describedby")).toBe(false);
});

test("侧栏图标的外层提示去重并保留ref，显式关闭提示不回退到title", async () => {
  const ref = createRef<HTMLButtonElement>();
  const view = render(<WarmTooltipGroup delay={0}>
    <WarmTooltip asChild content="打开文件库"><SidebarButton label="文件库" size="icon" aria-label="文件库" ref={ref} /></WarmTooltip>
    <Button size="square" aria-label="不提示" title="旧提示" tooltip={false} />
  </WarmTooltipGroup>);
  const sidebar = view.getByRole("button", { name: "文件库" });
  expect(ref.current === sidebar).toBe(true);
  hover(sidebar);
  await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("打开文件库"));
  fireEvent.keyDown(sidebar, { key: "Escape" });
  hover(view.getByRole("button", { name: "不提示" }));
  expect(view.queryByRole("tooltip")).toBeNull();
  expect(view.getByRole("button", { name: "不提示" }).hasAttribute("title")).toBe(false);
  view.unmount();
  expect(ref.current).toBeNull();
});

function MenuExample() {
  const [open, setOpen] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);
  useDismissable({ open, shellRef, onDismiss: () => setOpen(false) });
  return <WarmTooltipGroup delay={0}><div ref={shellRef}>
    {open ? <Button size="square" aria-label="菜单操作" /> : null}
  </div></WarmTooltipGroup>;
}

test("键盘焦点直接显示提示；菜单内Escape先收提示，再关菜单", async () => {
  const view = render(<MenuExample />);
  const button = view.getByRole("button");
  await act(() => button.focus());
  await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("菜单操作"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("tooltip")).toBeNull();
  expect(view.getByRole("button")).toBe(button);
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("button")).toBeNull();
});
