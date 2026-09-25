/**
 * [INPUT]: 依赖 Motion inView、DS 实时动态偏好与 landing.css 的 Blueprint 坐标、纹样、水平渐隐和绘制层原生 mask-position 动画
 * [OUTPUT]: 对外提供 paper / weave / index 三种由上至下显现的 LandingRailTexture；默认视口触发，after-frame 交给阅读页 CSS 在花纹局部外框之后播放
 * [POS]: widgets 的共享侧轨装饰层；首页按纹样缓存一次视口显现，阅读页按路由重新入场且不读写首页缓存；定位容器决定覆盖范围，减少动态时直接显示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { inView } from "motion/react";
import { useMotionPreference } from "../shared/design-system/useMotionPreference";

export type RailVariant = "paper" | "weave" | "index";
type RevealPhase = "pending" | "revealing" | "complete";

// ---- 生命周期属于当前文档；卸载章节不清除，刷新自然重置 ----
const revealedRails = new Set<RailVariant>();
const revealViewport = { margin: "0px 0px -240px 0px" } as const;

export function LandingRailTexture({ variant, reveal = "viewport" }: {
  variant: RailVariant;
  reveal?: "viewport" | "after-frame";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMotionPreference();
  const [phase, setPhase] = useState<RevealPhase>(() => reveal === "after-frame"
    ? "revealing"
    : revealedRails.has(variant) ? "complete" : "pending");

  useEffect(() => {
    // 阅读页的花纹局部外框与纹样由同一条 CSS 时间线编排，不等待滚动，也不消耗首页播放记录。
    if (reveal === "after-frame") {
      if (reducedMotion) setPhase("complete");
      return;
    }
    const element = hostRef.current;
    if (!element) return;
    if (revealedRails.has(variant)) {
      setPhase("complete");
      return;
    }

    const revealInViewport = () => {
      // 触发即登记，用户在动画途中离开再返回也不会重复播放。
      revealedRails.add(variant);
      setPhase(reducedMotion ? "complete" : "revealing");
    };

    if (!("IntersectionObserver" in window)) {
      revealedRails.add(variant);
      setPhase("complete");
      return;
    }

    // 回调不返回离场处理，Motion 会在首次进入后解除此元素的观察。
    return inView(element, revealInViewport, revealViewport);
  }, [variant, reducedMotion, reveal]);

  return <div
    ref={hostRef}
    className="landing-rail-texture"
    data-variant={variant}
    data-reveal={phase}
    aria-hidden="true"
    onAnimationEnd={event => {
      // 左右动画同帧开始，只由左侧绘制层的结束事件提交共同终态。
      if (event.animationName === "landing-rail-reveal"
        && event.target instanceof HTMLElement
        && event.target.parentElement?.dataset.side === "start") setPhase("complete");
    }}
  >
    {(["start", "end"] as const).map(side => <div className="landing-rail-texture-side" data-side={side} key={side}>
      <div className="landing-rail-texture-pattern">
        <span className="landing-rail-detail" />
        <span className="landing-rail-main" />
      </div>
    </div>)}
  </div>;
}
