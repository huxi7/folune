/**
 * [INPUT]: 依赖 Design System Skeleton/SkeletonGroup 与 Canvas/Paper 共用 Stage 样式
 * [OUTPUT]: 对外提供延迟可见、单一真实纸面比例的 CanvasStageLoading
 * [POS]: widgets 的统一路由/Canvas 首屏占位；快速请求不出现，慢请求只画一张结构稳定的纸，不再并列伪造两张卡片
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Skeleton,
  SkeletonGroup,
} from "../shared/design-system/components";

export function CanvasStageLoading({
  label = "正在准备画布",
  visible,
}: {
  label?: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <SkeletonGroup
      className="canvas-stage-loading"
      label={label}
      visible={visible}
    >
      <Skeleton className="canvas-stage-loading-paper" />
    </SkeletonGroup>
  );
}
