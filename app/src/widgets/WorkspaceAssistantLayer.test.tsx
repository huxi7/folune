/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与生产助手宿主的演示比例/无过渡模式
 * [OUTPUT]: 验证正式窗口大小切换/胶囊重开保留同一输入实例与草稿；验证演示胶囊全部几何按比例收缩，场景切换同次提交硬切，聊天输入实例与草稿保留，面板模式不被生产最小宽度撑大
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
  const scene = (open: boolean) => <WorkspaceAssistantLayer open={open} size="expanded" panelWidth={260} widthMode="panel" uiScale={0.875} animateGeometry={false} resizable={false} onOpen={() => {}}><input aria-label="保留草稿" defaultValue="草稿" /></WorkspaceAssistantLayer>;
  const view = render(scene(true));
  const shell = view.container.querySelector<HTMLElement>(".workspace-assistant-layer")!;
  const input = view.getByRole("textbox") as HTMLInputElement;
  input.value = "正在写的草稿";
  expect(shell.style.width).toBe("260px");
  view.rerender(scene(false));
  expect(shell.dataset.animated).toBe("false");
  expect(shell.style.width).toBe("113.75px");
  expect(shell.style.height).toBe("38.5px");
  expect(shell.style.borderRadius).toBe("28px");
  expect(shell.style.getPropertyValue("--assistant-ui-scale")).toBe("0.875");
  expect(view.container.querySelector<HTMLElement>(".workspace-assistant-body")?.style.opacity).toBe("0");
  expect(view.getByRole("button", { name: "打开 AI 助手" }).style.opacity).toBe("1");
  view.rerender(scene(true));
  expect(shell.style.width).toBe("260px");
  expect(shell.style.borderRadius).toBe("17.5px");
  expect(view.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("正在写的草稿");
  expect(view.container.querySelectorAll(".assistant-window-resize")).toHaveLength(0);
});


test("自定义宽高切换标准布局和胶囊重开时保留输入实例与草稿", async () => {
  const { useWorkspaceChromeStore } = await import("../shared/store/workspaceChromeStore");
  Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
  const state = () => useWorkspaceChromeStore.getState();
  state().hydrate("assistant-test");
  state().openAssistant();
  const scene = () => <WorkspaceAssistantLayer open={state().assistantOpen} size={state().assistantSize} frame={state().assistantFrame} panelWidth={360} animateGeometry={false} resizable={false} onOpen={state().openAssistant}><textarea aria-label="临时输入" defaultValue="草稿" /></WorkspaceAssistantLayer>;
  const view = render(scene());
  const input = view.getByRole("textbox") as HTMLTextAreaElement;
  input.value = "尚未发送的内容";
  const shell = view.container.querySelector<HTMLElement>(".workspace-assistant-layer")!;
  state().setAssistantFrame({ width: 600, height: 650, right: 40, bottom: 32 });
  view.rerender(scene());
  expect(shell.style.width).toBe("600px");
  expect(shell.style.height).toBe("650px");
  state().setAssistantSize("compact");
  view.rerender(scene());
  expect(shell.style.width).toBe("360px");
  expect(shell.style.height).toBe("520px");
  state().closeAssistant();
  view.rerender(scene());
  expect(shell.style.height).toBe("44px");
  state().openAssistant();
  view.rerender(scene());
  expect(shell.style.width).toBe("360px");
  expect(shell.style.height).toBe("868px");
  expect(view.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("尚未发送的内容");
});
