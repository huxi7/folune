/**
 * [INPUT]: 依赖 Mastra/Hono 中间件上下文、config/env 与 request-log 安全格式化能力
 * [OUTPUT]: 对外提供注入 X-Request-Id、开发态 ASCII 与生产态 JSON 的 requestLogger
 * [POS]: middleware 层请求观测入口，只采集 method/path/status/duration/origin，跳过 Mastra 热更新噪声并记录 SSE 握手耗时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ContextWithMastra, Middleware } from "@mastra/core/server";

import { env } from "@/config/env";
import {
  formatHealthProbe,
  formatRequestCard,
  formatRequestJson,
  type RequestLogRecord,
} from "@/middleware/request-log";

type RouteMiddleware = Exclude<Middleware, { path: string }>;

const REQUEST_ID_HEADER = "X-Request-Id";
const HEALTH_PROBE_HEADER = "X-SuperNote-Probe";

export const requestLogger: RouteMiddleware = async (rawContext, next) => {
  const context = rawContext as ContextWithMastra;
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const requestId = crypto.randomUUID();

  context.header(REQUEST_ID_HEADER, requestId);

  try {
    await next();
  } finally {
    const path = new URL(context.req.url).pathname;
    const source = path === "/health" &&
        context.req.header(HEALTH_PROBE_HEADER) === "docker-health"
      ? "docker-health"
      : "client";
    const record: RequestLogRecord = {
      requestId,
      timestamp,
      method: context.req.method,
      path,
      status: context.res.status,
      durationMs: performance.now() - startedAt,
      origin: context.req.header("origin") ?? "-",
      source,
    };

    const isMastraDevInternal = path.startsWith("/__");

    if (env.NODE_ENV !== "test" && !isMastraDevInternal) {
      const colorEnabled = process.env["NO_COLOR"] !== "1";
      const output = env.NODE_ENV === "production"
        ? formatRequestJson(record)
        : source === "docker-health"
        ? formatHealthProbe(record, colorEnabled)
        : formatRequestCard(record, colorEnabled);

      console.info(output);
    }
  }
};
