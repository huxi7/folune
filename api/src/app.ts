/**
 * [INPUT]: 依赖 Hono、Hono CORS/compress、config/env、router 聚合器、middleware 请求日志与错误处理
 * [OUTPUT]: 对外提供十分钟 CORS 预检复用、memo/Canvas JSON 压缩协商、X-Request-Id 跨域暴露和路由装配的 app
 * [POS]: api HTTP 组装根，只注册横切中间件、错误钩子与 router，不承载业务判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";

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
    maxAge: 600,
  }),
);

// 正文、整树与图是主要下载载荷；不介入 AI 通道或头像上传。
const compressJson = compress({ contentTypeFilter: /^application\/json/ });
for (const path of ["/memo-tree", "/memos/*", "/canvases/*"]) {
  app.use(path, async (c, next) => {
    await compressJson(c, next);
    c.header("Vary", "Accept-Encoding", { append: true });
  });
}

app.route("/", router);
app.notFound(notFoundHandler);
app.onError(errorHandler);
