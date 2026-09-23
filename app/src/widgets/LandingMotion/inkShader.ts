/**
 * [INPUT]: 依赖 Paper ShaderMount 的时间/分辨率、grainMaterial 公共采样与调用方 uniforms
 * [OUTPUT]: 对外提供散墨/薄雾共用的连续形变与细颗粒缓移 WebGL2 fragment shader
 * [POS]: 登录背景与 Lab 01A/历史 04 共用的纯算法；不依赖实验页状态，调用方决定速度与浓淡
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { grainMaterialGLSL } from "./grainMaterial";

export const inkFragmentShader = `#version 300 es
precision highp float;
uniform float u_time;
uniform mediump vec2 u_resolution;
uniform vec2 u_cssSize;
uniform float u_mode;
uniform float u_grain;
uniform float u_patternScale;
uniform float u_density;
uniform float u_disorder;
uniform float u_seed;
uniform vec2 u_position;
uniform float u_angle;
out vec4 fragColor;

${grainMaterialGLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1. - uv.y;
  vec2 px = uv * u_cssSize;
  float unit = min(u_cssSize.x, 920.);
  vec2 p = (px - .5 * u_cssSize) / max(unit, 1.);
  float a = radians(u_angle);
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  p = p * (3.2 / u_patternScale) + u_position + vec2(3.1, 7.2);
  // Paper 已按 speed 推进 u_time；保留原 12s 初始构图，后续不再过度降速。
  float elapsed = u_time - 12.;
  float t = 1.92 + elapsed * .72;
  vec2 drift = vec2(.34 * t, -.21 * t);
  vec2 q = vec2(field(p + drift), field(p + vec2(5.7, 2.4) - drift * .73));
  float n = field(p + (q - .5) * (1.1 + 3.8 * u_disorder) + vec2(-.12 * t, .18 * t));
  float ink;
  if (u_mode < .5) {
    // ---- 墨面通过颗粒覆盖率显形，没有镜面高光或绸面色带 ----
    ink = smoothstep(.23, .73, n + .16 * sin(p.y * 1.6 + q.x * 3. + t * .28));
  } else {
    // ---- 拉开薄雾的疏密变化，避免所有时刻都退化成近似均匀的浅点 ----
    ink = smoothstep(.29, .65, .65 * n + .35 * q.y);
  }
  float pitch = max(.75, u_grain);
  // 平移同一片材质而不是每帧换噪点；默认约 1px/s，速度归同一个时间控制。
  vec2 material = (px + vec2(-5., 2.) * elapsed) / pitch;
  vec2 footprint = u_cssSize / u_resolution;
  float aa = clamp(.6 * max(footprint.x, footprint.y) / pitch, .035, .4);
  float densityGain = u_mode < .5 ? 1.5 : 1.9;
  float coverage = clamp((.1 + ink * .85) * u_density * densityGain, .02, .95);
  float amount = grains(material, coverage, ink, aa);
  if (u_mode < .5) amount = .12 * ink + .88 * amount;
  else amount *= .9;
  vec3 paper = vec3(244., 244., 242.) / 255.;
  vec3 pigment = vec3(57., 88., 117.) / 255.;
  fragColor = vec4(mix(paper, pigment, clamp(amount, 0., 1.)), 1.);
}
`;
