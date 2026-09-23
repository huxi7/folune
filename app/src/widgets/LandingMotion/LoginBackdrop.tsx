/**
 * [INPUT]: 依赖 Paper ShaderMount、共用 01A inkShader、DS 动态偏好与 auth.css 后景层
 * [OUTPUT]: 对外提供 LoginBackdrop，固定 01A 材质与极慢连续移动；减少动态时保留初始静帧
 * [POS]: 登录正文专用背景；只量取宿主尺寸，不读取 Lab 草稿或认证状态，库负责后台/离屏停帧
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { inkFragmentShader } from "./inkShader";

const ShaderMount = lazy(() => import("@paper-design/shaders-react").then(module => ({ default: module.ShaderMount })));

export function LoginBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  const reducedMotion = useMotionPreference();
  const [supported, setSupported] = useState(false);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    let context: WebGL2RenderingContext | null = null;
    try {
      context = document.createElement("canvas").getContext("webgl2");
      setSupported(Boolean(context));
    } catch {
      // 图形能力不可用时保留原有纸面，表单不等待背景。
    } finally {
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize(previous => previous[0] === width && previous[1] === height ? previous : [width, height]);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // ---- 与终选 01A 相同材质；只将原 .28 速度降至 .04 ----
  const uniforms = useMemo(() => ({
    u_cssSize: size, u_mode: 0, u_grain: 1.5, u_patternScale: 1,
    u_density: 0.5, u_disorder: 0.62, u_seed: 37,
    u_position: [-0.12, 0.1], u_angle: -16,
  }), [size]);

  return <div ref={host} className="auth-backdrop" aria-hidden="true">
    {supported && size[0] > 0 && size[1] > 0 && <Suspense fallback={null}>
      <ShaderMount
        fragmentShader={inkFragmentShader}
        uniforms={uniforms}
        speed={reducedMotion ? 0 : 0.04}
        frame={12000}
        minPixelRatio={1}
        maxPixelCount={1_400_000}
        width="100%"
        height="100%"
      />
    </Suspense>}
  </div>;
}
