/**
 * [INPUT]: 依赖 widgets/cordGeometry 的 CordBox/CordPoint 类型与 cordAnchor 边缘求点
 * [OUTPUT]: 对外提供 RadialItem/RadialPlacement 类型与 radialLayout 纯布局函数
 * [POS]: app/src/widgets 的探索态候选排布内核；半径承载相关度语义、角度只负责均匀散开，并绕开高瘦 Paper 的上下方向。确定性无随机，故可单测且同一输入永远同一布局。注意此处的半径自中心矩形边缘起算，纸高瘦时边缘离中心忽远忽近，因此 pages/explorePresentation 只消费本模块的分侧与角度，另按「用户读到的直线距离」重写距离——那一层才是产品语义的所有者
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cordAnchor, type CordBox, type CordPoint } from "./cordGeometry";

export type RadialItem = {
  id: string;
  /** 相关度 0~1，越大越相关。越相关的排得越近，这是布局承载的唯一语义 */
  relevance: number;
};

export type RadialPlacement = {
  /** 弧度，0 指向右、正值顺时针（与屏幕坐标一致） */
  angle: number;
  id: string;
  /** 自中心矩形边缘起算的推离距离 */
  radius: number;
  relevance: number;
  side: "left" | "right";
  /** 卡片中心相对舞台中心的像素偏移 */
  x: number;
  y: number;
};

export type RadialLayoutOptions = {
  /** 卡片尺寸，用于同侧防重叠 */
  cardSize?: { height: number; width: number };
  /** 中心主体（活纸）的尺寸，候选自其边缘起算距离 */
  centerSize?: { height: number; width: number };
  maxRadius?: number;
  minRadius?: number;
  /** 需要绕开的竖直楔形半角（度）。Paper 高而窄，正上正下会被它挡住 */
  verticalAvoidance?: number;
};

const DEFAULTS = {
  cardSize: { height: 132, width: 260 },
  centerSize: { height: 640, width: 816 },
  maxRadius: 360,
  minRadius: 96,
  verticalAvoidance: 34,
} as const;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * 在一段角度区间内取第 index 个位置（共 count 个）。
 * count 为 1 时落在区间正中，避免单个候选贴着边缘。
 */
const distribute = (start: number, end: number, index: number, count: number): number => {
  if (count <= 1) {
    return (start + end) / 2;
  }
  return lerp(start, end, index / (count - 1));
};

export const radialLayout = (
  items: readonly RadialItem[],
  options: RadialLayoutOptions = {},
): RadialPlacement[] => {
  const cardSize = options.cardSize ?? DEFAULTS.cardSize;
  const centerSize = options.centerSize ?? DEFAULTS.centerSize;
  const maxRadius = options.maxRadius ?? DEFAULTS.maxRadius;
  const minRadius = options.minRadius ?? DEFAULTS.minRadius;
  const avoidance = options.verticalAvoidance ?? DEFAULTS.verticalAvoidance;

  if (items.length === 0) {
    return [];
  }

  // 相关度降序，同相关度按 id 稳定排序，保证同一输入永远同一布局
  const ordered = [...items].sort((a, b) =>
    b.relevance - a.relevance || a.id.localeCompare(b.id));

  // 左右交替分侧：最相关的先占右侧，视觉重心自然落在阅读方向一侧
  const sides: RadialPlacement["side"][] = ordered.map((_, index) =>
    index % 2 === 0 ? "right" : "left");
  const counts = {
    left: sides.filter((side) => side === "left").length,
    right: sides.filter((side) => side === "right").length,
  };
  const seen = { left: 0, right: 0 };

  // 每侧可用的角度跨度：绕开正上/正下各 avoidance 度
  const halfSpan = 90 - avoidance;
  const centerBox: CordBox = {
    height: centerSize.height,
    width: centerSize.width,
    x: -centerSize.width / 2,
    y: -centerSize.height / 2,
  };

  return ordered.map((item, index) => {
    const side = sides[index]!;
    const indexOnSide = seen[side];
    seen[side] += 1;

    const base = side === "right" ? 0 : 180;
    const angleDegrees = base + distribute(
      -halfSpan,
      halfSpan,
      indexOnSide,
      counts[side],
    );
    const angle = toRadians(angleDegrees);

    // 相关度 → 半径：1 贴近中心，0 推到最远
    let radius = lerp(minRadius, maxRadius, 1 - clamp01(item.relevance));

    // 同侧防重叠：当角度间距不足以容纳卡片高度时，按序递进外推
    if (counts[side] > 1) {
      const angularGap = toRadians((halfSpan * 2) / (counts[side] - 1));
      const needed = cardSize.height * 1.12;
      const chord = 2 * radius * Math.sin(angularGap / 2);
      if (chord < needed && Math.sin(angularGap / 2) > 0) {
        radius = Math.max(radius, needed / (2 * Math.sin(angularGap / 2)));
      }
    }

    // 自中心矩形边缘起算，使任意角度的候选都能让开高瘦的 Paper
    const far: CordPoint = {
      x: Math.cos(angle) * 1e6,
      y: Math.sin(angle) * 1e6,
    };
    const edge = cordAnchor(centerBox, far);

    return {
      angle,
      id: item.id,
      radius,
      relevance: item.relevance,
      side,
      x: edge.x + Math.cos(angle) * radius,
      y: edge.y + Math.sin(angle) * radius,
    };
  });
};
