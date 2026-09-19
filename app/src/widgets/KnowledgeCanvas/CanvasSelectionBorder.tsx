/**
 * [INPUT]: 依赖 React useId/useEffect、DS 动态偏好与浏览器 IntersectionObserver；滤镜仅作用于 CSS 原生平滑圆角描边
 * [OUTPUT]: 对外提供 CanvasSelectionBorder，以 Soft Ink 细流光表达选中；离屏/后台停止动画，Reduced Motion 保留静态轮廓
 * [POS]: CanvasCardNode 的纯装饰层；借鉴 React Bits Electric Border 的噪声位移边缘，收敛振幅与速度并沿用原生曲率，不读取或修改画布状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useId, useRef, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

// ---------------------------------------------------------------------------
// Electric Border 适配：保留有机边缘，滤镜不包裹纸面，缩放只由 React Flow 执行。
// 来源：https://reactbits.dev/animations/electric-border
// React Bits 授权保留在同目录 ElectricBorder.LICENSE.md。
// ---------------------------------------------------------------------------

export function CanvasSelectionBorder() {
  const filterId = `canvas-selection-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useMotionPreference();
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    });
    observer.observe(root);
    const syncVisibility = () => setForeground(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [reducedMotion]);

  const animated = !reducedMotion && visible && foreground;

  return (
    <span
      aria-hidden="true"
      className="canvas-selection-border"
      data-animated={animated}
      ref={rootRef}
    >
      {animated ? (
        <svg className="canvas-selection-filter" focusable="false">
          <defs>
            <filter
              colorInterpolationFilters="sRGB"
              height="120%"
              id={filterId}
              width="120%"
              x="-10%"
              y="-10%"
            >
              <feTurbulence
                baseFrequency="0.012 0.018"
                numOctaves={2}
                result="flow"
                seed={8}
                type="fractalNoise"
              >
                <animate
                  attributeName="baseFrequency"
                  dur="14s"
                  repeatCount="indefinite"
                  values="0.012 0.018;0.018 0.026;0.012 0.018"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                  keyTimes="0;0.5;1"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="flow"
                scale={2.4}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      ) : null}
      <span
        className="canvas-selection-filament"
        style={animated ? { filter: `url(#${filterId})` } : undefined}
      />
    </span>
  );
}
