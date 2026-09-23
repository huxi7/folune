/**
 * [INPUT]: 依赖 Paper 0.0.80 的 ShaderMount/GrainGradient/Dithering/Warp、LandingMotion 共用散墨 GLSL、本地 B GLSL 与参数协议
 * [OUTPUT]: 对外提供 01A/01B/02A/02B、历史配置背景、运行状态及连续时间
 * [POS]: Lab 的单画布装配边界；遮罩负责阅读区，参数变更只更新 uniforms，不重建上下文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import { GrainGradient, Warp, Dithering, ShaderMount } from "@paper-design/shaders-react";
import type { PaperShaderElement } from "@paper-design/shaders";
import { getShaderNoiseTexture } from "@paper-design/shaders";
import { inkFragmentShader } from "../LandingMotion/inkShader";
import { inkBFragmentShader } from "./inkBShader";
import { paperBFragmentShader } from "./paperBShader";
import { isRedesigned, isVariant } from "./presets";
import type { Choice, Snapshot } from "./presets";

export type ShaderStatus = "loading" | "ready" | "unavailable";
export type ArtworkHandle = { getFrame: () => number; setFrame: (frame: number) => void };
const PAPER = "#f4f4f2";
const ORIGINAL_GRAIN = ["#7695ab", "#c5d2d7", "#e5e4db"];
const ORIGINAL_SILK = [PAPER, "#8ba7ba", "#e0e6e6", "#b2c5ce"];
const NEW_GRAIN = ["#7c96a6", "#b8c6cb", PAPER];

export function HeroArtwork({ snapshot, running, onStatus, ref }: {
  snapshot: Snapshot; running: boolean; onStatus: (status: ShaderStatus) => void; ref?: Ref<ArtworkHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const shader = useRef<PaperShaderElement>(null);
  const [supported, setSupported] = useState(false);
  const [size, setSize] = useState([1440, 600]);
  const [readingBox, setReadingBox] = useState([490, 200, 950, 400]);
  const [attempt, setAttempt] = useState(0);
  const { choice, params: p, frame } = snapshot;
  const original = !isVariant(choice);
  useImperativeHandle(ref, () => ({
    getFrame: () => shader.current?.paperShaderMount?.getCurrentFrame() ?? frame,
    setFrame: value => shader.current?.paperShaderMount?.setFrame(value),
  }), [frame]);

  useEffect(() => {
    let context: WebGL2RenderingContext | null = null;
    try { context = document.createElement("canvas").getContext("webgl2"); } catch { /* 保留纸色备用面 */ }
    setSupported(Boolean(context));
    if (!context) onStatus("unavailable");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, [onStatus]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      setSize(previous => previous[0] === box.width && previous[1] === box.height ? previous : [box.width, box.height]);
      const blocks = [...(node.parentElement?.querySelectorAll(".landing-hero-copy,.grain-lab-actions") ?? [])].map(element => element.getBoundingClientRect());
      if (blocks.length) {
        const next = [Math.min(...blocks.map(rect => rect.left)) - box.left - 14,
          Math.min(...blocks.map(rect => rect.top)) - box.top - 16,
          Math.max(...blocks.map(rect => rect.right)) - box.left + 14,
          Math.max(...blocks.map(rect => rect.bottom)) - box.top + 16];
        setReadingBox(previous => previous.every((value, i) => value === next[i]) ? previous : next);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.parentElement?.querySelectorAll(".landing-hero-copy,.grain-lab-actions").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!supported) return;
    onStatus("loading");
    let canvas: HTMLCanvasElement | null = null;
    let timer = 0;
    let tries = 0;
    const lost = (event: Event) => { event.preventDefault(); onStatus("unavailable"); };
    const restored = () => setAttempt(value => value + 1);
    const inspect = () => {
      const next = host.current?.querySelector("canvas") ?? null;
      if (next !== canvas) {
        canvas?.removeEventListener("webglcontextlost", lost);
        canvas?.removeEventListener("webglcontextrestored", restored);
        canvas = next;
        canvas?.addEventListener("webglcontextlost", lost);
        canvas?.addEventListener("webglcontextrestored", restored);
      }
      // ---- 确认链接成功；仅出现 canvas 不等于 shader 已就绪 ----
      const gl = canvas?.getContext("webgl2");
      const program = gl?.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
      if (gl && program && gl.getProgramParameter(program, gl.LINK_STATUS) && (canvas?.width ?? 0) > 1) onStatus("ready");
      else if (++tries < 40) timer = window.setTimeout(inspect, 200);
      else onStatus("unavailable");
    };
    timer = window.setTimeout(inspect, 100);
    return () => {
      window.clearTimeout(timer);
      canvas?.removeEventListener("webglcontextlost", lost);
      canvas?.removeEventListener("webglcontextrestored", restored);
    };
  }, [supported, choice, attempt, onStatus]);

  const uniforms = useMemo(() => ({
    u_cssSize: size, u_mode: choice === "mist" ? 1 : 0,
    u_grain: p.grain, u_patternScale: p.scale, u_density: p.density,
    u_disorder: p.disorder, u_seed: p.seed, u_position: [p.x, p.y], u_angle: p.rotation,
  }), [size, choice, p]);
  const inkBUniforms = useMemo(() => {
    const { u_mode: _unused, ...common } = uniforms;
    return { ...common, u_softness: p.softness, u_clear: p.clear, u_readingBox: readingBox };
  }, [uniforms, p.softness, p.clear, readingBox]);
  const paperBUniforms = useMemo(() => ({
    u_cssSize: size, u_readingBox: readingBox, u_clear: p.clear, u_grainSize: p.grain,
    u_colorBack: [244 / 255, 244 / 255, 242 / 255, 1],
    // 深墨/浅灰蓝/纸色是同一印刷色系，保留两层不同浓度。
    u_colors: [[80 / 255, 113 / 255, 135 / 255, 1], [178 / 255, 196 / 255, 203 / 255, 1], [244 / 255, 244 / 255, 242 / 255, 1]],
    u_colorsCount: 3, u_softness: p.softness, u_intensity: p.disorder * .5,
    u_noise: p.noise, u_shape: 1, u_noiseTexture: getShaderNoiseTexture(),
    u_fit: 0, u_scale: p.scale, u_rotation: p.rotation, u_offsetX: p.x, u_offsetY: p.y,
    u_originX: .5, u_originY: .5, u_worldWidth: 0, u_worldHeight: 0,
  }), [size, readingBox, p]);
  const shared = { ref: shader, width: "100%", height: "100%", minPixelRatio: 1, maxPixelCount: 1_400_000, frame, className: "grain-lab-canvas" };
  const style = { "--grain-strength": original ? 1 : p.strength, "--grain-clear": original ? 0.93 : p.clear } as CSSProperties;
  return <div ref={host} className="grain-lab-art" data-choice={choice} data-original={original} data-composed={isRedesigned(choice)} aria-hidden="true" style={style}>
    <div className="grain-lab-pigment">
      {supported && (choice === "ink-b" ? <ShaderMount key={`ink-b-${attempt}`} {...shared} fragmentShader={inkBFragmentShader} uniforms={inkBUniforms} speed={running ? p.speed : 0} />
        : choice === "paper-b" ? <ShaderMount key={`paper-b-${attempt}`} {...shared} fragmentShader={paperBFragmentShader} uniforms={paperBUniforms} speed={running ? p.speed : 0} />
          : <ShaderChoice key={`${choice}-${attempt}`} choice={choice} snapshot={snapshot} shared={shared} uniforms={uniforms} running={running} />)}
    </div>
    <div className="grain-lab-reading-veil" />
  </div>;
}

