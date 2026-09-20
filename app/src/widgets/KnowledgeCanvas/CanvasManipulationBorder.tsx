/**
 * [INPUT]: 依赖卡片本地布局尺寸、DS 动态偏好与 manipulationBorderGeometry 的单向波形
 * [OUTPUT]: 对外提供 CanvasManipulationBorder；两路纸边由右下流向左上，以单一 rAF 直接写 path
 * [POS]: CanvasManipulationFeedback 的按住期装饰；只有轮廓动，曲率来自卡片 CSS，不改选择/几何/命中，不参与持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useLayoutEffect, useRef } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { createBorderBranches, manipulationBorderPath } from "./manipulationBorderGeometry";

// React Bits Electric Border 的有机边缘适配；参考授权见 ElectricBorder.LICENSE.md。
export function CanvasManipulationBorder() {
  const rootRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const reducedMotion = useMotionPreference();

  useLayoutEffect(() => {
    const root = rootRef.current;
    const path = pathRef.current;
    const card = root?.parentElement;
    if (!root || !path || !card) return;
    let branches: ReturnType<typeof createBorderBranches> = [];
    let frame = 0;
    let visible = true;
    const paint = (time: number) => {
      if (branches.length > 0) path.setAttribute("d", manipulationBorderPath(branches, time));
    };
    const measure = () => {
      // offset 尺寸不含 Flow viewport transform，防止重复缩放。
      const style = card.ownerDocument.defaultView!.getComputedStyle(card);
      branches = createBorderBranches(card.offsetWidth, card.offsetHeight,
        Number.parseFloat(style.borderTopLeftRadius) || 0,
        typeof CSS !== "undefined" && CSS.supports("corner-shape", "squircle"));
      paint(reducedMotion ? 0 : performance.now() / 1000);
    };
    const tick = (time: number) => {
      paint(time / 1000);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!reducedMotion && visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(card);
    const intersection = typeof IntersectionObserver === "undefined" ? null
      : new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; sync(); });
    intersection?.observe(card);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reducedMotion]);

  return <svg aria-hidden="true" className="canvas-manipulation-border" focusable="false" ref={rootRef}>
    <path className="canvas-manipulation-edge" ref={pathRef} />
  </svg>;
}
