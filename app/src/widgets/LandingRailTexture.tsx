/**
 * [INPUT]: 依赖 Motion inView、DS 实时动态偏好、TruchetPattern，以及 landing.css/blog-index.css 的导轨定位和显现样式
 * [OUTPUT]: 对外提供 paper / weave / index / truchet 四种 LandingRailTexture；首页由视口触发，after-frame 交给公开内容的局部外框与纹样时间线，Truchet 按入场时的可见区间展开
 * [POS]: widgets 的共享侧轨装饰层；首页缓存一次显现，公开目录/阅读按路由重新入场；Truchet 与价格页共用几何，动画开始时量取视口以消除长短目录的速度差，减少动态直接显示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useId, useRef, useState } from "react";
import { inView } from "motion/react";
import { useMotionPreference } from "../shared/design-system/useMotionPreference";
import { TruchetPattern } from "./TruchetPattern";

export type RailVariant = "paper" | "weave" | "index" | "truchet";
type RevealPhase = "pending" | "revealing" | "complete";

// ---- 生命周期属于当前文档；卸载章节不清除，刷新自然重置 ----
const revealedRails = new Set<RailVariant>();
const revealViewport = { margin: "0px 0px -240px 0px" } as const;

export function LandingRailTexture({ variant, reveal = "viewport" }: {
  variant: RailVariant;
  reveal?: "viewport" | "after-frame";
}) {
  const patternId = useId();
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
    onAnimationStart={event => {
      if (event.animationName !== "blog-index-pattern-reveal"
        || !(event.target instanceof HTMLElement)
        || event.target.parentElement?.dataset.side !== "start") return;
      // 延迟和路由快照结束后才量取；只让当前看得见的花纹走完同一段时长。
      const host = event.currentTarget;
      const { top, height } = host.getBoundingClientRect();
      const start = Math.min(height, Math.max(0, -top));
      const end = Math.min(height, Math.max(start, window.innerHeight - top));
      if (end > start) {
        host.style.setProperty("--blog-pattern-start", `${start}px`);
        host.style.setProperty("--blog-pattern-end", `${end}px`);
      }
    }}
    onAnimationEnd={event => {
      // 左右动画同帧开始，只由左侧绘制层的结束事件提交共同终态。
      if (event.target instanceof HTMLElement
        && event.target.classList.contains("landing-rail-texture-pattern")
        && event.target.parentElement?.dataset.side === "start") setPhase("complete");
    }}
  >
    {(["start", "end"] as const).map(side => <div className="landing-rail-texture-side" data-side={side} key={side}>
      <div className="landing-rail-texture-pattern">
        {variant === "truchet" ? <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs><TruchetPattern id={`${patternId}-${side}`} line="var(--blog-pattern-line)" accent="var(--blog-pattern-accent)" pathClassName="blog-truchet-path" /></defs>
          <rect width="100%" height="100%" fill={`url(#${patternId}-${side})`} />
        </svg> : <>
          <span className="landing-rail-detail" />
          <span className="landing-rail-main" />
        </>}
      </div>
    </div>)}
  </div>;
}
