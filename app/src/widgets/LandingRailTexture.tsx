/**
 * [INPUT]: 依赖 Motion inView、DS 实时动态偏好与 landing.css 的 Blueprint 坐标、纹样、水平渐隐和纵向显现遮罩
 * [OUTPUT]: 对外提供 paper / weave / index 三种进入视口后由上至下显现的 LandingRailTexture 及 RailVariant 类型
 * [POS]: widgets 的首页侧轨装饰层；连续覆盖上下空轨与正文，两侧共用一次触发；模块内存按纹样记录本次文档已播放项，路由往返不重播、刷新重置，减少动态时直接显示
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

export function LandingRailTexture({ variant }: { variant: RailVariant }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMotionPreference();
  const [phase, setPhase] = useState<RevealPhase>(() => revealedRails.has(variant) ? "complete" : "pending");

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    if (revealedRails.has(variant)) {
      setPhase("complete");
      return;
    }

    const reveal = () => {
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
    return inView(element, reveal, revealViewport);
  }, [variant, reducedMotion]);

  return <div
    ref={hostRef}
    className="landing-rail-texture"
    data-variant={variant}
    data-reveal={phase}
    aria-hidden="true"
    onAnimationEnd={event => {
      if (event.animationName === "landing-rail-reveal") setPhase("complete");
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
