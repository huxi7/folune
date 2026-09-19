/**
 * [INPUT]: 依赖 Paper ShaderMount 的时间/分辨率与 Lab 的 CSS 尺寸、构图、颗粒参数
 * [OUTPUT]: 对外提供散墨/薄雾共用的连续形变与细颗粒缓移 WebGL2 fragment shader
 * [POS]: 局部材质算法；确定种子的微粒随连续坐标缓移，墨面独立形变，不逐帧随机刷新或复制第三方 GLSL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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

// ---- 连续大尺度场与确定种子的微粒分开采样 ----
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33 + u_seed * .013);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
    mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
}
float field(vec2 p) {
  float value = 0.;
  float weight = .57;
  mat2 r = mat2(.8, -.6, .6, .8);
  for (int i = 0; i < 3; i++) {
    value += weight * noise(p);
    p = r * p * 2.03 + vec2(7.3, 2.9);
    weight *= .47;
  }
  return value;
}

// ---- 邻格合成保持颗粒跨格移动连续，像素覆盖宽度不随哈希边界跳变 ----
float grains(vec2 coord, float coverage, float ink, float aa) {
  vec2 base = floor(coord - .5);
  vec2 local = coord - base;
  float amount = 0.;
  for (int y = 0; y < 2; y++) {
    for (int x = 0; x < 2; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 cell = base + offset;
      vec2 center = offset + vec2(hash(cell + 17.), hash(cell + 91.)) * .24 + .38;
      float random = hash(cell + 53.);
      float radius = mix(.12, .35, coverage) * mix(.82, 1., random);
      float dotInk = 1. - smoothstep(radius - aa, radius + aa, length(local - center));
      float deposit = smoothstep(random - .22, random + .22, coverage + .18);
      amount += dotInk * mix(.3, 1., ink) * mix(.72, 1., random) * deposit;
    }
  }
  return clamp(amount, 0., 1.);
}
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
