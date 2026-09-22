/**
 * [INPUT]: 依赖 Motion inView/useScroll/useMotionValueEvent、DS 实时动态偏好与 landing.css 的 Blueprint 坐标、纹样、水平渐隐和纵向显现遮罩
 * [OUTPUT]: 对外提供 paper / weave 进入视口后的缓慢揭示、index 跟随首页滚动的柔边与浓度双重浮现，以及 RailVariant 类型
 * [POS]: widgets 的首页侧轨装饰层；连续覆盖上下空轨与正文，两侧共用显现进度；paper/weave 保留计时动画，index 在区块顶部从视口 90% 走到 25% 时随滚动单向完成，遮罩柔边保留在视口下沿且格点浓度在前 55% 进程渐显；模块内存按纹样记录本次文档已播放项，路由往返不重播、刷新重置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, useState, type AnimationEventHandler, type RefObject } from "react";
import { inView, useMotionValueEvent, useScroll } from "motion/react";
import { useMotionPreference } from "../shared/design-system/useMotionPreference";

export type RailVariant = "paper" | "weave" | "index";
type RevealPhase = "pending" | "revealing" | "complete";

// ---- 生命周期属于当前文档；卸载章节不清除，刷新自然重置 ----
const revealedRails = new Set<RailVariant>();
const revealViewport = { margin: "0px 0px -96px 0px" } as const;
const indexRevealOffset: ["start 90%", "start 25%"] = ["start 90%", "start 25%"];
const completedRevealPosition = 112;
const indexRevealTravel = 90;
const indexFadeCompletion = .55;

export function LandingRailTexture({ variant }: { variant: RailVariant }) {
  return variant === "index"
    ? <ScrollLinkedIndexRail />
    : <TimedRail variant={variant} />;
}

function TimedRail({ variant }: { variant: Exclude<RailVariant, "index"> }) {
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

  return <RailTextureView
    hostRef={hostRef}
    variant={variant}
    phase={phase}
    onAnimationEnd={event => {
      if (event.animationName === "landing-rail-reveal") setPhase("complete");
    }}
  />;
}

function ScrollLinkedIndexRail() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMotionPreference();
  const alreadyRevealed = revealedRails.has("index");
  const [phase, setPhase] = useState<RevealPhase>(() => alreadyRevealed ? "complete" : "pending");
  const furthestProgressRef = useRef(alreadyRevealed ? 1 : 0);
  const { scrollYProgress } = useScroll({ target: hostRef, offset: indexRevealOffset });

  const updateReveal = useCallback((latest: number) => {
    const element = hostRef.current;
    if (!element || phase === "complete" || getComputedStyle(element).display === "none") return;

    const progress = Math.max(furthestProgressRef.current, Math.min(1, Math.max(0, latest)));
    if (progress <= 0) return;

    revealedRails.add("index");
    if (reducedMotion) {
      element.style.setProperty("--rail-reveal-position", `${completedRevealPosition}%`);
      element.style.setProperty("--rail-reveal-opacity", "1");
      setPhase("complete");
      return;
    }

    furthestProgressRef.current = progress;
    element.style.setProperty("--rail-reveal-position", `${progress * indexRevealTravel}%`);
    element.style.setProperty("--rail-reveal-opacity", `${Math.min(1, progress / indexFadeCompletion)}`);
    if (phase === "pending") setPhase("revealing");
    if (progress >= 1) {
      element.style.setProperty("--rail-reveal-position", `${completedRevealPosition}%`);
      element.style.setProperty("--rail-reveal-opacity", "1");
      setPhase("complete");
    }
  }, [phase, reducedMotion]);

  useMotionValueEvent(scrollYProgress, "change", updateReveal);
  useEffect(() => {
    const frame = requestAnimationFrame(() => updateReveal(scrollYProgress.get()));
    return () => cancelAnimationFrame(frame);
  }, [scrollYProgress, updateReveal]);

  return <RailTextureView hostRef={hostRef} variant="index" phase={phase} />;
}

function RailTextureView({
  hostRef,
  variant,
  phase,
  onAnimationEnd,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  variant: RailVariant;
  phase: RevealPhase;
  onAnimationEnd?: AnimationEventHandler<HTMLDivElement>;
}) {
  return <div
    ref={hostRef}
    className="landing-rail-texture"
    data-variant={variant}
    data-reveal={phase}
    aria-hidden="true"
    onAnimationEnd={onAnimationEnd}
  >
    {(["start", "end"] as const).map(side => <div className="landing-rail-texture-side" data-side={side} key={side}>
      <div className="landing-rail-texture-pattern">
        <span className="landing-rail-detail" />
        <span className="landing-rail-main" />
      </div>
    </div>)}
  </div>;
}
