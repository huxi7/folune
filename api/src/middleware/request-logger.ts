/**
 * [INPUT]: 依赖 Hono createMiddleware、config/env 与 request-log 的安全格式化能力
 * [OUTPUT]: 对外提供带 X-Request-Id、开发态彩色 ASCII 卡片及生产态 JSON 的 requestLogger
 * [POS]: middleware 层请求观测入口，只采集 method/path/status/duration/origin，禁止输出查询串、token 或 Authorization
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createMiddleware } from "hono/factory";

import { env } from "../config/env.ts";
import {
  formatHealthProbe,
  formatRequestCard,
  formatRequestJson,
  type RequestLogRecord,
} from "./request-log.ts";

const REQUEST_ID_HEADER = "X-Request-Id";
const HEALTH_PROBE_HEADER = "X-SuperNote-Probe";
const HEALTH_PROBE_VALUE = "docker-health";

const createRequestId = (): string => crypto.randomUUID();

export const requestLogger = createMiddleware(async (c, next) => {
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const requestId = createRequestId();

  c.header(REQUEST_ID_HEADER, requestId);

  try {
    await next();
  } finally {
    const path = new URL(c.req.url).pathname;
    const source =
      path === "/health" &&
        c.req.header(HEALTH_PROBE_HEADER) === HEALTH_PROBE_VALUE
        ? "docker-health"
        : "client";
    const record: RequestLogRecord = {
      requestId,
      timestamp,
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs: performance.now() - startedAt,
      origin: c.req.header("origin") ?? "-",
      source,
    };

    if (env.NODE_ENV !== "test") {
      const colorEnabled = Bun.env["NO_COLOR"] !== "1";
      const output = env.NODE_ENV === "production"
        ? formatRequestJson(record)
        : source === "docker-health"
        ? formatHealthProbe(record, colorEnabled)
        : formatRequestCard(record, colorEnabled);

      console.info(output);
    }
  }
});
