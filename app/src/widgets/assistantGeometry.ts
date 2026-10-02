/**
 * [INPUT]: 依赖视口/可视视口尺寸、用户共享窗口宽度与助手尺寸语义
 * [OUTPUT]: 对外提供胶囊/最小尺寸、矩形/方向/边界类型、默认或自定义窗口解析、八方向调整与视口钳制
 * [POS]: widgets 的助手几何纯边界；默认右下锚定，自定义窗口保留对边并限制在可视区域，正文不通过scale变形
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AssistantFrame, AssistantSize } from "../shared/store/workspaceChromeStore";

export const ASSISTANT_CAPSULE = { width: 130, height: 44, radius: 32 } as const;
const COMPACT_HEIGHT = 520;
const COMPACT_HEIGHT_RATIO = 2 / 3;
const SHORT_VIEWPORT_HEIGHT = 420;
export const ASSISTANT_MIN_WIDTH = 264;
export const ASSISTANT_MIN_HEIGHT = 280;
export type AssistantRect = { left: number; top: number; width: number; height: number };
export type AssistantResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
export type AssistantResizeBounds = { left: number; top: number; right: number; bottom: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function constrainAssistantRect(rect: AssistantRect, bounds: AssistantResizeBounds): AssistantRect {
  const width = clamp(rect.width, Math.min(ASSISTANT_MIN_WIDTH, bounds.right - bounds.left), bounds.right - bounds.left);
  const height = clamp(rect.height, Math.min(ASSISTANT_MIN_HEIGHT, bounds.bottom - bounds.top), bounds.bottom - bounds.top);
  return { width, height, left: clamp(rect.left, bounds.left, bounds.right - width), top: clamp(rect.top, bounds.top, bounds.bottom - height) };
}

/** 对边固定，拖动边跟手；最小尺寸以当前可视空间为上限，不制造窄屏溢出。 */
export function resizeAssistantRect(start: AssistantRect, edge: AssistantResizeEdge, dx: number, dy: number, bounds: AssistantResizeBounds): AssistantRect {
  const minWidth = Math.min(ASSISTANT_MIN_WIDTH, bounds.right - bounds.left);
  const minHeight = Math.min(ASSISTANT_MIN_HEIGHT, bounds.bottom - bounds.top);
  const rect = constrainAssistantRect(start, bounds);
  let left = rect.left, right = rect.left + rect.width;
  let top = rect.top, bottom = rect.top + rect.height;
  if (edge.includes("w")) left = clamp(left + dx, bounds.left, right - minWidth);
  if (edge.includes("e")) right = clamp(right + dx, left + minWidth, bounds.right);
  if (edge.includes("n")) top = clamp(top + dy, bounds.top, bottom - minHeight);
  if (edge.includes("s")) bottom = clamp(bottom + dy, top + minHeight, bounds.bottom);
  return { left, top, width: right - left, height: bottom - top };
}

export function resolveAssistantGeometry(input: {
  viewportWidth: number;
  viewportHeight: number;
  availableHeight?: number;
  offsetTop?: number;
  panelWidth: number;
  size: AssistantSize;
  frame?: AssistantFrame | null;
  inset?: number;
  uiScale?: number;
}) {
  const inset = input.inset ?? (input.viewportWidth < 1200 ? 12 : 16);
  const availableHeight = input.availableHeight ?? input.viewportHeight;
  const uiScale = input.uiScale ?? 1;
  const fullHeight = Math.max(ASSISTANT_CAPSULE.height * uiScale, availableHeight - inset * 2);
  const width = Math.max(ASSISTANT_CAPSULE.width, Math.min(input.panelWidth, input.viewportWidth - inset * 2));
  const bottomInset = Math.max(inset, input.viewportHeight - availableHeight - (input.offsetTop ?? 0) + inset);
  const frame = input.size === "compact" ? input.frame : null;
  const height = frame
    ? clamp(frame.height, Math.min(ASSISTANT_MIN_HEIGHT, fullHeight), fullHeight)
    : input.size === "expanded" || fullHeight <= SHORT_VIEWPORT_HEIGHT
      ? fullHeight : Math.min(COMPACT_HEIGHT * uiScale, Math.round(fullHeight * COMPACT_HEIGHT_RATIO));
  return {
    bottom: frame ? clamp(frame.bottom, bottomInset, bottomInset + fullHeight - height) : bottomInset,
    right: frame ? clamp(frame.right, inset, input.viewportWidth - width - inset) : inset,
    inset,
    width,
    height,
    radius: (input.size === "compact" ? 24 : 20) * uiScale,
  };
}
