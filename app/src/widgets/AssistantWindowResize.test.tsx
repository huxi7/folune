/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与生产 AssistantWindowResize
 * [OUTPUT]: 验证八个方向入口、边角跟手但只松手提交、取消/捕获丢失清理与键盘调整
 * [POS]: widgets 的窗口手势生命周期门禁；尺寸数学由 assistantGeometry 测试承担
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
const browserWindow = new Window();
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document, HTMLElement: browserWindow.HTMLElement, Node: browserWindow.Node, PointerEvent: browserWindow.PointerEvent });
const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
const { AssistantWindowResize } = await import("./AssistantWindowResize");
afterEach(cleanup);
const initial = { left: 600, top: 200, width: 360, height: 500 };

function setup() {
  const onChange = mock(() => {});
  const onCommit = mock(() => {});
  const onStart = mock(() => {});
  const view = render(<AssistantWindowResize bounds={{ left: 16, top: 16, right: 1424, bottom: 884 }} readRect={() => initial} onChange={onChange} onCommit={onCommit} onStart={onStart} />);
  const handle = view.getByRole("button", { name: "调整 AI 窗口左上角" });
  let captured = false;
  handle.setPointerCapture = () => { captured = true; };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = () => { captured = false; };
  const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 600, clientY: 200 };
  return { ...view, handle, pointer, onChange, onCommit, onStart };
}

test("四边四角入口，连续边角调整只在松手提交一次偏好", () => {
  const v = setup();
  expect(v.getAllByRole("button")).toHaveLength(8);
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 480, clientY: 120 });
  expect(v.onChange).toHaveBeenLastCalledWith({ left: 480, top: 120, width: 480, height: 580 });
  fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 440, clientY: 80 });
  expect(v.onCommit).not.toHaveBeenCalled();
  fireEvent.pointerUp(v.handle, v.pointer);
  expect(v.onCommit).toHaveBeenCalledTimes(1);
  expect(v.onCommit).toHaveBeenLastCalledWith({ left: 440, top: 80, width: 520, height: 620 });
  expect(document.documentElement.dataset.assistantResizing).toBeUndefined();
});

test("第二指针隔离，Escape与取消恢复起点，卸载清理全局光标", () => {
  const v = setup();
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerMove(v.handle, { ...v.pointer, pointerId: 2, clientX: 0 });
  expect(v.onChange).toHaveBeenCalledTimes(1);
  fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 400 });
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(v.onChange).toHaveBeenLastCalledWith(initial);
  expect(v.onCommit).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.assistantResizing).toBeUndefined();
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerCancel(v.handle, v.pointer);
  expect(v.onChange).toHaveBeenLastCalledWith(initial);
  fireEvent.pointerDown(v.handle, v.pointer);
  v.unmount();
  expect(document.documentElement.dataset.assistantResizing).toBeUndefined();
});

test("丢失捕获只结算一次，方向键可单轴调整边角", () => {
  const v = setup();
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 500 });
  fireEvent.lostPointerCapture(v.handle, v.pointer);
  fireEvent.pointerUp(v.handle, v.pointer);
  expect(v.onCommit).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(v.handle, { key: "ArrowUp", shiftKey: true });
  expect(v.onCommit).toHaveBeenLastCalledWith({ left: 600, top: 168, width: 360, height: 532 });
});
