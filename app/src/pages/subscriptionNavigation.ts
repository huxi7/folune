/**
 * [INPUT]: 依赖 React Router location 的 pathname/state 与 matchPath
 * [OUTPUT]: 对外提供订阅/积分购买独立地址、兼容尾斜杠的 isSubscriptionPath 与受限工作区返回地址解析
 * [POS]: pages 的订阅导航边界；只接受本站笔记工作区路径，订阅打开时底层继续消费原笔记身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { matchPath } from "react-router-dom";

export const SUBSCRIPTION_PATH = "/app/subscription";
export const CREDITS_PATH = "/app/subscription/credits";
export const isCreditsPath = (pathname: string) => matchPath(CREDITS_PATH, pathname) !== null;
export const isSubscriptionPath = (pathname: string) => matchPath(SUBSCRIPTION_PATH, pathname) !== null || isCreditsPath(pathname);
export function subscriptionReturnPath(state: unknown): string {
  const path = typeof state === "object" && state !== null && "workspacePath" in state ? state.workspacePath : null;
  return typeof path === "string" && (path === "/app" || matchPath("/app/notes/:noteId", path)) ? path : "/app";
}
export function workspacePathForLocation(location: { pathname: string; state: unknown }): string {
  return isSubscriptionPath(location.pathname) ? subscriptionReturnPath(location.state) : location.pathname;
}
