/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与生产助手宿主的演示比例/无过渡模式
 * [OUTPUT]: 验证演示胶囊全部几何按比例收缩，场景切换同次提交硬切，聊天输入实例与草稿保留
 * [POS]: widgets 的演示投影回归门禁；防止固定像素胶囊压过缩小后的界面，或重新引入助手开合动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
const browserWindow = new Window();
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document, HTMLElement: browserWindow.HTMLElement, Node: browserWindow.Node, SVGElement: browserWindow.SVGElement });
const { render, cleanup } = await import("@testing-library/react/pure");
const { WorkspaceAssistantLayer } = await import("./WorkspaceAssistantLayer");
afterEach(cleanup);

test("87.5%演示胶囊立即变成113.75×38.5，恢复全高也不经过中间帧", () => {
  const scene = (open: boolean) => <WorkspaceAssistantLayer open={open} size="expanded" panelWidth={315} uiScale={0.875} animateGeometry={false} resizable={false} onOpen={() => {}}><input aria-label="保留草稿" defaultValue="草稿" /></WorkspaceAssistantLayer>;
  const view = render(scene(true));
  const shell = view.container.querySelector<HTMLElement>(".workspace-assistant-layer")!;
  const input = view.getByRole("textbox") as HTMLInputElement;
  input.value = "正在写的草稿";
  expect(shell.style.width).toBe("315px");
  view.rerender(scene(false));
  expect(shell.dataset.animated).toBe("false");
  expect(shell.style.width).toBe("113.75px");
  expect(shell.style.height).toBe("38.5px");
  expect(shell.style.borderRadius).toBe("28px");
  expect(shell.style.getPropertyValue("--assistant-ui-scale")).toBe("0.875");
  expect(view.container.querySelector<HTMLElement>(".workspace-assistant-body")?.style.opacity).toBe("0");
  expect(view.getByRole("button", { name: "打开 AI 助手" }).style.opacity).toBe("1");
  view.rerender(scene(true));
  expect(shell.style.width).toBe("315px");
  expect(shell.style.borderRadius).toBe("17.5px");
  expect(view.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("正在写的草稿");
  expect(view.container.querySelectorAll(".assistant-window-resize")).toHaveLength(0);
});
