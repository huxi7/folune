/**
 * [INPUT]: 依赖 happy-dom、真实 useSubscriptionKeyboardBoundary 与 React 原生控件事件
 * [OUTPUT]: 验证订阅页阻止键盘事件抵达隐藏工作区 window 监听，保留默认行为、React 控件和同层 document 仲裁，停用/卸载恢复
 * [POS]: pages 的独立订阅快捷键隔离门禁，防止常驻画布继续响应删除、拓展和命令菜单
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/app/subscription" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  KeyboardEvent: browserWindow.KeyboardEvent,
});
const { cleanup, render } = await import("@testing-library/react/pure");
const { useSubscriptionKeyboardBoundary } = await import("./useSubscriptionKeyboardBoundary");
afterEach(cleanup);

function Harness({ active, onControl }: { active: boolean; onControl?: () => void }) {
  useSubscriptionKeyboardBoundary(active);
  return <input aria-label="订阅输入控件" onKeyDown={onControl} />;
}
function dispatch(target: EventTarget, key: string, type = "keydown") {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, metaKey: key === "e" || key === "k" });
  target.dispatchEvent(event);
  return event;
}

describe("独立订阅页的键盘边界", () => {
  test("body 与控件事件不抵达 window，但保留默认/React/document 行为", () => {
    let workspaceCalls = 0;
    let documentCalls = 0;
    let controlCalls = 0;
    const onWorkspace = () => { workspaceCalls += 1; };
    const onDocument = () => { documentCalls += 1; };
    window.addEventListener("keydown", onWorkspace);
    window.addEventListener("keyup", onWorkspace);
    const view = render(<Harness active onControl={() => { controlCalls += 1; }} />);
    // 在边界之后注册同 document 监听，证明不是 stopImmediatePropagation。
    document.addEventListener("keydown", onDocument);
    document.addEventListener("keyup", onDocument);
    try {
      for (const key of ["Delete", "Backspace", "Enter", "Escape", "e", "k", "Tab"]) {
        const event = dispatch(document.body, key);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(workspaceCalls).toBe(0);
      expect(documentCalls).toBe(7);
      const controlEvent = dispatch(view.getByRole("textbox"), "ArrowRight");
      expect(controlEvent.defaultPrevented).toBe(false);
      expect(controlCalls).toBe(1);
      const keyup = dispatch(view.getByRole("textbox"), "ArrowRight", "keyup");
      expect(keyup.defaultPrevented).toBe(false);
      expect(workspaceCalls).toBe(0);
      expect(documentCalls).toBe(9);
    } finally {
      window.removeEventListener("keydown", onWorkspace);
      window.removeEventListener("keyup", onWorkspace);
      document.removeEventListener("keydown", onDocument);
      document.removeEventListener("keyup", onDocument);
    }
  });

  test("active=false 与卸载都恢复工作区原生键盘事件", () => {
    let workspaceCalls = 0;
    const onWorkspace = () => { workspaceCalls += 1; };
    window.addEventListener("keydown", onWorkspace);
    const view = render(<Harness active />);
    try {
      dispatch(document.body, "Delete");
      expect(workspaceCalls).toBe(0);
      view.rerender(<Harness active={false} />);
      dispatch(document.body, "Delete");
      expect(workspaceCalls).toBe(1);
      view.rerender(<Harness active />);
      dispatch(document.body, "Delete");
      expect(workspaceCalls).toBe(1);
      view.unmount();
      dispatch(document.body, "Delete");
      expect(workspaceCalls).toBe(2);
    } finally {
      window.removeEventListener("keydown", onWorkspace);
    }
  });
});
