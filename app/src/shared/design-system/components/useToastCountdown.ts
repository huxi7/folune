/**
 * [INPUT]: 依赖 Toast Root 的展开/退场状态、可见顺序、页面可见性与同源 performance 时钟
 * [OUTPUT]: 对外提供 useToastCountdown，让动作回执的 SVG 进度和关闭共享唯一计时，隐藏/悬停/键盘操作/失焦时暂停
 * [POS]: Toast 的动作寿命边界；动作 Toast 禁用 Kumo 自动关闭，Kumo 仍独占队列、焦点、展开与滑动
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, type RefObject } from "react";

export function useToastCountdown({
  duration,
  frontmost,
  onExpire,
  progressRef,
  rootRef,
}: {
  duration: number;
  frontmost: boolean;
  onExpire: () => void;
  progressRef: RefObject<SVGCircleElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const clock = useRef({ duration, remaining: duration });
  useEffect(() => {
    const root = rootRef.current;
    const progress = progressRef.current;
    if (duration <= 0 || root === null || progress === null) return;

    if (clock.current.duration !== duration) clock.current = { duration, remaining: duration };
    let remaining = clock.current.remaining;
    let lastTick = performance.now();
    let frame = 0;
    let paused = true;
    let windowFocused = document.hasFocus();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      const visibleRemaining = reducedMotion.matches
        ? Math.ceil(remaining / 1000) * 1000
        : remaining;
      progress.style.strokeDashoffset = String(1 - Math.min(1, visibleRemaining / duration));
    };
    const tick = (now: number) => {
      remaining = Math.max(0, remaining - (now - lastTick));
      lastTick = now;
      paint();
      if (remaining === 0) {
        onExpire();
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    const syncPause = () => {
      const expanded = root.hasAttribute("data-expanded");
      const nextPaused = !windowFocused || document.hidden || expanded
        || !frontmost || root.hasAttribute("data-limited")
        || root.hasAttribute("data-ending-style");
      if (nextPaused === paused) return;
      const now = performance.now();
      if (nextPaused) {
        remaining = Math.max(0, remaining - (now - lastTick));
        cancelAnimationFrame(frame);
        paint();
      } else {
        lastTick = now;
        frame = requestAnimationFrame(tick);
      }
      paused = nextPaused;
    };
    const onBlur = () => { windowFocused = false; syncPause(); };
    const onFocus = () => { windowFocused = true; syncPause(); };
    const observer = new MutationObserver(syncPause);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-expanded", "data-limited", "data-ending-style"],
    });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", syncPause);
    paint();
    syncPause();
    return () => {
      clock.current.remaining = paused ? remaining : Math.max(0, remaining - (performance.now() - lastTick));
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", syncPause);
    };
  }, [duration, frontmost, onExpire, progressRef, rootRef]);
}
