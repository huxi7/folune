/**
 * [INPUT]: 依赖 Motion inView、DS 实时动态偏好、TruchetPattern，以及 landing.css/blog-index.css 的导轨定位和显现样式
 * [OUTPUT]: 对外提供 paper 几何竖纹、weave 72px Truchet、index 同轴网格点阵与目录 truchet；首页按 Laper 视口门槛、500ms准备+500ms动画延迟和1800ms展开
 * [POS]: widgets 的共享侧轨装饰层；首页/阅读/价格共用 Truchet 几何，首页缓存一次显现；目录按入场时可见区间展开，减少动态直接显示，材质切换不重播
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
const revealViewport = { margin: "-8% 0px -18% 0px" } as const;
const drawPreparationMs = 500;

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

    let preparation: ReturnType<typeof setTimeout> | undefined;
    const revealInViewport = () => {
      // 触发即登记，用户在动画途中离开再返回也不会重复播放。
      revealedRails.add(variant);
      if (reducedMotion) setPhase("complete");
      else preparation = setTimeout(() => setPhase("revealing"), drawPreparationMs);
    };

    if (!("IntersectionObserver" in window)) {
      revealedRails.add(variant);
      setPhase("complete");
      return;
    }

    // 回调不返回离场处理，Motion 会在首次进入后解除此元素的观察。
    const stop = inView(element, revealInViewport, revealViewport);
    return () => { stop(); clearTimeout(preparation); };
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
        {variant === "truchet" || variant === "weave" ? <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs><TruchetPattern id={`${patternId}-${side}`}
            line={variant === "truchet" ? "var(--blog-pattern-line)" : "var(--rail-pattern-line)"}
            accent={variant === "truchet" ? "var(--blog-pattern-accent)" : "var(--rail-pattern-accent)"}
            pathClassName={variant === "truchet" ? "blog-truchet-path" : "landing-rail-path"} /></defs>
          <rect width="100%" height="100%" fill={`url(#${patternId}-${side})`} />
        </svg> : <>
          <span className="landing-rail-detail" />
          <span className="landing-rail-main" />
        </>}
      </div>
    </div>)}
  </div>;
}
