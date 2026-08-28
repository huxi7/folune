/**
 * [INPUT]: 依赖 Canvas V2 自由文字的持久宽高与缩放比例
 * [OUTPUT]: 对外提供空间文字尺寸/缩放的约束、归一化和等比换算纯函数
 * [POS]: KnowledgeCanvas 的自由文字几何内核；把内容边界、自身缩放与 React Flow 视口缩放分离，供节点渲染和交互测试共同使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const CANVAS_TEXT_DEFAULT_WIDTH = 240;
export const CANVAS_TEXT_DEFAULT_HEIGHT = 48;
export const CANVAS_TEXT_MIN_WIDTH = 20;
export const CANVAS_TEXT_MIN_HEIGHT = 24;
export const CANVAS_TEXT_MAX_WIDTH = 2880;
export const CANVAS_TEXT_MAX_HEIGHT = 3840;
export const CANVAS_TEXT_MIN_SCALE = 0.25;
export const CANVAS_TEXT_MAX_SCALE = 8;

export type SpatialTextGeometry = {
  height: number;
  scale: number;
  width: number;
  x?: number;
  y?: number;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finiteOr = (value: number | null | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const clampTextScale = (scale: number): number =>
  clamp(finiteOr(scale, 1), CANVAS_TEXT_MIN_SCALE, CANVAS_TEXT_MAX_SCALE);

export const normalizeTextGeometry = ({
  height,
  scale,
  width,
  x,
  y,
}: SpatialTextGeometry): SpatialTextGeometry => ({
  height: Math.round(clamp(
    finiteOr(height, CANVAS_TEXT_DEFAULT_HEIGHT),
    CANVAS_TEXT_MIN_HEIGHT,
    CANVAS_TEXT_MAX_HEIGHT,
  ) * 100) / 100,
  scale: Math.round(clampTextScale(scale) * 10_000) / 10_000,
  width: Math.round(clamp(
    finiteOr(width, CANVAS_TEXT_DEFAULT_WIDTH),
    CANVAS_TEXT_MIN_WIDTH,
    CANVAS_TEXT_MAX_WIDTH,
  ) * 100) / 100,
  ...(x === undefined ? {} : { x: Math.round(finiteOr(x, 0) * 100) / 100 }),
  ...(y === undefined ? {} : { y: Math.round(finiteOr(y, 0) * 100) / 100 }),
});

export const scaleTextGeometry = (
  base: Pick<SpatialTextGeometry, "height" | "width">,
  scale: number,
): SpatialTextGeometry => normalizeTextGeometry({
  height: base.height * clampTextScale(scale),
  scale,
  width: base.width * clampTextScale(scale),
});

export const textBaseGeometry = (
  geometry: Pick<SpatialTextGeometry, "height" | "scale" | "width">,
): Pick<SpatialTextGeometry, "height" | "width"> => {
  const scale = clampTextScale(geometry.scale);
  return {
    height: geometry.height / scale,
    width: geometry.width / scale,
  };
};

export const resizedTextScale = (
  initialWidth: number,
  initialScale: number,
  nextWidth: number,
): number => clampTextScale(
  clampTextScale(initialScale)
  * finiteOr(nextWidth, initialWidth)
  / Math.max(CANVAS_TEXT_MIN_WIDTH, finiteOr(initialWidth, CANVAS_TEXT_DEFAULT_WIDTH)),
);
