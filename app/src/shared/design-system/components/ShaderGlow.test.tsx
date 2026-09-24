/**
 * [INPUT]: 依赖 Bun、happy-dom、StrictMode 与 ShaderGlow，以可控 WebGL/Observer/RAF 驱动生命周期
 * [OUTPUT]: 验证首帧、静态尺寸变化、可见性组合、恢复与清理；不替代真实 GPU 或视觉验收
 * [POS]: 强调 CTA 流光的生命周期回归门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, test, mock, spyOn } from "bun:test";
import { Window } from "happy-dom";
import { StrictMode } from "react";
const win = new Window({ url: "http://localhost:10000" });
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0, draws = 0, time = 0;
let reduced = false, lost = false, available = true, linked = true;
const deleted = mock(() => {});
const gl = new Proxy({
  isContextLost: () => lost,
  getShaderParameter: () => true,
  getProgramParameter: () => linked,
  getUniformLocation: (_program: unknown, name: string) => name,
  uniform1f: (name: string, value: number) => { if (name === "uTime") time = value; },
  drawArrays: () => { draws++; },
}, { get(target, key) {
  if (key in target) return Reflect.get(target, key);
  if (String(key).startsWith("create")) return () => ({});
  if (String(key).startsWith("delete")) return deleted;
  return /^[A-Z_0-9]+$/.test(String(key)) ? 1 : () => {};
} });
class IntersectionMock {
  static current: IntersectionMock;
  target?: Element;
  constructor(private callback: IntersectionObserverCallback) { IntersectionMock.current = this; }
  observe(target: Element) { this.target = target; }
  disconnect() {}
  emit(visible: boolean) { this.callback([{ target: this.target, isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
class ResizeMock {
  static current: ResizeMock;
  target?: Element;
  constructor(private callback: ResizeObserverCallback) { ResizeMock.current = this; }
  observe(target: Element) { this.target = target; }
  disconnect() {}
  emit(width: number, height: number) { this.callback([{ target: this.target, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
}
Object.assign(globalThis, {
  window: win, document: win.document, HTMLElement: win.HTMLElement, Element: win.Element,
  MutationObserver: win.MutationObserver, ResizeObserver: ResizeMock, IntersectionObserver: IntersectionMock,
  getComputedStyle: win.getComputedStyle.bind(win),
  requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame: (id: number) => { frames.delete(id); },
});
const { render, cleanup, act } = await import("@testing-library/react/pure");
const { ShaderGlow } = await import("./ShaderGlow");
const { GlowButton } = await import("./GlowButton");
const context = spyOn(win.HTMLCanvasElement.prototype, "getContext");
const media = spyOn(win, "matchMedia");
beforeEach(() => {
  reduced = false; lost = false; available = true; linked = true; draws = 0; time = 0;
  frames.clear(); deleted.mockClear();
  context.mockImplementation(() => available ? gl as never : null);
  media.mockImplementation(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) as never);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(win.HTMLCanvasElement.prototype, "clientWidth", { configurable: true, get: () => 320 });
  Object.defineProperty(win.HTMLCanvasElement.prototype, "clientHeight", { configurable: true, get: () => 44 });
});
afterEach(cleanup);
function frame(now: number) {
  const callbacks = [...frames.values()]; frames.clear();
  act(() => callbacks.forEach((callback) => callback(now)));
}
function visibility(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  act(() => document.dispatchEvent(new win.Event("visibilitychange") as unknown as Event));
}
function dispatch(canvas: HTMLCanvasElement, name: string) {
  const event = new win.Event(name, { cancelable: true });
  act(() => canvas.dispatchEvent(event as unknown as Event));
  return event;
}
test("StrictMode 首帧立即绘制，重复进入只有一个 RAF，卸载释放", () => {
  const view = render(<StrictMode><ShaderGlow /></StrictMode>);
  expect(draws).toBeGreaterThan(0); expect(time).toBe(6);
  expect(context.mock.calls.at(-1)?.[1]).toMatchObject({ preserveDrawingBuffer: true });
  act(() => { IntersectionMock.current.emit(true); IntersectionMock.current.emit(true); });
  expect(frames.size).toBe(1);
  frame(1000); frame(2000); expect(time).toBe(7);
  view.unmount(); expect(frames.size).toBe(0); expect(deleted).toHaveBeenCalled();
});
test("隐藏和离屏共同决定播放，恢复不会跳过隐藏时段", () => {
  render(<ShaderGlow />);
  act(() => IntersectionMock.current.emit(true)); frame(1000); frame(2000);
  visibility(true); act(() => IntersectionMock.current.emit(true)); expect(frames.size).toBe(0);
  act(() => IntersectionMock.current.emit(false)); visibility(false); expect(frames.size).toBe(0);
  act(() => IntersectionMock.current.emit(true)); frame(90000);
  expect(time).toBe(7); expect(frames.size).toBe(1);
});
test("减少动态在零尺寸展开后重绘，不启动动画", () => {
  reduced = true;
  const view = render(<ShaderGlow />), canvas = view.container.querySelector("canvas")!;
  act(() => ResizeMock.current.emit(0, 0)); const before = draws;
  act(() => ResizeMock.current.emit(480, 48));
  expect(draws).toBeGreaterThan(before); expect([canvas.width, canvas.height]).toEqual([240, 24]);
  act(() => IntersectionMock.current.emit(true)); expect(frames.size).toBe(0);
});
test("上下文丢失停绘，恢复重新初始化并显示首帧", () => {
  const view = render(<ShaderGlow />), canvas = view.container.querySelector("canvas")!;
  act(() => IntersectionMock.current.emit(true)); lost = true;
  expect(dispatch(canvas, "webglcontextlost").defaultPrevented).toBe(true);
  expect(frames.size).toBe(0); const before = draws;
  act(() => ResizeMock.current.emit(500, 44)); expect(draws).toBe(before);
  lost = false; dispatch(canvas, "webglcontextrestored"); expect(draws).toBeGreaterThan(before);
  act(() => IntersectionMock.current.emit(true)); expect(frames.size).toBe(1);
});
test("挂载时已丢失的上下文仍能恢复", () => {
  lost = true; const view = render(<ShaderGlow />); expect(draws).toBe(0);
  lost = false; dispatch(view.container.querySelector("canvas")!, "webglcontextrestored");
  expect(draws).toBeGreaterThan(0);
});
test("没有 GPU 按钮仍可用，链接失败释放已分配资源", () => {
  available = false; const onClick = mock(() => {});
  const view = render(<GlowButton onClick={onClick}>登录</GlowButton>);
  act(() => view.getByRole("button").click()); expect(onClick).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".glow-button-base")).not.toBeNull(); view.unmount();
  available = true; linked = false; render(<ShaderGlow />);
  expect(deleted).toHaveBeenCalledTimes(3); expect(frames.size).toBe(0);
});
