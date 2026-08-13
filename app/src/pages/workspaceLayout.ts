/**
 * [INPUT]: 依赖 React state/effect 与浏览器 localStorage/viewport
 * [OUTPUT]: 对外提供 Paper First 浮层宽度常量、WorkspaceStyle 类型与带边界校验的 usePersistedPanelWidth
 * [POS]: app/src/pages 的工作台几何配置层；集中隔离文件库/AI 尺寸持久化，使 AppDashboard 只编排业务视图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState, type CSSProperties } from "react";

export const SIDEBAR_WIDTH_KEY = "supernote-sidebar-width";
export const AGENT_WIDTH_KEY = "supernote-agent-width";
export const DEFAULT_SIDEBAR_WIDTH = 264;
export const DEFAULT_AGENT_WIDTH = 360;
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 360;
export const AGENT_MIN_WIDTH = 264;
export const AGENT_MAX_WIDTH = 440;
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
