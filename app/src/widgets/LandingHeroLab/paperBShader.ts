/**
 * [INPUT]: 依赖 Paper Shaders 0.0.80 导出的 GrainGradient GLSL 和其材质 uniforms
 * [OUTPUT]: 对外提供 02B 的改造 shader，保留官方纸粒/颜色算法，替换 wave 场形
 * [POS]: 有限源码适配；两个慢变边界替代全幅正弦往返，阅读区与下沿在场内收束
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 * Paper Shaders Copyright 2026 Paper · Apache-2.0；改动记录见 THIRD_PARTY.md
 */
import { grainGradientFragmentShader } from "@paper-design/shaders";

// ---- 精确锚定已安装版本；升级造成源码结构改变时明确失败，不能悄悄退回原 wave ----
function replaceOnce(source: string, before: string, after: string) {
  if (source.split(before).length !== 2) throw new Error("Paper 02B shader adapter requires Paper Shaders 0.0.80 source.");
  return source.replace(before, after);
}
const originalWave = `float wave = cos(.5 * shape_uv.x - 4. * t) * sin(1.5 * shape_uv.x + 2. * t) * (.75 + .25 * cos(6. * t));
    shape = 1. - smoothstep(-1., 1., shape_uv.y + wave);`;
const composedField = `
    // ---- 有方向的主墨面 + 低浓度底层；没有整片同步收缩/扩张 ----
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1. - uv.y;
    vec2 p = (uv * u_cssSize - .5 * u_cssSize) / min(u_cssSize.x, 1120.);
    float a = radians(u_rotation);
    p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
    p = p / u_scale - vec2(u_offsetX, u_offsetY) * .45;
    float phase = (u_time - 12.) * .65;
    float drift = .052 * sin(p.x * 4.2 + phase)
      + .028 * sin(p.x * 8.4 - phase * .61 + 1.7);
    float edge = p.y + .44 * p.x + .04 + drift;
    float width = mix(.055, .21, u_softness);
    float foreground = 1. - smoothstep(-width, width, edge);
    float backEdge = p.y - .28 * p.x - .1 + .06 * sin(p.x * 3.7 - phase * .47 + 2.);
    float underprint = smoothstep(-.18, .2, backEdge);
    float leftWeight = .7 + .3 * (1. - smoothstep(-.3, .65, p.x));
    shape = .08 + .49 * foreground * leftWeight + .16 * underprint;
    shape += .035 * snoise(p * 3.1 + vec2(phase * .19, -phase * .13));
`;
const declarations = `uniform mediump vec2 u_cssSize;
uniform mediump vec4 u_readingBox;
uniform float u_clear;
uniform float u_grainSize;
`;
let source = replaceOnce(grainGradientFragmentShader, "uniform float u_shape;", "uniform float u_shape;\n" + declarations);
source = replaceOnce(source, "precision lowp float;", "precision highp float;");
for (const name of ["v_objectUV", "v_patternUV", "v_objectBoxSize", "v_patternBoxSize"]) {
  source = replaceOnce(source, `in vec2 ${name};`, `in mediump vec2 ${name};`);
}
source = replaceOnce(source, originalWave, composedField);
// 纸粒用 CSS 像素取样，Hero 变高时不把微观材质一同拉大。
source = replaceOnce(source, "float baseNoise = snoise(grain_uv * .5);", `grain_uv = gl_FragCoord.xy / u_resolution * u_cssSize * 1.6 / u_grainSize;
  float baseNoise = snoise(grain_uv * .5);`);
source = replaceOnce(source, "float aa = fwidth(shape);", `
  vec2 readPx = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution * u_cssSize;
  vec2 readCenter = .5 * (u_readingBox.xy + u_readingBox.zw);
  vec2 readHalf = .5 * (u_readingBox.zw - u_readingBox.xy);
  float reading = 1. - smoothstep(0., 130., length(max(abs(readPx - readCenter) - readHalf, 0.)));
  shape = mix(shape, .08, reading * u_clear);
  float y = readPx.y / u_cssSize.y;
  shape = mix(.08, shape, smoothstep(0., .06, y) * (1. - smoothstep(.82, 1., y)));
  float aa = fwidth(shape);`);
export const paperBFragmentShader = source;
