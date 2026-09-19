/**
 * [INPUT]: 依赖已核实的 Paper 0.0.80 参数范围与本轮颗粒材质约定
 * [OUTPUT]: 对外提供四版默认值、A/B/D 原始参照和可校验的本地配置协议
 * [POS]: Lab 的参数真相源；控制面板、背景与配置恢复共读，不进入生产入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const variants = [
  { id: "ink", code: "01", name: "散墨流变", subtitle: "不规则的流动，细墨粒的表面", description: "薄墨缓慢舒展，边缘轻微参差。保留 B 的自然形变，让颗粒本身承载明暗。", source: "Paper ShaderMount · 局部颗粒 Shader" },
  { id: "paper", code: "02", name: "纸墨呼吸", subtitle: "更柔软，更接近纸面", description: "延续 A 的细颗粒，宽阔的明暗缓慢起伏；色场与纸色相融，轮廓更轻。", source: "Paper GrainGradient · wave" },
  { id: "print", code: "03", name: "游移网点", subtitle: "网点有序，形态自然", description: "保留 D 的印刷材质，换成不规则的疏密变化。没有同心圆，也没有明确波源。", source: "Paper Dithering · warp" },
  { id: "mist", code: "04", name: "疏点薄雾", subtitle: "少一些轮廓，多一些空气", description: "稀疏墨点形成外围薄雾，缓慢流移、浓淡连续变化，给中央文字留出安静空间。", source: "Paper ShaderMount · 局部点场 Shader" },
] as const;
export type Variant = typeof variants[number]["id"];
export type Reference = "grain" | "silk" | "dither";
export type Choice = Variant | Reference;
export const references: { id: Reference; name: string }[] = [
  { id: "grain", name: "原 A · 纸墨流动" },
  { id: "silk", name: "原 B · 墨色流光" },
  { id: "dither", name: "原 D · 墨点潮汐" },
];
export type Parameters = {
  strength: number; grain: number; scale: number; speed: number; clear: number;
  density: number; disorder: number; x: number; y: number; rotation: number; seed: number;
};
export const bounds: Record<keyof Parameters, readonly [number, number, number]> = {
  strength: [0.08, 0.85, 0.01], grain: [0.75, 4, 0.05], scale: [0.4, 2, 0.02],
  speed: [0, 0.9, 0.01], clear: [0.35, 1, 0.01], density: [0.15, 0.8, 0.01],
  disorder: [0, 1, 0.01], x: [-0.8, 0.8, 0.02], y: [-0.8, 0.8, 0.02],
  rotation: [-90, 90, 1], seed: [1, 999, 1],
};
const base: Parameters = { strength: 0.48, grain: 1.5, scale: 1, speed: 0.28, clear: 0.91, density: 0.5, disorder: 0.62, x: -0.12, y: 0.1, rotation: -16, seed: 37 };
export const defaults: Record<Variant, Parameters> = {
  ink: { ...base },
  paper: { ...base, strength: 0.48, grain: 1.2, scale: 0.72, speed: 0.24, clear: 0.88, disorder: 0.28, y: 0.12, rotation: -18 },
  print: { ...base, strength: 0.48, grain: 1.15, scale: 0.76, speed: 0.2, clear: 0.93, x: 0.12, y: 0.22, rotation: -24 },
  mist: { ...base, strength: 0.46, grain: 2.6, scale: 1.18, speed: 0.22, clear: 0.92, density: 0.35, disorder: 0.4, x: 0.1, y: 0.02, seed: 83 },
};
export const initialFrame = 12000;
export const storageKey = "folune-hero-grain-lab-v1";
export const isVariant = (value: unknown): value is Variant => variants.some(item => item.id === value);
export const isChoice = (value: unknown): value is Choice => isVariant(value) || references.some(item => item.id === value);
export const choiceName = (choice: Choice) => variants.find(item => item.id === choice)?.name ?? references.find(item => item.id === choice)?.name ?? "散墨流变";
export type Snapshot = { version: 1; choice: Choice; params: Parameters; height: number; frame: number };
export const defaultSnapshot = (): Snapshot => ({ version: 1, choice: "ink", params: { ...defaults.ink }, height: 68, frame: initialFrame });
export function parseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") throw new Error("请粘贴从本实验页复制的配置。");
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || !isChoice(item.choice) || !item.params || typeof item.params !== "object") throw new Error("配置版本或方案不受支持。");
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!finite(item.height) || item.height < 50 || item.height > 85 || !finite(item.frame) || item.frame < 0 || item.frame > 1e10) throw new Error("高度或时间参数超出范围。");
  const params = {} as Parameters;
  for (const key of Object.keys(bounds) as (keyof Parameters)[]) {
    const n = (item.params as Record<string, unknown>)[key];
    const [min, max] = bounds[key];
    if (!finite(n) || n < min || n > max) throw new Error(`参数 ${key} 超出范围。`);
    params[key] = key === "seed" ? Math.round(n) : n;
  }
  return { version: 1, choice: item.choice, params, height: item.height, frame: item.frame };
}
