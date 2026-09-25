/**
 * [INPUT]: 依赖 Mastra 路由中间件上下文与 Folune 已有的公开业务路径
 * [OUTPUT]: 对外提供 productionRouteGuard，拒绝框架默认接口绕过业务鉴权入口
 * [POS]: 生产 HTTP 暴露边界，由 Mastra 组合根仅在 production 注册；各业务路由继续负责 JWT 鉴权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Middleware } from "@mastra/core/server";

type RouteMiddleware = Exclude<Middleware, { path: string }>;

const PUBLIC_PATHS = new Set([
  "/health",
  "/v1/chat",
  "/v1/organize",
  "/v1/explore",
  "/v1/canvas-expand",
]);

export const productionRouteGuard: RouteMiddleware = async (context, next) => {
  if (!PUBLIC_PATHS.has(new URL(context.req.url).pathname)) {
    return context.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }
  await next();
};
