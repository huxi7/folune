/**
 * [INPUT]: 依赖 LandingMotion/grainMaterial 的连续场/颗粒采样和 Paper 的时钟/分辨率
 * [OUTPUT]: 对外提供 01B 墨岸构图 shader；密度、边缘与速度独立可调
 * [POS]: 替代 01A 的均匀云场，固定左上主墨面与右下浅呼应，阅读区在密度场内留白
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { grainMaterialGLSL } from "../LandingMotion/grainMaterial";

export const inkBFragmentShader = `#version 300 es
precision highp float;
uniform float u_time;
uniform mediump vec2 u_resolution;
uniform vec2 u_cssSize;
uniform float u_grain;
uniform float u_patternScale;
uniform float u_density;
uniform float u_disorder;
uniform float u_seed;
uniform vec2 u_position;
uniform float u_angle;
uniform float u_softness;
uniform float u_clear;
uniform vec4 u_readingBox;
out vec4 fragColor;
${grainMaterialGLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1. - uv.y;
  vec2 px = uv * u_cssSize;
  float unit = min(u_cssSize.x, 1120.);
  vec2 p = (px - .5 * u_cssSize) / max(unit, 1.);
  float angle = radians(u_angle);
  p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
  p = p / u_patternScale - u_position * .45;
  float t = (u_time - 12.) * .85;

  // 主墨面的位置不随随机场漂走；连续噪声只塑造其边缘与内部着墨。
  vec2 drift = vec2(t * .16, -.11 * t);
  vec2 bend = vec2(field(p * 2.6 + drift + 3.), field(p * 2.4 - drift * .7 + 9.));
  vec2 warped = p + (bend - .48) * (.12 + .35 * u_disorder);
  float boundary = -.13 + .075 * sin(warped.x * 5.2 + .65 * t)
    + .038 * sin(warped.x * 9. + 1.3 - .4 * t);
  float edgeWidth = mix(.065, .27, u_softness);
  float mainInk = 1. - smoothstep(boundary - edgeWidth, boundary + edgeWidth, warped.y + .48 * warped.x);
  float shoulder = exp(-pow((warped.x + .28) / .65, 2.));
  mainInk *= .6 + .4 * shoulder;

  // 右下方较浅的呼应始终从属于主墨面，不产生对称双焦点。
  vec2 echoPoint = warped - vec2(.46 + .028 * sin(t * .7), .28);
  float echo = exp(-dot(echoPoint / vec2(.38, .18), echoPoint / vec2(.38, .18))) * .22;
  float mottling = field(p * 7. + bend * 1.1 + drift * .38);
  float ink = clamp(mainInk * (.57 + .48 * mottling) + echo, 0., 1.);

  // 按真实文案/按钮矩形做柔边减墨，不覆盖一块白色光斑。
  vec2 readCenter = .5 * (u_readingBox.xy + u_readingBox.zw);
  vec2 readHalf = .5 * (u_readingBox.zw - u_readingBox.xy);
  vec2 d = max(abs(px - readCenter) - readHalf, 0.);
  float reading = 1. - smoothstep(0., 135., length(d));
  ink *= 1. - reading * u_clear;
  ink *= smoothstep(0., .07, uv.y) * (1. - smoothstep(.78, 1., uv.y));
  ink *= mix(.42, 1., smoothstep(0., .14, min(uv.x, 1. - uv.x)));

  float pitch = max(.75, u_grain);
  vec2 material = (px + vec2(-3.4, 1.2) * (u_time - 12.)) / pitch;
  vec2 footprint = u_cssSize / u_resolution;
  float aa = clamp(.6 * max(footprint.x, footprint.y) / pitch, .035, .4);
  float coverage = clamp(ink * u_density * 1.65, .001, .96);
  float dots = grains(material, coverage, ink, aa);
  // 宽阔墨面是主形，颗粒是其着墨方式；空白处不铺一层等浓噪点。
  float amount = (.29 * ink + .71 * dots) * smoothstep(0., .12, ink);
  vec3 paper = vec3(244., 244., 242.) / 255.;
  vec3 pigment = vec3(68., 101., 126.) / 255.;
  fragColor = vec4(mix(paper, pigment, amount), 1.);
}
`;
