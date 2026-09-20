/**
 * [INPUT]: 依赖 React useId/useEffect、DS 动态偏好与浏览器 IntersectionObserver；滤镜仅作用于 CSS 原生平滑圆角描边
 * [OUTPUT]: 对外提供 CanvasSelectionBorder，以有厚度和可见起伏的 Soft Ink 撕纸边表达选中；离屏/后台停止动画，Reduced Motion 保留静态撕纸轮廓
 * [POS]: CanvasCardNode 的纯装饰层；借鉴 React Bits Electric Border 的噪声位移边缘，三层噪声同时形成纸边起伏与毛边，沿用原生曲率，不读取或修改画布状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useId, useRef, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

// ---------------------------------------------------------------------------
// Electric Border 适配：实体撕纸边带缓慢起伏，滤镜不包裹纸面，缩放只由 React Flow 执行。
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
              baseFrequency="0.03 0.045"
              numOctaves={3}
              result="flow"
              seed={8}
              type="fractalNoise"
            >
              {animated ? <animate
                attributeName="baseFrequency"
                dur="6s"
                repeatCount="indefinite"
                values="0.03 0.045;0.04 0.06;0.03 0.045"
                calcMode="spline"
                keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                keyTimes="0;0.5;1"
              /> : null}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="flow"
              scale={10}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feMorphology operator="dilate" radius="0.35" />
          </filter>
        </defs>
      </svg>
      <span
        className="canvas-selection-edge"
        style={{ filter: `url(#${filterId})` }}
      />
    </span>
  );
}
