/**
 * [INPUT]: 依赖 React state/effect 与浏览器 localStorage/viewport
 * [OUTPUT]: 对外提供三 Panel 宽度常量、WorkspaceStyle 类型与带边界校验的 usePersistedPanelWidth
 * [POS]: app/src/pages 的工作台几何配置层；集中隔离面板尺寸持久化，使 AppDashboard 只编排业务视图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState, type CSSProperties } from "react";

export const SIDEBAR_WIDTH_KEY = "supernote-sidebar-width";
export const AGENT_WIDTH_KEY = "supernote-agent-width";
export const DEFAULT_SIDEBAR_WIDTH = 248;
export const DEFAULT_AGENT_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 360;
export const AGENT_MIN_WIDTH = 264;
export const AGENT_MAX_WIDTH = 440;
export const MAIN_MIN_WIDTH = 420;
export const WORKSPACE_CHROME_WIDTH = 32;

export type WorkspaceStyle = CSSProperties & {
  "--workspace-agent-track": string;
  "--workspace-sidebar-track": string;
};

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
