/**
 * [INPUT]: 依赖 Paper 0.0.80 能力、本轮 A/B 材质契约与用户提供的 02 参数截图
 * [OUTPUT]: 对外提供 01A/02A 主候选、被否决 B 版历史身份及版本化配置校验
 * [POS]: Lab 参数真相源；保留旧 ID 以迁移已存调整，不把新默认值覆盖到旧方案
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const variantCatalog = [
  { id: "ink", code: "01A", name: "散墨流变", subtitle: "原版 · 自由颗粒场", description: "保留上一轮增强版：不规则墨粒流动，明暗分散、轮廓柔和。", source: "Paper ShaderMount · 原颗粒 Shader" },
  { id: "ink-b", code: "01B", name: "墨岸留白", subtitle: "新版 · 主次分明的墨面", description: "一片有边缘的墨面从左上展开，右下只留浅浅呼应；中央自然留白，墨粒随着缓慢形变流动。", source: "Paper ShaderMount · 构图颗粒 Shader" },
  { id: "paper", code: "02A", name: "纸墨呼吸", subtitle: "原版 · Paper 颗粒波面", description: "保留原 Paper wave 算法和你的既有调整；无旧配置时以你提供的 60svh 参数作为起点。", source: "Paper GrainGradient · wave" },
  { id: "paper-b", code: "02B", name: "叠墨纸境", subtitle: "新版 · 两层不等速的纸墨", description: "保留细纸粒，用一深一浅的宽阔墨面形成轮廓；走势有方向，边缘与底层以不同节奏变化。", source: "Paper GrainGradient 材质 · 局部场形改造" },
] as const;
// B 版大色块构图已被用户否决；保留身份解析旧收藏，不再列入主候选。
export const variants = variantCatalog.filter(item => item.id === "ink" || item.id === "paper");
export const archivedVariants = [
  { id: "print", code: "03", name: "游移网点" },
  { id: "mist", code: "04", name: "疏点薄雾" },
] as const;
export type Variant = typeof variantCatalog[number]["id"] | typeof archivedVariants[number]["id"];
export type Reference = "grain" | "silk" | "dither";
export type Choice = Variant | Reference;
export const references: { id: Reference; name: string }[] = [
  { id: "grain", name: "原 A · 纸墨流动" }, { id: "silk", name: "原 B · 墨色流光" }, { id: "dither", name: "原 D · 墨点潮汐" },
];
export const allChoices = [...variantCatalog, ...archivedVariants, ...references];
export type Parameters = {
  strength: number; grain: number; scale: number; speed: number; clear: number;
  density: number; disorder: number; x: number; y: number; rotation: number; seed: number;
  softness: number; noise: number;
};
export const bounds: Record<keyof Parameters, readonly [number, number, number]> = {
  strength: [0.08, 0.95, 0.01], grain: [0.75, 4, 0.05], scale: [0.4, 2, 0.02],
  speed: [0, 0.9, 0.01], clear: [0.35, 1, 0.01], density: [0.15, 0.8, 0.01],
  disorder: [0, 1, 0.01], x: [-0.8, 0.8, 0.02], y: [-0.8, 0.8, 0.02],
  rotation: [-90, 90, 1], seed: [1, 999, 1], softness: [0.25, 0.9, 0.01], noise: [0, 0.4, 0.01],
};
const base: Parameters = { strength: 0.48, grain: 1.5, scale: 1, speed: 0.28, clear: 0.91, density: 0.5, disorder: 0.62, x: -0.12, y: 0.1, rotation: -16, seed: 37, softness: 0.8, noise: 0.19 };
export const defaults: Record<Variant, Parameters> = {
  ink: { ...base },
  "ink-b": { ...base, strength: 0.68, grain: 1.65, scale: 1.08, speed: 0.34, clear: 0.8, density: 0.58, disorder: 0.36, x: -0.06, y: 0.02, rotation: -12, softness: 0.58, noise: 0.16 },
  // 无存量配置时才采用用户截图的数值；存量 bank.paper 完整保留。
  paper: { ...base, strength: 0.78, grain: 1.2, scale: 0.96, speed: 0.68, clear: 0.8, disorder: 0.14, x: -0.26, y: 0.18, rotation: -17 },
  "paper-b": { ...base, strength: 0.72, grain: 1.2, scale: 1, speed: 0.46, clear: 0.82, disorder: 0.2, x: -0.08, y: 0.06, rotation: -14, softness: 0.62, noise: 0.16 },
  print: { ...base, strength: 0.48, grain: 1.15, scale: 0.76, speed: 0.2, clear: 0.93, x: 0.12, y: 0.22, rotation: -24 },
  mist: { ...base, strength: 0.46, grain: 2.6, scale: 1.18, speed: 0.22, clear: 0.92, density: 0.35, disorder: 0.4, x: 0.1, y: 0.02, seed: 83 },
};
export const initialFrame = 12000;
export const legacyStorageKey = "folune-hero-grain-lab-v1";
export const storageKey = "folune-hero-grain-lab-v2";
export const galleryKey = "folune-hero-grain-gallery-v1";
export const isVariant = (value: unknown): value is Variant => [...variantCatalog, ...archivedVariants].some(item => item.id === value);
export const isChoice = (value: unknown): value is Choice => allChoices.some(item => item.id === value);
export const isRedesigned = (choice: Choice) => choice === "ink-b" || choice === "paper-b";
export const choiceName = (choice: Choice) => {
  const item = allChoices.find(entry => entry.id === choice);
  return item ? ("code" in item ? `${item.code} · ${item.name}` : item.name) : "未知方案";
};
export type Snapshot = { version: 2; choice: Choice; params: Parameters; height: number; frame: number };
export const defaultSnapshot = (): Snapshot => ({ version: 2, choice: "paper", params: { ...defaults.paper }, height: 60, frame: initialFrame });
export function parseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") throw new Error("请粘贴从本实验页复制的配置。");
  const item = value as Record<string, unknown>;
  if ((item.version !== 1 && item.version !== 2) || !isChoice(item.choice) || !item.params || typeof item.params !== "object") throw new Error("配置版本或方案不受支持。");
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!finite(item.height) || item.height < 50 || item.height > 85 || !finite(item.frame) || item.frame < 0 || item.frame > 1e10) throw new Error("高度或时间参数超出范围。");
  const params = {} as Parameters;
  for (const key of Object.keys(bounds) as (keyof Parameters)[]) {
    const old = (item.params as Record<string, unknown>)[key];
    const n = item.version === 1 && old === undefined && (key === "softness" || key === "noise") ? base[key] : old;
    const [min, max] = bounds[key];
    if (!finite(n) || n < min || n > max) throw new Error(`参数 ${key} 超出范围。`);
    params[key] = key === "seed" ? Math.round(n) : n;
  }
  return { version: 2, choice: item.choice, params, height: item.height, frame: item.frame };
}
