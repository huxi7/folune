/**
 * [INPUT]: 依赖已安装的 Paper Shaders GrainGradient/Warp、React 生命周期与首屏播放状态
 * [OUTPUT]: 对外提供两种真实 WebGL2 Shader 背景与运行/失败反馈
 * [POS]: 独立首屏 Demo 的背景组件；直接使用库组件，局部参数控制蓝灰色场，单实例且不修改正式展示背景
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { GrainGradient, Warp } from "@paper-design/shaders-react";

export type ShaderConcept = "grain" | "silk";
export type ShaderStatus = "loading" | "ready" | "unavailable";

const GRAIN_COLORS = ["#7695ab", "#c5d2d7", "#e5e4db"];
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
    {supported && (concept === "grain" ?
      <GrainGradient {...shared} colors={GRAIN_COLORS} colorBack="#f4f4f2" shape="wave" softness={0.55} intensity={0.35} noise={0.12} scale={0.7} rotation={-18} speed={running ? 0.8 : 0} /> :
      <Warp {...shared} colors={SILK_COLORS} shape="edge" shapeScale={0.6} softness={0.85} proportion={0.3} distortion={0.18} swirl={0.48} swirlIterations={5} scale={1.3} rotation={-25} speed={running ? 1.2 : 0} />)}
    <div className="hero-lab-reading-veil" />
  </div>;
}
