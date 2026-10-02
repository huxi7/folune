/**
 * [INPUT]: 依赖 happy-dom、Testing Library、ReactFlowProvider 与真实 CanvasControls/帮助浮层及 LocaleProvider
 * [OUTPUT]: 验证工具栏帮助的 Portal 开合、内容内点击、外部点击、Escape 焦点归还、真实键位说明与中英切换不重挂浮层
 * [POS]: KnowledgeCanvas 命令条的交互边界测试，不借助整张画布或后端状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { ReactFlowProvider } from "@xyflow/react";

const browserWindow = new Window({ url: "http://localhost:10000/app/canvas/test-canvas" });
Object.assign(globalThis, {
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  navigator: browserWindow.navigator,
  PointerEvent: browserWindow.PointerEvent,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  window: browserWindow,
});

const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { CanvasControls } = await import("./CanvasControls");
const { useLocale } = await import("../../shared/locale");
const { LocaleProvider } = await import("../../shared/locale/LocaleProvider");
afterEach(() => { cleanup(); window.localStorage.clear(); });

test("帮助浮层留在工具栏上方，内外点击与 Escape 按层级收起", async () => {
  const view = render(
    <ReactFlowProvider>
      <CanvasControls
        onAdd={() => undefined}
        onFit={() => undefined}
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
      />
    </ReactFlowProvider>,
  );
  const trigger = view.getByRole("button", { name: "操作说明" });
  fireEvent.click(trigger);
  const panel = await waitFor(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby]');
    expect(dialog).not.toBeNull();
    return dialog!;
  });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(panel.textContent).toContain("搜索结果中");
  expect(panel.textContent).toContain("移除卡片不会删除原笔记");

  fireEvent.pointerDown(panel);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(document.body);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(trigger);
  await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("true"));
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});


test("运行时切换英语即时更新工具栏与已打开帮助，不重挂浮层", async () => {
  function LanguageSwitch() {
    const { setLocale } = useLocale();
    return <button onClick={() => setLocale("en")} type="button">English</button>;
  }
  const view = render(<LocaleProvider><LanguageSwitch /><ReactFlowProvider><CanvasControls
    onAdd={() => undefined} onFit={() => undefined} onZoomIn={() => undefined} onZoomOut={() => undefined}
  /></ReactFlowProvider></LocaleProvider>);
  fireEvent.click(view.getByRole("button", { name: "操作说明" }));
  const panel = await waitFor(() => view.getByRole("dialog", { name: "画布操作" }));
  fireEvent.click(view.getByRole("button", { name: "English" }));
  expect(view.getByRole("dialog", { name: "Canvas guide" }) === panel).toBe(true);
  expect(view.getByRole("button", { name: "Add note" }).getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
  expect(panel.textContent).toContain("Removing a card keeps the original note.");
  expect(panel.textContent).toContain("In search results");
  fireEvent.click(view.getByRole("button", { name: "Close canvas guide" }));
  expect(view.getByRole("button", { name: "Canvas guide" }).getAttribute("aria-expanded")).toBe("false");
});
