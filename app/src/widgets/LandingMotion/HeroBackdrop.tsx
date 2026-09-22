/**
 * [INPUT]: 依赖 Paper Shaders GrainGradient、DS 动态偏好与 landing.css 的 78% 画布/65% 阅读遮罩
 * [OUTPUT]: 对外提供用户选定 02A 的正式 Hero 颗粒波面；减少动态时停在同一初始帧
 * [POS]: LandingHero 专用后景，参数独立于实验页和浏览器收藏；库负责后台/离屏暂停
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const GrainGradient = lazy(() => import("@paper-design/shaders-react").then(module => ({ default: module.GrainGradient })));
const HERO_COLORS = ["#7c96a6", "#b8c6cb", "#f4f4f2"];

export function HeroBackdrop() {
  const reducedMotion = useMotionPreference();
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let context: WebGL2RenderingContext | null = null;
    try {
      context = document.createElement("canvas").getContext("webgl2");
      setSupported(Boolean(context));
    } catch {
      // 无图形上下文时保留纸面，正文与操作区不依赖后景加载。
    } finally {
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }, []);

  return <div className="landing-hero-backdrop" aria-hidden="true">
    {supported && <Suspense fallback={null}>
      <GrainGradient
        className="landing-hero-shader"
        colors={HERO_COLORS}
        colorBack="#f4f4f2"
        shape="wave"
        softness={0.8}
        intensity={0.07}
        noise={0.19}
        scale={0.96}
        offsetX={-0.26}
        offsetY={0.18}
        rotation={-17}
        speed={reducedMotion ? 0 : 0.68}
        frame={12000}
        minPixelRatio={1}
        maxPixelCount={1_400_000}
        width="100%"
        height="100%"
      />
    </Suspense>}
    <div className="landing-hero-reading-veil" />
  </div>;
}
