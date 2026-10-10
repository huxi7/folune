/**
 * [INPUT]: 依赖 React state/effect、浏览器 localStorage/viewport 与 assistantGeometry 的默认短窗最小宽度
 * [OUTPUT]: 对外提供 Paper First 浮层宽度常量、WorkspaceStyle 类型、带边界校验的 usePersistedPanelWidth，以及 Workspace 唯一的浮层遮罩响应式判据 useOverlayPanels
 * [POS]: app/src/pages 的工作台几何配置层；集中隔离文件库宽度持久化、AI 默认宽度与断点判据，使 AppDashboard 只编排业务视图。「现在是不是覆盖式布局」只允许有一个答案：由 Dashboard 持有这一份 state 并下传，任何在 render 里裸读 window.innerWidth 的地方都会成为漂移的第二真相
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState, type CSSProperties } from "react";
import { ASSISTANT_MIN_WIDTH } from "../widgets/assistantGeometry";

export const SIDEBAR_WIDTH_KEY = "folune-sidebar-width";
export const DEFAULT_SIDEBAR_WIDTH = 264;
export const DEFAULT_AGENT_WIDTH = ASSISTANT_MIN_WIDTH;
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 360;
export type WorkspaceStyle = CSSProperties & {
  "--workspace-agent-track": string;
  "--workspace-sidebar-track": string;
};

/** 单个 Panel 就必须转成遮罩抽屉的宽度 */
export const PANEL_OVERLAY_BREAKPOINT = 1200;
/** 左右双开时才不够并列的宽度 */
export const DUAL_PANEL_SAFE_BREAKPOINT = 1400;

export type WorkspaceViewport = {
  /** 单 Panel 已经无法并列: 抽屉 + 遮罩, 且不再画跨层归档线 */
  compact: boolean;
  /** 当前布局是否为覆盖式（compact，或双开且宽度不足） */
  overlayPanels: boolean;
};

const readViewport = (
  assistantOpen: boolean,
  libraryOpen: boolean,
): WorkspaceViewport => {
  if (typeof window === "undefined") {
    return { compact: false, overlayPanels: false };
  }
  const compact = window.innerWidth < PANEL_OVERLAY_BREAKPOINT;
  return {
    compact,
    overlayPanels: compact || (
      libraryOpen && assistantOpen && window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
    ),
  };
};

/**
 * 唯一响应式状态源。resize 时同步一次，其余时间是稳定 state —— 于是 Paper 壳、
 * 归档 Overlay 与任何后续消费者读到的都是同一个答案，不会一个说「还能并列」、
 * 另一个说「已经是抽屉」。
 */
export function useOverlayPanels(
  assistantOpen: boolean,
  libraryOpen: boolean,
): WorkspaceViewport {
  const [viewport, setViewport] = useState(() =>
    readViewport(assistantOpen, libraryOpen));

  useEffect(() => {
    const sync = () => {
      const next = readViewport(assistantOpen, libraryOpen);
      setViewport((current) =>
        current.compact === next.compact
          && current.overlayPanels === next.overlayPanels
          ? current
          : next);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [assistantOpen, libraryOpen]);

  return viewport;
}

const readStoredWidth = (
  key: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const storedValue = window.localStorage.getItem(key);

  if (storedValue === null) {
    return fallback;
  }

  const storedWidth = Number(storedValue);
  return Number.isFinite(storedWidth)
    ? Math.min(max, Math.max(min, storedWidth))
    : fallback;
};

export function usePersistedPanelWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(() =>
    readStoredWidth(key, fallback, min, max));

  useEffect(() => {
    window.localStorage.setItem(key, String(Math.round(width)));
  }, [key, width]);

  return [width, setWidth] as const;
}
