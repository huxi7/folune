/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与真实 ToastProvider/useToast/useToastCountdown
 * [OUTPUT]: 验证重复入栈、三条可见、独立撤销/倒计时续走及更新常驻；保留底层非模态 dialog 语义，禁止更新触发模态弹窗
 * [POS]: 全局瞬时反馈行为门禁；以可控帧时钟验证到期和剩余细线共享时间，不依赖真实等待
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test, spyOn } from "bun:test";
import { Window } from "happy-dom";
import { useRef } from "react";

const browserWindow = new Window({ url: "http://localhost:10000" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  MutationObserver: browserWindow.MutationObserver,
  ResizeObserver: browserWindow.ResizeObserver,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
const { act, cleanup, fireEvent, render } = await import("@testing-library/react/pure");
const { ToastProvider, useToast } = await import("./Toast");
const { useToastCountdown } = await import("./useToastCountdown");
afterEach(cleanup);

function Trigger() {
  const { toast, dismissToast } = useToast();
  return <button onClick={() => {
    const first = toast({ title: "复制完成" });
    expect(toast({ title: "复制完成" })).not.toBe(first);
    toast({ title: "导出完成" });
    toast({ title: "保存失败", variant: "error" });
    toast({ title: "保存失败", variant: "error" });
    for (let index = 0; index < 3; index += 1) {
      const id = toast({ title: "已移除", action: { label: "撤销", onClick: () => dismissToast(id) } });
    }
  }}>触发</button>;
}

test("重复触发正常入栈，最多三条可见并保留独立撤销", () => {
  const view = render(<ToastProvider><Trigger /></ToastProvider>);
  fireEvent.click(view.getByText("触发"));
  const active = [...document.querySelectorAll('.ds-toast:not([data-ending-style])')];
  expect(active.filter((node) => node.textContent?.includes("复制完成"))).toHaveLength(2);
  expect(active.filter((node) => node.textContent?.includes("导出完成"))).toHaveLength(1);
  expect(active.filter((node) => node.textContent?.includes("保存失败"))).toHaveLength(2);
  expect(active.filter((node) => node.querySelector('.ds-toast-action'))).toHaveLength(3);
  expect(active.filter((node) => !node.hasAttribute('data-limited'))).toHaveLength(3);
  const viewport = document.querySelector('.ds-toast-viewport')!;
  fireEvent.mouseEnter(viewport);
  expect(viewport.hasAttribute('data-expanded')).toBe(true);
  expect(active.filter((node) => !node.hasAttribute('data-limited')).every((node) => node.hasAttribute('data-expanded'))).toBe(true);
  fireEvent.mouseLeave(viewport);
  expect(viewport.hasAttribute('data-expanded')).toBe(false);
  const undo = document.querySelector<HTMLButtonElement>('.ds-toast-action')!;
  fireEvent.click(undo);
  expect(document.querySelectorAll('.ds-toast:not([data-ending-style]) .ds-toast-action')).toHaveLength(2);
});

function Countdown({ frontmost, onExpire }: { frontmost: boolean; onExpire: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  useToastCountdown({ duration: 1000, frontmost, onExpire, progressRef, rootRef });
  return <div ref={rootRef} data-testid="countdown"><span ref={progressRef} /></div>;
}

test("剩余细线与到期共用时间，反复暂停和隐藏后不重置、不提前关闭", async () => {
  let now = 0;
  let nextFrame = 0;
  let expired = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const nowSpy = spyOn(performance, "now").mockImplementation(() => now);
  const rafSpy = spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  const cancelSpy = spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  const focusSpy = spyOn(document, "hasFocus").mockReturnValue(true);
  const advance = (elapsed: number) => {
    now += elapsed;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(now));
  };
  const onExpire = () => { expired += 1; };
  try {
    const view = render(<Countdown frontmost onExpire={onExpire} />);
    const root = view.getByTestId("countdown");
    const progress = root.querySelector("span")!;
    const remainingFraction = () => Number(progress.style.transform.match(/scaleX\(([^)]+)\)/)?.[1]);
    advance(300);
    expect(remainingFraction()).toBeCloseTo(0.7);
    await act(async () => {
      root.setAttribute("data-expanded", "");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    advance(2000);
    expect(expired).toBe(0);
    expect(remainingFraction()).toBeCloseTo(0.7);
    await act(async () => {
      root.removeAttribute("data-expanded");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    advance(200);
    view.rerender(<Countdown frontmost={false} onExpire={onExpire} />);
    advance(2000);
    expect(expired).toBe(0);
    view.rerender(<Countdown frontmost onExpire={onExpire} />);
    browserWindow.dispatchEvent(new browserWindow.Event("blur"));
    advance(2000);
    expect(expired).toBe(0);
    browserWindow.dispatchEvent(new browserWindow.Event("focus"));
    advance(499);
    expect(expired).toBe(0);
    advance(1);
    expect(expired).toBe(1);
    expect(remainingFraction()).toBe(0);
    view.unmount();
    expect(frames.size).toBe(0);
  } finally {
    cleanup();
    focusSpy.mockRestore(); cancelSpy.mockRestore(); rafSpy.mockRestore(); nowSpy.mockRestore();
  }
});

function UpdateTrigger({ onInstall }: { onInstall: () => void }) {
  const { toast, dismissToast } = useToast();
  return <button onClick={() => {
    const id = toast({ title: "新版本已经准备好", duration: 0,
      action: { label: "重启更新", onClick: onInstall },
      secondaryAction: { label: "稍后", onClick: () => dismissToast(id) },
    });
  }}>显示更新</button>;
}

test("更新 Toast 常驻且稍后不会执行安装", () => {
  let installs = 0;
  const view = render(<ToastProvider><UpdateTrigger onInstall={() => { installs++; }} /></ToastProvider>);
  fireEvent.click(view.getByText("显示更新"));
  // Base UI Toast 自带非模态 dialog 语义，只有模态或 Folune Dialog 外壳才是更新弹窗。
  expect(document.querySelector('[role="dialog"][aria-modal="true"], .ds-dialog-overlay') === null).toBe(true);
  const updateToast = view.getByText("新版本已经准备好").closest('.ds-toast');
  expect(updateToast?.getAttribute("aria-modal")).toBe("false");
  expect(document.querySelector(".ds-toast-countdown")).toBeNull();
  expect(view.getByText("重启更新")).toBeDefined();
  fireEvent.click(view.getByText("稍后"));
  expect(installs).toBe(0);
  expect(document.querySelectorAll(".ds-toast:not([data-ending-style])")).toHaveLength(0);
});
