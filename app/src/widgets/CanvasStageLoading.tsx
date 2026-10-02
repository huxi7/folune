/**
 * [INPUT]: 依赖 useLocale 的无障碍加载文案；依赖 Canvas 共用 Stage 样式与调用方的延迟可见状态
 * [OUTPUT]: 对外提供无占位卡片、保留无障碍加载状态的 CanvasStageLoading
 * [POS]: widgets 的统一路由/Canvas 首屏覆盖层；只保持干净画布，不伪造尚未加载的笔记
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocale } from "../shared/locale";

export function CanvasStageLoading({
  label,
  visible,
}: {
  label?: string;
  visible: boolean;
}) {
  const { t } = useLocale();
  if (!visible) return null;
  return <div aria-label={label ?? t("正在准备画布", "Preparing canvas")} aria-busy="true" role="status" className="canvas-stage-loading" />;
}
