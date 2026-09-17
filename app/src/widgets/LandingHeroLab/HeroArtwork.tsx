/**
 * [INPUT]: 依赖已安装的 Paper Shaders GrainGradient/Warp/GodRays/Dithering、React 生命周期与首屏播放状态
 * [OUTPUT]: 对外提供四种真实 WebGL2 Shader 背景与运行/失败反馈
 * [POS]: 独立首屏 Demo 的背景组件；直接使用库组件，局部参数控制蓝灰色场，单实例且不修改正式展示背景
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { GrainGradient, Warp, GodRays, Dithering } from "@paper-design/shaders-react";

export type ShaderConcept = "grain" | "silk" | "rays" | "dither";
export type ShaderStatus = "loading" | "ready" | "unavailable";

const GRAIN_COLORS = ["#7695ab", "#c5d2d7", "#e5e4db"];
const RAY_COLORS = ["#839fb2", "#bdcbd2", "#e0ded4"];
const SILK_COLORS = ["#f4f4f2", "#8ba7ba", "#e0e6e6", "#b2c5ce"];

export function HeroArtwork({ concept, running, onStatus }: {
  concept: ShaderConcept;
  running: boolean;
  onStatus: (status: ShaderStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // ---- 探测失败必须明确反馈，不能把静态底色当作已运行的 Shader ----
    let context: WebGL2RenderingContext | null = null;
    try { context = document.createElement("canvas").getContext("webgl2"); } catch { /* 无图形上下文 */ }
    setSupported(Boolean(context));
    if (!context) onStatus("unavailable");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, [onStatus]);

  useEffect(() => {
    if (!supported || !host.current) return;
    const element = host.current;
    let canvas: HTMLCanvasElement | null = null;
    const lost = () => onStatus("unavailable");
    const inspect = () => {
      const next = element.querySelector("canvas");
      if (!next || next.width < 2) return;
      if (canvas !== next) {
        canvas?.removeEventListener("webglcontextlost", lost);
        canvas = next;
        canvas.addEventListener("webglcontextlost", lost);
      }
      onStatus("ready");
    };
    const observer = new MutationObserver(inspect);
    observer.observe(element, { subtree:true, childList:true, attributes:true, attributeFilter:["width", "height"] });
    inspect();
    return () => { observer.disconnect(); canvas?.removeEventListener("webglcontextlost", lost); };
  }, [supported, onStatus]);

  const shared = { width:"100%", height:"100%", minPixelRatio:1, maxPixelCount:1_400_000, frame:12000, className:"hero-lab-shader-canvas" };
  return <div ref={host} className={`hero-lab-art hero-lab-art-${concept}`} aria-hidden="true">
    {supported && <>
      {concept === "grain" && <GrainGradient {...shared} colors={GRAIN_COLORS} colorBack="#f4f4f2" shape="wave" softness={0.55} intensity={0.35} noise={0.12} scale={0.7} rotation={-18} speed={running ? 0.8 : 0} />}
      {concept === "silk" && <Warp {...shared} colors={SILK_COLORS} shape="edge" shapeScale={0.6} softness={0.85} proportion={0.3} distortion={0.18} swirl={0.48} swirlIterations={5} scale={1.3} rotation={-25} speed={running ? 1.2 : 0} />}
      {concept === "rays" && <GodRays {...shared} colors={RAY_COLORS} colorBack="#f4f4f2" colorBloom="#f4f4f2" bloom={0} intensity={0.75} density={0.26} spotty={0.28} midSize={0} midIntensity={0} offsetX={-0.35} offsetY={-0.9} rotation={-12} scale={1} speed={running ? 0.85 : 0} />}
      {concept === "dither" && <Dithering {...shared} colorBack="#f4f4f2" colorFront="#a5bac5" shape="ripple" type="4x4" size={1.2} scale={0.65} offsetY={0.45} rotation={-18} speed={running ? 0.65 : 0} />}
    </>}
    <div className="hero-lab-reading-veil" />
  </div>;
}
