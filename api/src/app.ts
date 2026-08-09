/**
 * [INPUT]: 依赖 Hono、Hono CORS、config/env、router 聚合器、middleware 请求日志与错误处理
 * [OUTPUT]: 对外提供完成中间件、X-Request-Id 跨域暴露和路由装配的 app
 * [POS]: api HTTP 组装根，只注册横切中间件、错误钩子与 router，不承载业务判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

import { env } from "./config/env.ts";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { router } from "./router/index.ts";

export const app = new Hono();

app.use("*", requestLogger);
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGINS,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-Id"],
    credentials: true,
  }),
);

app.route("/", router);
app.notFound(notFoundHandler);
app.onError(errorHandler);
