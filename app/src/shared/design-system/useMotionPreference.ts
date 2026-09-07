/**
 * [INPUT]: 依赖 React useSyncExternalStore 与系统 prefers-reduced-motion 媒体查询
 * [OUTPUT]: 对外提供随系统设置即时更新的 useMotionPreference 布尔值
 * [POS]: DS 动态偏好订阅边界；Panel 视图和 Composer 共读，不缓存挂载时的偏好
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const getSnapshot = () => typeof window !== "undefined" && window.matchMedia(query).matches;
const getServerSnapshot = () => false;
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