type SharedProps = { ref: Ref<PaperShaderElement>; width: string; height: string; minPixelRatio: number; maxPixelCount: number; frame: number; className: string };
function ShaderChoice({ choice, snapshot, shared, uniforms, running }: {
  choice: Choice; snapshot: Snapshot; shared: SharedProps; uniforms: Record<string, number | number[]>; running: boolean;
}) {
  const p = snapshot.params;
  if (choice === "grain") return <GrainGradient {...shared} colors={ORIGINAL_GRAIN} colorBack={PAPER} shape="wave" softness={0.55} intensity={0.35} noise={0.12} scale={0.7} rotation={-18} speed={running ? 0.8 : 0} />;
  if (choice === "silk") return <Warp {...shared} colors={ORIGINAL_SILK} shape="edge" shapeScale={0.6} softness={0.85} proportion={0.3} distortion={0.18} swirl={0.48} swirlIterations={5} scale={1.3} rotation={-25} speed={running ? 1.2 : 0} />;
  if (choice === "dither") return <Dithering {...shared} colorBack={PAPER} colorFront="#a5bac5" shape="ripple" type="4x4" size={1.2} scale={0.65} offsetY={0.45} rotation={-18} speed={running ? 0.65 : 0} />;
  if (choice === "paper") return <GrainGradient {...shared} colors={NEW_GRAIN} colorBack={PAPER} shape="wave" softness={0.8} intensity={p.disorder * 0.5} noise={0.19} scale={p.scale} rotation={p.rotation} offsetX={p.x} offsetY={p.y} speed={running ? p.speed : 0} />;
  if (choice === "print") return <Dithering {...shared} colorBack={PAPER} colorFront="#7894a7" shape="warp" type="4x4" size={p.grain} scale={p.scale} rotation={p.rotation} offsetX={p.x} offsetY={p.y} speed={running ? p.speed : 0} />;
  return <ShaderMount {...shared} fragmentShader={inkFragmentShader} uniforms={uniforms} speed={running ? p.speed : 0} />;
}
