/**
 * [INPUT]: 依赖 Paper Shaders Dithering、Motion 视口观察、DS 动效偏好与展示区的品牌颜色
 * [OUTPUT]: 对外提供仅在 APP 展示区后方绘制的低对比点阵流动背景
 * [POS]: LandingEditor 的装饰层；按需加载 shader，离屏/后台由库暂停，减少动态效果时保留静态点阵
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const Dithering = lazy(() => import("@paper-design/shaders-react").then(module => ({ default: module.Dithering })));

export function ShowcaseBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const nearViewport = useInView(hostRef, { margin: "120px", once: true });
  const reducedMotion = useMotionPreference();
  const [ink, setInk] = useState<string | null>(null);

  useEffect(() => {
    if (!nearViewport || reducedMotion || !hostRef.current) return;
    // ---- 无 WebGL2 时沿用 CSS 点阵；探测上下文立即释放 ----
    const probe = document.createElement("canvas").getContext("webgl2");
    if (!probe) return;
    probe.getExtension("WEBGL_lose_context")?.loseContext();
    setInk(getComputedStyle(hostRef.current).color);
  }, [nearViewport, reducedMotion]);

  return (
    <div ref={hostRef} className="landing-showcase-backdrop" aria-hidden="true">
      {ink && !reducedMotion && (
        <Suspense fallback={null}>
          <Dithering
            className="landing-showcase-shader"
            colorBack="#00000000"
            colorFront={ink}
            shape="warp"
            type="4x4"
            size={1.5}
            scale={0.65}
            speed={0.16}
            frame={12000}
            minPixelRatio={1}
            maxPixelCount={900_000}
            width="100%"
            height="100%"
          />
        </Suspense>
      )}
    </div>
  );
}
