/**
 * [INPUT]: happy-dom、真实 React Flow 与 CanvasManipulationFeedback，节点仅提供纸卡/动作槽位
 * [OUTPUT]: 验证按下即反馈、松手/取消清除、多选组一致、命令/平移不触发且选择不被改写
 * [POS]: 按住视觉的 DOM 生命周期门禁；独立于 Canvas 保存链路，与 KnowledgeCanvas.interaction.test.tsx 互补
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { ReactFlow, type NodeProps } from "@xyflow/react";

const browserWindow = new Window({ url: "http://localhost:10010" });
const globals = {
  window: browserWindow, document: browserWindow.document,
  navigator: browserWindow.navigator, Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement, SVGElement: browserWindow.SVGElement,
  MutationObserver: browserWindow.MutationObserver, ResizeObserver: browserWindow.ResizeObserver,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
};
Object.assign(globalThis, globals);
const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { CanvasManipulationFeedback } = await import("./CanvasManipulationFeedback");
afterEach(cleanup);

function Card({ id }: NodeProps) {
  return <article className="canvas-card" data-canvas-card-id={id}>
    <p>纸面 {id}</p>
    <button className="nodrag" type="button">阅读 {id}</button>
    <div className="react-flow__handle">连接 {id}</div>
  </article>;
}
const nodeTypes = { card: Card };
async function setup(selected: string[] = []) {
  Object.assign(globalThis, globals);
  render(<ReactFlow
    defaultNodes={["a", "b", "c"].map((id, i) => ({
      id, type: "card", data: {}, position: { x: i * 320, y: 0 },
      width: 280, height: 360, selected: selected.includes(id),
    }))}
    nodeTypes={nodeTypes}
    panOnDrag={[1, 2]}
    selectionOnDrag
  ><CanvasManipulationFeedback /></ReactFlow>);
  return await waitFor(() => {
    const card = document.querySelector<HTMLElement>('[data-canvas-card-id="a"]');
    expect(card).not.toBeNull();
    return card!;
  });
}
const count = () => document.querySelectorAll(".canvas-manipulation-border").length;
const down = (target: Element, extra = {}) => fireEvent.pointerDown(target, {
  button: 0, pointerId: 7, isPrimary: true, ...extra,
});

test("静止选中不动，按下即出现，移出卡片后松手立即收掉且选择保留", async () => {
  const card = await setup(["a"]);
  expect(count()).toBe(0);
  down(card);
  expect(count()).toBe(1);
  fireEvent.pointerUp(window, { pointerId: 99 });
  expect(count()).toBe(1);
  fireEvent.pointerUp(window, { pointerId: 7 });
  expect(count()).toBe(0);
  expect(card.closest(".react-flow__node")?.classList.contains("selected")).toBe(true);
});

test("选中组中的卡片共享按住反馈；未选卡片单独按下不牵动旧组", async () => {
  const card = await setup(["a", "b"]);
  expect(count()).toBe(0);
  down(card);
  expect(count()).toBe(2);
  fireEvent.pointerUp(window, { pointerId: 7 });
  const third = document.querySelector('[data-canvas-card-id="c"]')!;
  down(third);
  expect(count()).toBe(1);
  expect(third.querySelector(".canvas-manipulation-border")).not.toBeNull();
  fireEvent.pointerUp(window, { pointerId: 7 });
  expect(count()).toBe(0);
});

test("按钮、连接抓手、框选空白、修饰键和 Space 平移不触发边缘", async () => {
  const card = await setup(["a"]);
  for (const target of [card.querySelector("button")!, card.querySelector(".react-flow__handle")!, document.querySelector(".react-flow__pane")!]) {
    down(target);
    expect(count()).toBe(0);
  }
  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }, { button: 2 }]) {
    down(card, modifier);
    expect(count()).toBe(0);
  }
  fireEvent.keyDown(document, { code: "Space", key: " " });
  down(card);
  expect(count()).toBe(0);
  fireEvent.keyUp(document, { code: "Space", key: " " });
  down(card);
  expect(count()).toBe(1);
  fireEvent.pointerUp(window, { pointerId: 7 });
});

test("取消、失焦、捕获丢失和 Escape 都释放效果；快速再次按下不会残留", async () => {
  const card = await setup();
  const stops = [
    () => fireEvent.pointerCancel(window, { pointerId: 7 }),
    () => fireEvent.blur(window),
    () => fireEvent.lostPointerCapture(card, { pointerId: 7 }),
    () => fireEvent.keyDown(document, { key: "Escape" }),
  ];
  for (const stop of stops) {
    down(card);
    expect(count()).toBe(1);
    stop();
    expect(count()).toBe(0);
  }
});
