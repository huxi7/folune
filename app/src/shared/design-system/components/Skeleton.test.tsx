/**
 * [INPUT]: 依赖 Bun test、happy-dom、真实 Skeleton/useDelayedSkeleton 与可控毫秒时钟
 * [OUTPUT]: 验证延迟防闪、内容就绪立即退出、显式最短展示、快速重载/配置变更/卸载清理与可访问状态
 * [POS]: 统一加载原语的计时与语义回归；不等待真实时间，不替代 CSS 视觉验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { StrictMode, type ReactNode } from "react";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  MutationObserver: browserWindow.MutationObserver,
});
const { act, cleanup, render, renderHook } = await import("@testing-library/react/pure");
const { Skeleton, SkeletonGroup, useDelayedSkeleton } = await import("./Skeleton");

type Options = Parameters<typeof useDelayedSkeleton>[1];
type Props = { active: boolean; options?: Options };
let now = 0;
let nextTimer = 0;
const timers = new Map<number, { due: number; run: () => void }>();
const restores: Array<() => void> = [];

beforeEach(() => {
  now = 0;
  nextTimer = 0;
  timers.clear();
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const schedule = spyOn(browserWindow, "setTimeout").mockImplementation((handler, delay = 0) => {
    if (typeof handler !== "function") throw new Error("Skeleton timer must be callable");
    const id = ++nextTimer;
    timers.set(id, { due: now + delay, run: () => handler() });
    // happy-dom 的声明沿用 Node Timeout；这里以可观测数字句柄替代浏览器计时队列。
    return id as unknown as ReturnType<typeof browserWindow.setTimeout>;
  });
  const cancel = spyOn(browserWindow, "clearTimeout").mockImplementation((id) => {
    timers.delete(id as unknown as number);
  });
  restores.push(() => clock.mockRestore(), () => schedule.mockRestore(), () => cancel.mockRestore());
});
afterEach(() => {
  cleanup();
  restores.splice(0).reverse().forEach((restore) => restore());
  timers.clear();
});

const advance = (elapsed: number) => {
  const end = now + elapsed;
  for (;;) {
    const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
    if (!next || next[1].due > end) break;
    now = next[1].due;
    timers.delete(next[0]);
    act(() => { next[1].run(); });
  }
  now = end;
};

const hook = ({ active, options }: Props) => useDelayedSkeleton(active, options);

test("100ms 快请求不显示骨架，完成后旧延迟不会重新出现", () => {
  const view = renderHook(hook, { initialProps: { active: true } });
  advance(100);
  expect(view.result.current).toBe(false);
  view.rerender({ active: false });
  expect(timers.size).toBe(0);
  advance(1000);
  expect(view.result.current).toBe(false);
});

test("默认 180ms 后显示，内容就绪的首次 render 已隐藏且无需额外计时", () => {
  const renders: boolean[] = [];
  const view = renderHook((props: Props) => {
    const visible = hook(props);
    renders.push(visible);
    return visible;
  }, { initialProps: { active: true } });
  advance(179);
  expect(view.result.current).toBe(false);
  advance(1);
  expect(view.result.current).toBe(true);
  renders.length = 0;
  view.rerender({ active: false });
  expect(renders[0]).toBe(false);
  expect(view.result.current).toBe(false);
  expect(timers.size).toBe(0);
});

test("每次新加载重新等待 180ms，不继承上一轮可见状态或已取消计时", () => {
  const view = renderHook(hook, { initialProps: { active: true } });
  advance(180);
  view.rerender({ active: false });
  view.rerender({ active: true });
  expect(view.result.current).toBe(false);
  advance(100);
  view.rerender({ active: false });
  view.rerender({ active: true });
  advance(179);
  expect(view.result.current).toBe(false);
  advance(1);
  expect(view.result.current).toBe(true);
  expect(timers.size).toBe(0);
});

test("显式 180ms 最短展示仍从出现时计时，继续加载会取消待隐藏计时", () => {
  const props: Props = { active: true, options: { minimumVisibleMs: 180 } };
  const view = renderHook(hook, { initialProps: props });
  advance(180);
  advance(20);
  view.rerender({ ...props, active: false });
  expect(view.result.current).toBe(true);
  advance(159);
  expect(view.result.current).toBe(true);
  advance(1);
  expect(view.result.current).toBe(false);

  view.rerender(props);
  advance(180);
  view.rerender({ ...props, active: false });
  advance(50);
  view.rerender(props);
  expect(timers.size).toBe(0);
  advance(200);
  expect(view.result.current).toBe(true);
  view.rerender({ ...props, active: false });
  expect(view.result.current).toBe(false);
  expect(timers.size).toBe(0);
});

test("延迟配置变化替换旧计时，最短展示改 0 时立即释放已就绪内容", () => {
  const view = renderHook(hook, { initialProps: { active: true, options: { delayMs: 300, minimumVisibleMs: 180 } } as Props });
  advance(100);
  view.rerender({ active: true, options: { delayMs: 40, minimumVisibleMs: 180 } });
  expect(timers.size).toBe(1);
  advance(39);
  expect(view.result.current).toBe(false);
  advance(1);
  expect(view.result.current).toBe(true);
  view.rerender({ active: false, options: { delayMs: 40, minimumVisibleMs: 180 } });
  expect(view.result.current).toBe(true);
  view.rerender({ active: false, options: { delayMs: 40, minimumVisibleMs: 0 } });
  expect(view.result.current).toBe(false);
  expect(timers.size).toBe(0);
});

test("StrictMode 与卸载清理出现/隐藏计时，不留下异步状态更新", () => {
  for (const visible of [false, true]) {
    const props: Props = { active: true, options: { minimumVisibleMs: 180 } };
    const view = renderHook(hook, {
      initialProps: props,
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });
    expect(timers.size).toBe(1);
    if (visible) {
      advance(180);
      view.rerender({ ...props, active: false });
    }
    expect(timers.size).toBe(1);
    view.unmount();
    expect(timers.size).toBe(0);
    advance(1000);
  }
});

test("可见组只有一个 polite status，ready 同时撤销 busy 与播报，形状始终隐藏于读屏", () => {
  function Loading({ active }: { active: boolean }) {
    const visible = useDelayedSkeleton(active);
    return <SkeletonGroup visible={visible} label="正在读取笔记" data-testid="group">
      <Skeleton shape="text" data-testid="shape" />
    </SkeletonGroup>;
  }
  const view = render(<Loading active />);
  const group = view.getByTestId("group");
  expect(group.hasAttribute("aria-busy")).toBe(false);
  expect(view.queryByRole("status")).toBeNull();
  advance(180);
  expect(group.getAttribute("aria-busy")).toBe("true");
  expect(view.getAllByRole("status")).toHaveLength(1);
  expect(view.getByRole("status").getAttribute("aria-live")).toBe("polite");
  expect(view.getByRole("status").textContent).toBe("正在读取笔记");
  expect(view.getByTestId("shape").getAttribute("aria-hidden")).toBe("true");
  view.rerender(<Loading active={false} />);
  expect(group.hasAttribute("aria-busy")).toBe(false);
  expect(view.queryByRole("status")).toBeNull();
});
