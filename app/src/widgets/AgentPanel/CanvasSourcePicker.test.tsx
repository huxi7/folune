/**
 * [INPUT]: 依赖真实来源选择组件、happy-dom 与 Testing Library
 * [OUTPUT]: 验证离屏来源选择、搜索保留、显式选择复制和浮层 Escape
 * [POS]: 精确问答范围交互门禁，不操作正式画布与网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
const browser = new Window();
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  HTMLElement: browser.HTMLElement,
  ResizeObserver: browser.ResizeObserver,
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
});
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { useState, useEffect } = await import("react");
const { CanvasSourcePicker } = await import("./CanvasSourcePicker");
import type { useCanvasChatSource } from "./useCanvasChatSource";
import type { CanvasComposerSource } from "./canvasChatSources";
const cid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let latest: CanvasComposerSource | null = null;
function Harness() {
  const [source, setSource] = useState<CanvasComposerSource | null>({
    id: cid,
    title: "画布",
    mode: "selected",
    memoIds: ["a"],
  });
  useEffect(() => {
    latest = source;
  }, [source]);
  const state = {
    source,
    setSource,
    detail: {
      nodes: [
        {
          id: "1",
          target_node_id: "a",
          target: { title: "第一篇", deleted_at: null },
        },
        {
          id: "2",
          target_node_id: "b",
          target: { title: "离屏笔记", deleted_at: null },
        },
      ],
    },
    selectedMemos: ["b"],
    error: null,
    remove: () => setSource(null),
    select: () => {},
    retry: () => {},
  } as unknown as ReturnType<typeof useCanvasChatSource>;
  return <CanvasSourcePicker state={state} disabled={false} />;
}
afterEach(cleanup);
test("来源清单精确勾选不依赖卡片位置，搜索和关窗不清空范围", () => {
  const view = render(<Harness />);
  fireEvent.click(view.getByRole("button", { name: /^画布/ }));
  fireEvent.click(view.getByRole("checkbox", { name: "离屏笔记" }));
  expect(latest?.memoIds).toEqual(["a", "b"]);
  fireEvent.change(view.getByRole("textbox", { name: "搜索画布笔记" }), {
    target: { value: "离屏" },
  });
  expect(view.queryByRole("checkbox", { name: "第一篇" })).toBeNull();
  expect(latest?.memoIds).toHaveLength(2);
  fireEvent.click(view.getByRole("radio", { name: "选中" }));
  expect(latest?.memoIds).toEqual(["b"]);
  expect(view.getByRole("radio", { name: "选中" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(view.getByRole("checkbox", { name: "离屏笔记" }));
  expect(view.getByRole("radio", { name: "指定" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(view.getByRole("radio", { name: "选中" }));
  fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
  expect(
    view.getByRole("button", { name: /^画布/ }).getAttribute("aria-expanded"),
  ).toBe("false");
  expect(latest?.memoIds).toEqual(["b"]);
});
