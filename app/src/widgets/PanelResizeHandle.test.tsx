/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与生产 PanelResizeHandle
 * [OUTPUT]: 验证双侧方向、尺寸边界、捕获丢失清理和非主指针隔离
 * [POS]: widgets 的面板拖拽生命周期回归，防止退出后全局光标或禁止选文残留
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
const browserWindow = new Window();
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document, HTMLElement: browserWindow.HTMLElement, Node: browserWindow.Node, PointerEvent: browserWindow.PointerEvent });
const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
const { PanelResizeHandle } = await import("./PanelResizeHandle");
afterEach(cleanup);

function setup(direction: 1 | -1 = 1) {
  const onResize = mock((_size: number) => {});
  const onReset = mock(() => {});
  const view = render(<PanelResizeHandle ariaLabel="宽度" direction={direction} side={direction === 1 ? "right" : "left"} size={264} min={208} max={360} onResize={onResize} onReset={onReset} />);
  const handle = view.getByRole("separator");
  let captured = false;
  handle.setPointerCapture = () => { captured = true; };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = () => { captured = false; };
  const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 200 };
  return { ...view, handle, onResize, onReset, pointer };
}

test("双侧拖拽方向、边界与松手清理", () => {
  for (const direction of [1, -1] as const) {
    const v = setup(direction);
    fireEvent.pointerDown(v.handle, v.pointer);
    expect(document.documentElement.dataset.panelResizing).toBe("true");
    fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 120 });
    expect(v.onResize).toHaveBeenLastCalledWith(264 + 20 * direction);
    fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 1000 });
    expect(v.onResize).toHaveBeenLastCalledWith(direction === 1 ? 360 : 208);
    fireEvent.pointerUp(v.handle, v.pointer);
    expect(document.documentElement.dataset.panelResizing).toBeUndefined();
    expect(v.handle.dataset.dragging).toBeUndefined();
    v.unmount();
  }
});

test("右键与第二指针不接管拖拽；捕获丢失停止更新", () => {
  const v = setup();
  fireEvent.pointerDown(v.handle, { ...v.pointer, button: 2 });
  expect(document.documentElement.dataset.panelResizing).toBeUndefined();
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerMove(v.handle, { ...v.pointer, pointerId: 2, clientX: 200 });
  fireEvent.pointerUp(v.handle, { ...v.pointer, pointerId: 2 });
  expect(v.onResize).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.panelResizing).toBe("true");
  fireEvent.lostPointerCapture(v.handle, v.pointer);
  fireEvent.pointerMove(v.handle, { ...v.pointer, clientX: 200 });
  expect(v.onResize).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.panelResizing).toBeUndefined();
});

test("取消和卸载清理；键盘与双击复位保持可用", () => {
  const v = setup(-1);
  fireEvent.keyDown(v.handle, { key: "ArrowLeft" });
  expect(v.onResize).toHaveBeenLastCalledWith(276);
  fireEvent.doubleClick(v.handle);
  expect(v.onReset).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(v.handle, v.pointer);
  fireEvent.pointerCancel(v.handle, v.pointer);
  expect(document.documentElement.dataset.panelResizing).toBeUndefined();
  fireEvent.pointerDown(v.handle, v.pointer);
  v.unmount();
  expect(document.documentElement.dataset.panelResizing).toBeUndefined();
});
