/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与真实 Dialog/Select/PersistentView/PresenceSurface
 * [OUTPUT]: 验证退出即隔离交互、快速反向开关、分层 Escape 与表单实例保留
 * [POS]: Design System 动效行为门禁；不以测试环境的动画时钟冒充浏览器逐帧验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { useState } from "react";

const browserWindow = new Window({ url: "http://localhost:10000/motion-lab" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  Element: browserWindow.Element,
  Node: browserWindow.Node,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
const { render, cleanup, fireEvent, waitFor } = await import("@testing-library/react/pure");
const { Dialog } = await import("./Dialog");
const { Select } = await import("./Select");
const { PresenceSurface } = await import("./PresenceSurface");
const { PersistentView } = await import("./PersistentView");
afterEach(cleanup);

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} type="button">打开</button>
    <Dialog open={open} onOpenChange={setOpen} title="外层">
      <input aria-label="初始焦点" data-dialog-autofocus />
      <Select ariaLabel="模态内菜单" options={[{ label: "一", value: "one" }, { label: "二", value: "two" }]} />
      <button onClick={() => setInner(true)} type="button">第二层</button>
      <Dialog open={inner} onOpenChange={setInner} title="内层"><input aria-label="内层输入" data-dialog-autofocus /></Dialog>
    </Dialog>
  </>;
}

describe("Motion 的行为边界", () => {
  test("菜单快速反向开关复用同一表面，退出立即 inert", () => {
    const view = render(<PresenceSurface open><button type="button">选项</button></PresenceSurface>);
    const surface = view.container.querySelector('[data-motion-surface]');
    view.rerender(<PresenceSurface open={false}><button type="button">选项</button></PresenceSurface>);
    expect(surface?.hasAttribute("inert")).toBe(true);
    expect(view.queryByRole("button")).toBeNull();
    view.rerender(<PresenceSurface open><button type="button">选项</button></PresenceSurface>);
    expect(view.container.querySelector('[data-motion-surface]') === surface).toBe(true);
    expect(surface?.hasAttribute("inert")).toBe(false);
    expect(view.getByRole("button").textContent).toBe("选项");
  });
  test("视图切换保留 input 实例、草稿及光标，不让旧视图参与交互", () => {
    const body = <input aria-label="草稿" defaultValue="保留内容" />;
    const view = render(<PersistentView active>{body}</PersistentView>);
    const input = view.getByRole("textbox") as HTMLInputElement;
    input.setSelectionRange(2, 4);
    view.rerender(<PersistentView active={false}>{body}</PersistentView>);
    expect(view.queryByRole("textbox")).toBeNull();
    expect(input.closest("[inert]") !== null).toBe(true);
    view.rerender(<PersistentView active>{body}</PersistentView>);
    expect(view.getByRole("textbox") === input).toBe(true);
    expect(input.value).toBe("保留内容");
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 4]);
  });
  test("菜单先关闭，下一次 Escape 才关闭 Dialog 并归还焦点", async () => {
    const view = render(<DialogHarness />);
    const trigger = view.getByRole("button", { name: "打开" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement === view.getByLabelText("初始焦点")).toBe(true));
    const select = view.getByRole("combobox");
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
    expect(view.queryByRole("dialog", { name: "外层" }) !== null).toBe(true);
    fireEvent.keyDown(select, { key: "Escape" });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(document.activeElement === trigger).toBe(true);
  });
  test("嵌套 Dialog 一次只关闭一层，父层存在时滚动仍锁定", async () => {
    const view = render(<DialogHarness />);
    fireEvent.click(view.getByRole("button", { name: "打开" }));
    const nestedTrigger = view.getByRole("button", { name: "第二层" });
    nestedTrigger.focus();
    fireEvent.click(nestedTrigger);
    const input = view.getByLabelText("内层输入");
    await waitFor(() => expect(document.activeElement === input).toBe(true));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(view.queryByRole("dialog", { name: "内层" })).toBeNull();
    expect(view.queryByRole("dialog", { name: "外层" }) !== null).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement === nestedTrigger).toBe(true);
  });
});
