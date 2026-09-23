/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实加载层与真实入口 Store
 * [OUTPUT]: 验证加载期间交互隔离、完成后遮罩卸载及底层输入 DOM/草稿不重建
 * [POS]: router 的加载层生命周期门禁；CSS 扫光节奏由实际浏览器验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
});
const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
const { WorkspaceEntryTransition } = await import("./WorkspaceEntryTransition");
const { useWorkspaceEntryStore: store, WORKSPACE_ENTRY_STEPS } = await import("../../shared/store/workspaceEntryStore");
afterEach(() => { cleanup(); store.getState().dismiss(store.getState().id); });

test("遮罩跨阶段保留同一输入实例，100% 后释放交互且不留透明层", () => {
  const view = render(<WorkspaceEntryTransition><input defaultValue="未保存草稿" aria-label="草稿" /></WorkspaceEntryTransition>);
  const input = view.container.querySelector("input")!;
  let id = 0;
  act(() => { id = store.getState().begin(); });
  expect(input.closest("[inert]")).not.toBeNull();
  expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("8");
  act(() => { for (const step of WORKSPACE_ENTRY_STEPS) store.getState().finishStep(id, step.key); });
  expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  expect(view.container.querySelector("input")).toBe(input);
  fireEvent.animationEnd(view.container.querySelector(".workspace-entry-shimmer")!);
  expect(view.container.querySelector(".workspace-entry")).toBeNull();
  expect(input.closest("[inert]")).toBeNull();
  expect(input.value).toBe("未保存草稿");
});

test("加载失败直接释放，不播放完成动画", () => {
  const id = store.getState().begin();
  const view = render(<WorkspaceEntryTransition><p>错误反馈</p></WorkspaceEntryTransition>);
  act(() => store.getState().dismiss(id));
  expect(view.container.querySelector(".workspace-entry")).toBeNull();
  expect(view.container.querySelector("[inert]")).toBeNull();
});
