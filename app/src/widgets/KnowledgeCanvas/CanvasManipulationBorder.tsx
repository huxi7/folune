/**
 * [INPUT]: React Bits ElectricBorder 与右下至左上方向适配、卡片 CSS 曲率与 DS 动态偏好
 * [OUTPUT]: CanvasManipulationBorder，直接配置上游 speed=0.4、chaos=0.04，线宽 2.5px，右下发起/左上收束
 * [POS]: CanvasManipulationFeedback 的按住期品牌适配层；不再维护独立波形与换算参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import ElectricBorder from "./ElectricBorder";

export function CanvasManipulationBorder() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ radius: 16, squircle: false });
  const reducedMotion = useMotionPreference();
  useLayoutEffect(() => {
    const card = hostRef.current?.parentElement;
    if (!card) return;
    const style = card.ownerDocument.defaultView!.getComputedStyle(card);
    setGeometry({
      radius: Number.parseFloat(style.borderTopLeftRadius) || 16,
      squircle: style.getPropertyValue("corner-shape") === "superellipse(2)",
    });
  }, []);

  return <div aria-hidden="true" className="canvas-manipulation-border" ref={hostRef}>
    <ElectricBorder
      speed={0.4}
      chaos={0.04}
      flow="bottom-right-to-top-left"
      color="currentColor"
      borderRadius={geometry.radius}
      squircle={geometry.squircle}
      thickness={2.5}
      paused={reducedMotion}
    />
  </div>;
}
