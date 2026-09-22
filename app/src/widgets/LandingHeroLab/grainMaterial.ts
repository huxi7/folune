/**
 * [INPUT]: 依赖调用方声明 u_seed，坐标与时间由各方案独立提供
 * [OUTPUT]: 对外提供连续场噪声和邻格颗粒覆盖的 GLSL 公共函数
 * [POS]: 01A/01B 共用材质采样，不规定构图或速度，避免两版算法修正漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const grainMaterialGLSL = `// ---- 连续大尺度场与确定种子的微粒分开采样 ----
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
`;
