/**
 * [INPUT]: 依赖 React 的 useEffect/useRef/useState 与 ../useMotionPreference 的减少动态偏好；运行期从宿主解析 index.css 的 --primary 系列 token 构建光色，不硬编码颜色值
 * [OUTPUT]: 对外提供 ShaderGlow 组件（自持 WebGL2 光线步进 canvas 的编译、RAF、统一可见性调度、尺寸重绘、上下文恢复与销毁清理）与 ShaderGlowProps 类型
 * [POS]: app/src/shared/design-system/components 的唯一 GPU 光效原语，被 GlowButton 作为按钮的流光层消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "../useMotionPreference";

export type ShaderGlowProps = {
  className?: string;
  // 显式光色停靠点; 省略时从宿主元素解析品牌 --primary 系列 token
  colors?: string[];
  // 0 平面旋转, 1 自动 3D 旋转(默认, 与来源同), 2 跟随指针倾斜
  animType?: 0 | 1 | 2;
  speed?: number;
  intensity?: number;
  distort?: number;
  rayCount?: number;
  noiseAmount?: number;
  // canvas backing store 相对 CSS 尺寸的采样比; 0.5 = 半分辨率, 交给外层 blur 糊成流光
  resolutionScale?: number;
};

const VERTEX_SHADER = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

// 保留来源光线步进算法；反向 smoothstep 改为合法边界，避免跨 GPU 未定义结果。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;

uniform float uIntensity;
uniform float uSpeed;
uniform int   uAnimType;
uniform vec2  uMouse;
uniform int   uColorCount;
uniform float uDistort;
uniform vec2  uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int   uRayCount;

float hash21(vec2 p){
    p = floor(p);
    float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
    return fract(f);
}

mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

float layeredNoise(vec2 fragPx){
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    float n = 0.0;
    n += 0.40 * hash21(q);
    n += 0.25 * hash21(q * 2.0 + 17.0);
    n += 0.20 * hash21(q * 4.0 + 47.0);
    n += 0.10 * hash21(q * 8.0 + 113.0);
    n += 0.05 * hash21(q * 16.0 + 191.0);
    return n;
}
vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist){
    float focal = res.y * max(dist, 1e-3);
    return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset){
    vec2 toC = frag - 0.5 * res - offset;
    float r = length(toC) / (0.5 * min(res.x, res.y));
    float x = clamp(r, 0.0, 1.0);
    float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    float s = q * 0.5;
    s = pow(s, 1.5);
    float tail = 1.0 - pow(1.0 - s, 2.0);
    s = mix(s, tail, 0.2);
    float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
    return clamp(s + dn, 0.0, 1.0);
}

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t){
    t = clamp(t, 0.0, 1.0);
    return texture(uGradient, vec2(t, 0.5)).rgb;
}

vec2 rot2(vec2 v, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
}

float bendAngle(vec3 q, float t){
    float a = 0.8 * sin(q.x * 0.55 + t * 0.6)
            + 0.7 * sin(q.y * 0.50 - t * 0.5)
            + 0.6 * sin(q.z * 0.60 + t * 0.7);
    return a;
}
void main(){
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
    vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
    float marchT = 0.0;
    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

    mat3 rot3dMat = mat3(1.0);
    if(uAnimType == 1){
      vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
      rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
    }
    mat3 hoverMat = mat3(1.0);
    if(uAnimType == 2){
      vec2 m = uMouse * 2.0 - 1.0;
      vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
      hoverMat = rotY(ang.y) * rotX(ang.x);
    }

    for (int i = 0; i < 6; ++i) {
        vec3 P = marchT * dir;
        P.z -= 2.0;
        float rad = length(P);
        vec3 Pl = P * (10.0 / max(rad, 1e-6));

        if(uAnimType == 0){
            Pl.xz *= M2;
        } else if(uAnimType == 1){
      Pl = rot3dMat * Pl;
        } else {
      Pl = hoverMat * Pl;
        }

        float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;
        float grow = smoothstep(0.35, 3.0, marchT);
        float a1 = amp * grow * bendAngle(Pl * 0.6, t);
        float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
        vec3 Pb = Pl;
        Pb.xz = rot2(Pb.xz, a1);
        Pb.xy = rot2(Pb.xy, a2);

        float rayPattern = smoothstep(
            0.5, 0.7,
            sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
            sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
        );

        if (uRayCount > 0) {
            float ang = atan(Pb.y, Pb.x);
            float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
            comb = pow(comb, 3.0);
            rayPattern *= smoothstep(0.15, 0.95, comb);
        }

        vec3 spectralDefault = 1.0 + vec3(
            cos(marchT * 3.0 + 0.0),
            cos(marchT * 3.0 + 1.0),
            cos(marchT * 3.0 + 2.0)
        );

        float tRay = fract(marchT * 0.8);
        vec3 userGradient = 2.0 * sampleGradient(tRay);
        vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
        vec3 base = (0.05 / (0.4 + stepLen))
                  * (1.0 - smoothstep(0.0, 5.0, rad))
                  * spectral;

        col += base * rayPattern;
        marchT += stepLen;
    }

    col *= edgeFade(frag, uResolution, uOffset);
    col *= uIntensity;

    float luminance = dot(col, vec3(0.299, 0.587, 0.114));
    float alpha = clamp(luminance, 0.0, 1.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}`;

// ---- 颜色解析: 把 CSS 颜色字符串解成 0-255 RGB, 零第三方依赖 ----
type RGB = [number, number, number];

function parseColor(input: string): RGB | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1] ?? "";
    if (h.length === 3) {
      const r = h[0] ?? "0";
      const g = h[1] ?? "0";
      const b = h[2] ?? "0";
      return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(s);
  if (rgb) {
    const raw = (rgb[1] ?? "")
      .split(/[,\s/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number);
    if (raw.length === 3 && raw.every((v) => Number.isFinite(v))) {
      return [raw[0] ?? 0, raw[1] ?? 0, raw[2] ?? 0];
    }
  }
  return null;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

// 从宿主解析品牌墨蓝, 派生 深->主->亮->白 的 6 段发光渐变 (深浅主题各自解析)
function resolveBrandRamp(host: HTMLElement): RGB[] {
  const cs = getComputedStyle(host);
  const primary: RGB = parseColor(cs.getPropertyValue("--primary")) ?? [57, 88, 117];
  return [
    mix(primary, BLACK, 0.18),
    mix(primary, BLACK, 0.06),
    primary,
    mix(primary, WHITE, 0.32),
    mix(primary, WHITE, 0.62),
    mix(primary, WHITE, 0.9),
  ];
}

// 停靠点线性插值成 width×1 的 RGBA 像素, 作为 uGradient 纹理
function buildGradientPixels(stops: RGB[], width: number): Uint8Array {
  const px = new Uint8Array(width * 4);
  const n = stops.length;
  for (let i = 0; i < width; i++) {
    const t = n === 1 ? 0 : (i / (width - 1)) * (n - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, n - 1);
    const c = mix(stops[i0] ?? BLACK, stops[i1] ?? BLACK, t - i0);
    px[i * 4 + 0] = c[0];
    px[i * 4 + 1] = c[1];
    px[i * 4 + 2] = c[2];
    px[i * 4 + 3] = 255;
  }
  return px;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
export function ShaderGlow({
  className = "",
  colors,
  animType = 1,
  speed = 0.4,
  intensity = 15,
  distort = 30,
  rayCount = 18,
  noiseAmount = 0.8,
  resolutionScale = 0.5,
}: ShaderGlowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useMotionPreference();
  // WebGL context 丢失后自增, 强制整段重建
  const [generation, setGeneration] = useState(0);
  // 用稳定字符串代表颜色数组, 避免新数组身份每帧重建 context
  const colorsKey = colors ? colors.join("|") : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // 静态/暂停时保留最后一帧，避免合成器清空透明 drawing buffer。
      preserveDrawingBuffer: true,
    });
    if (!gl) return; // 无 WebGL2 时由消费方保留静态柔光。
    let disposed = false;
    let stop = () => {};
    const onLost = (event: Event) => {
      event.preventDefault();
      stop();
    };
    const onRestored = () => {
      if (!disposed) setGeneration((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const detach = () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
    if (gl.isContextLost()) return detach;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    const releaseProgram = () => {
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    };
    if (!vs || !fs || !program) {
      releaseProgram();
      return detach;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "position");
    gl.bindAttribLocation(program, 1, "uv");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      releaseProgram();
      return detach;
    }
    gl.useProgram(program);
    // ---- 全屏四边形 (三角带四点: x, y, u, v) ----
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      if (vao) gl.deleteVertexArray(vao);
      if (buffer) gl.deleteBuffer(buffer);
      releaseProgram();
      return detach;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const quad = new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      1, 1, 1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    // ---- 渐变纹理: 显式 colors 优先, 否则解析品牌 token ----
    const explicit = colorsKey ? colorsKey.split("|") : [];
    const stops = explicit
      .map(parseColor)
      .filter((c): c is RGB => c !== null);
    const useBrandRamp = stops.length === 0;
    const ramp = useBrandRamp ? resolveBrandRamp(canvas) : stops;
    const texture = gl.createTexture();
    if (!texture) {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      releaseProgram();
      return detach;
    }
    const GRAD_W = 64;
    let colorCount = ramp.length;
    const uploadGradient = (r: RGB[]) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRAD_W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildGradientPixels(r, GRAD_W));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    uploadGradient(ramp);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uResolution = u("uResolution");
    const uTime = u("uTime");
    const uColorCount = u("uColorCount");
    gl.uniform1f(u("uIntensity"), intensity);
    gl.uniform1f(u("uSpeed"), speed);
    gl.uniform1i(u("uAnimType"), animType);
    gl.uniform2f(u("uMouse"), 0.5, 0.5);
    gl.uniform1i(uColorCount, colorCount);
    gl.uniform1f(u("uDistort"), distort);
    gl.uniform2f(u("uOffset"), 0, 0);
    gl.uniform1f(u("uNoiseAmount"), noiseAmount);
    gl.uniform1i(u("uRayCount"), rayCount);
    gl.uniform1i(u("uGradient"), 0);
    gl.disable(gl.BLEND); // 单个覆盖全屏的 quad, alpha 交给浏览器与下层底色合成
    // ---- 绘制调度：尺寸来自布局，不随按压 transform 改写 backing store ----
    const sampleScale = Number.isFinite(resolutionScale) && resolutionScale > 0
      ? resolutionScale : 0.5;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    let seconds = 6;
    let lastFrame: number | null = null;
    let raf = 0;
    let intersecting = false;
    const drawable = () => !disposed && !gl.isContextLost() && width > 0 && height > 0;
    const draw = () => {
      if (!drawable()) return;
      const w = Math.max(1, Math.round(width * sampleScale));
      const h = Math.max(1, Math.round(height * sampleScale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uResolution, w, h);
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const shouldAnimate = () => drawable() && intersecting && !document.hidden && !reducedMotion;
    const pause = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = null;
    };
    stop = pause;
    const loop = (now: number) => {
      raf = 0;
      if (!shouldAnimate()) { lastFrame = null; return; }
      if (lastFrame !== null) seconds += (now - lastFrame) / 1000;
      lastFrame = now;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const syncPlayback = () => {
      if (!shouldAnimate()) { pause(); return; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    // 首帧直接绘制，避免等 observer/RAF 才出现；减少动态也走同一重绘路径。
    draw();
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries.find((item) => item.target === canvas);
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      draw();
      syncPlayback();
    });
    resizeObserver.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      if (disposed) return;
      const entry = entries.find((item) => item.target === canvas);
      if (!entry) return;
      intersecting = entry.isIntersecting;
      if (intersecting) draw();
      syncPlayback();
    });
    io.observe(canvas);
    const onVisibility = () => {
      if (!document.hidden && intersecting) draw();
      syncPlayback();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // 仅自动取色时: 主题切换重建渐变, 不重建整个 context
    let themeObserver: MutationObserver | null = null;
    if (useBrandRamp) {
      themeObserver = new MutationObserver(() => {
        if (disposed || gl.isContextLost()) return;
        const next = resolveBrandRamp(canvas);
        uploadGradient(next);
        if (next.length !== colorCount) {
          colorCount = next.length;
          gl.uniform1i(uColorCount, colorCount);
        }
        draw();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class", "style"],
      });
    }

    return () => {
      detach();
      pause();
      io.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver?.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      releaseProgram();
      // 不调用 WEBGL_lose_context.loseContext(): StrictMode 会 mount→cleanup→mount,
      // 在同一 canvas 上强制丢失 context 会让第二次(常驻)挂载拿到已死的 context 而静默降级;
      // context 随 canvas 卸载自然回收即可
    };
  }, [
    generation,
    reducedMotion,
    colorsKey,
    animType,
    speed,
    intensity,
    distort,
    rayCount,
    noiseAmount,
    resolutionScale,
  ]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
