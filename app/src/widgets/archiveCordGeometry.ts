/**
 * [INPUT]: 依赖 cordGeometry 的 CordPoint/CordCurve 与三次贝塞尔求解，不访问 DOM、React、Store 或 Motion
 * [OUTPUT]: 对外提供 archiveCordGeometry（sourceAnchor/targetAnchor/projection/curve）、连续 clamp 常量与端点插值
 * [POS]: ArchiveCordOverlay 的纯几何边界；「可见 → 贴边 → 离屏」由同一个 clamp 连续完成，不存在两套会在边界互换的几何，也不产出中心圆点或方向箭头
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cordCurve, type CordCurve, type CordPoint } from "./cordGeometry";

type ViewportRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

/**
 * anchored: 代表行的中心就在安全区内，端点精确咬住它
 * above / below: 代表行已越过安全边缘，端点连续贴在对应边上，方向交给末段切线与降调
 */
export type ArchiveCordProjection = "above" | "anchored" | "below";

export type ArchiveCordAnchors = {
  projection: ArchiveCordProjection;
  sourceAnchor: CordPoint;
  targetAnchor: CordPoint;
};

export type ArchiveCordGeometry = ArchiveCordAnchors & { curve: CordCurve };

/** 端点在 tree clip 内保留的安全内边距；贴边不等于压在裁切线上 */
export const ARCHIVE_CORD_TREE_INSET = 12;

const ARCHIVE_CORD_BOW = 36;
const ARCHIVE_CORD_BOW_SPAN = 420;

const finiteRect = (rect: ViewportRect | null): boolean => rect !== null
  && Number.isFinite(rect.top)
  && Number.isFinite(rect.bottom)
  && Number.isFinite(rect.left)
  && Number.isFinite(rect.right);

const clamp = (value: number, low: number, high: number): number =>
  high < low ? (low + high) / 2 : Math.min(high, Math.max(low, value));

/**
 * 端点一律取「面向对方的那条竖边中点」，不取行中心：
 * 中心会让线钻进目标行里，还得再画一颗圆点解释端点在哪。
 */
export const archiveCordAnchors = ({
  sourceRect,
  targetRect,
  treeRect,
}: {
  sourceRect: ViewportRect;
  targetRect: ViewportRect;
  treeRect: ViewportRect | null;
}): ArchiveCordAnchors | null => {
  if (!finiteRect(sourceRect) || !finiteRect(targetRect)) return null;

  const sourceCenterX = (sourceRect.left + sourceRect.right) / 2;
  const targetCenterX = (targetRect.left + targetRect.right) / 2;
  const targetCenterY = (targetRect.top + targetRect.bottom) / 2;
  // Paper-facing rail：横向不随树滚动，所以行滚出视口后这条 x 依然有效
  const targetAnchorX = sourceCenterX >= targetCenterX
    ? targetRect.right
    : targetRect.left;

  /*
   * 一个 clamp 同时表达三种状态。阈值切换会在越界那一帧把端点传送出去，
   * 而这里的 y 是 rowCenterY 的连续函数：行慢慢靠近边缘，端点就慢慢贴上去。
   */
  const clampedY = finiteRect(treeRect) && treeRect !== null
    ? clamp(
      targetCenterY,
      treeRect.top + ARCHIVE_CORD_TREE_INSET,
      treeRect.bottom - ARCHIVE_CORD_TREE_INSET,
    )
    : targetCenterY;
  const targetAnchor: CordPoint = { x: targetAnchorX, y: clampedY };
  const projection: ArchiveCordProjection = clampedY > targetCenterY
    ? "above"
    : clampedY < targetCenterY
      ? "below"
      : "anchored";

  const sourceAnchor: CordPoint = {
    x: targetAnchorX <= sourceCenterX ? sourceRect.left : sourceRect.right,
    y: (sourceRect.top + sourceRect.bottom) / 2,
  };

  return { projection, sourceAnchor, targetAnchor };
};

export const archiveCordCurve = (anchors: ArchiveCordAnchors): CordCurve =>
  cordCurve(anchors.sourceAnchor, anchors.targetAnchor, {
    bow: ARCHIVE_CORD_BOW,
    bowSpan: ARCHIVE_CORD_BOW_SPAN,
    mode: "horizontal",
  });

export const archiveCordGeometry = (input: {
  sourceRect: ViewportRect;
  targetRect: ViewportRect;
  treeRect: ViewportRect | null;
}): ArchiveCordGeometry | null => {
  const anchors = archiveCordAnchors(input);
  if (anchors === null) return null;
  return { ...anchors, curve: archiveCordCurve(anchors) };
};

/**
 * 代表从 memo 换成祖先目录（或反向）时，端点从当前绘制位置连续收敛到新位置。
 * 途中再次换代表就以当前插值点作为新起点，因此可重入、不会回到旧起点。
 */
export const lerpArchiveAnchor = (
  from: CordPoint,
  to: CordPoint,
  progress: number,
): CordPoint => {
  const ratio = Math.min(1, Math.max(0, progress));
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
};
