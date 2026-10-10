/**
 * [INPUT]: 依赖视口/可视视口尺寸、默认窗口宽度、临时完整浮窗与助手尺寸/窗口或面板宽度语义
 * [OUTPUT]: 对外提供胶囊/默认短窗尺寸、矩形/方向/边界及宽度模式类型、默认或自定义窗口解析、八方向调整与视口钳制
 * [POS]: widgets 的助手几何纯边界；400×640默认阅读窗口与360×520拖动下限分离，小屏按可见空间收敛；默认右下锚定，自定义窗口保留对边，正文不通过scale变形
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AssistantFrame, AssistantSize } from "../shared/store/workspaceChromeStore";

export const ASSISTANT_CAPSULE = { width: 130, height: 44, radius: 32 } as const;
export const ASSISTANT_DEFAULT_WIDTH = 400;
export const ASSISTANT_COMPACT_HEIGHT = 640;
export const ASSISTANT_MIN_WIDTH = 360;
export const ASSISTANT_MIN_HEIGHT = 520;
const COMPACT_HEIGHT_RATIO = 0.75;
const MIN_HEIGHT_RATIO = 2 / 3;
const SHORT_VIEWPORT_HEIGHT = 420;
export type AssistantWidthMode = "window" | "panel";
export type AssistantRect = { left: number; top: number; width: number; height: number };
export type AssistantResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
export type AssistantResizeBounds = { left: number; top: number; right: number; bottom: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** 拖动下限独立于默认阅读尺寸；低矮视口优先保证完整可达。 */
const minimumHeight = (fullHeight: number, uiScale = 1): number =>
  fullHeight <= SHORT_VIEWPORT_HEIGHT
    ? fullHeight
    : Math.min(ASSISTANT_MIN_HEIGHT * uiScale, Math.round(fullHeight * MIN_HEIGHT_RATIO));

export function constrainAssistantRect(rect: AssistantRect, bounds: AssistantResizeBounds): AssistantRect {
  const width = clamp(rect.width, Math.min(ASSISTANT_MIN_WIDTH, bounds.right - bounds.left), bounds.right - bounds.left);
  const height = clamp(rect.height, minimumHeight(bounds.bottom - bounds.top), bounds.bottom - bounds.top);
  return { width, height, left: clamp(rect.left, bounds.left, bounds.right - width), top: clamp(rect.top, bounds.top, bounds.bottom - height) };
}

/** 对边固定，拖动边跟手；最小尺寸以当前可视空间为上限，不制造窄屏溢出。 */
export function resizeAssistantRect(start: AssistantRect, edge: AssistantResizeEdge, dx: number, dy: number, bounds: AssistantResizeBounds): AssistantRect {
  const minWidth = Math.min(ASSISTANT_MIN_WIDTH, bounds.right - bounds.left);
  const minHeight = minimumHeight(bounds.bottom - bounds.top);
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
  widthMode?: AssistantWidthMode;
}) {
  const inset = input.inset ?? (input.viewportWidth < 1200 ? 12 : 16);
  const availableHeight = input.availableHeight ?? input.viewportHeight;
  const uiScale = input.uiScale ?? 1;
  const fullHeight = Math.max(ASSISTANT_CAPSULE.height * uiScale, availableHeight - inset * 2);
  // 面板演示必须匹配预留栏宽；360px下限只属于可调整的真实窗口。
  const frame = input.frame;
  const requestedWidth = input.widthMode === "panel" ? input.panelWidth : Math.max(ASSISTANT_MIN_WIDTH * uiScale, frame?.width ?? input.panelWidth);
  const width = Math.min(requestedWidth, input.viewportWidth - inset * 2);
  const bottomInset = Math.max(inset, input.viewportHeight - availableHeight - (input.offsetTop ?? 0) + inset);
  const minHeight = minimumHeight(fullHeight, uiScale);
  // 标准桌面采用5:8纵向阅读窗；矮屏保留上方空间，软键盘出现时使用全部可见高度。
  const compactHeight = fullHeight <= SHORT_VIEWPORT_HEIGHT ? fullHeight
    : Math.min(ASSISTANT_COMPACT_HEIGHT * uiScale, Math.round(fullHeight * COMPACT_HEIGHT_RATIO));
  const height = frame
    ? clamp(frame.height, minHeight, fullHeight)
    : input.size === "expanded" ? fullHeight : compactHeight;
  return {
    bottom: frame ? clamp(frame.bottom, bottomInset, bottomInset + fullHeight - height) : bottomInset,
    right: frame ? clamp(frame.right, inset, input.viewportWidth - width - inset) : inset,
    inset,
    width,
    height,
    radius: (input.size === "compact" ? 24 : 20) * uiScale,
  };
}
