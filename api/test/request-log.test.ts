/**
 * [INPUT]: 依赖 Bun test 与 middleware/request-log 的纯日志格式化能力
 * [OUTPUT]: 覆盖 ASCII 卡片定宽、状态/耗时着色、控制字符净化、健康摘要与生产 JSON 契约
 * [POS]: api/test 的请求可观测性回归测试，不启动服务、不连接 Supabase 且不处理真实请求凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  formatHealthProbe,
  formatRequestCard,
  formatRequestJson,
  type RequestLogRecord,
} from "../src/middleware/request-log.ts";

const baseRecord: RequestLogRecord = {
  requestId: "a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6",
  timestamp: "2026-08-05T13:50:49.533Z",
  method: "GET",
  path: "/profile",
  status: 200,
  durationMs: 12.34,
  origin: "http://localhost:10000",
  source: "client",
};

const recordWith = (
  overrides: Partial<RequestLogRecord>,
): RequestLogRecord => ({ ...baseRecord, ...overrides });

describe("formatRequestCard", () => {
  test("输出定宽 ASCII 请求卡片与完整分析字段", () => {
    const output = formatRequestCard(baseRecord, false);
    const lines = output.split("\n");

    expect(lines).toHaveLength(7);
    expect(lines.every((line) => line.length === 78)).toBe(true);
    expect(output).toContain(
      "HTTP REQUEST #a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6",
    );
    expect(output).toContain("GET /profile");
    expect(output).toContain("200 OK");
    expect(output).toContain("12.34 ms");
    expect(output).toContain("http://localhost:10000");
  });

  test("慢请求与服务端错误使用红色并显示 SLOW", () => {
    const output = formatRequestCard(
      recordWith({ status: 503, durationMs: 4_051.94 }),
      true,
    );

    expect(output).toContain("\u001B[31m");
    expect(output).toContain("503 SERVICE UNAVAILABLE");
    expect(output).toContain("4.05 s [SLOW]");
  });

  test("净化控制字符并截断超长值，避免破坏卡片边界", () => {
    const output = formatRequestCard(
      recordWith({
        path: `/profile\n\u001B[31m${"x".repeat(100)}`,
        origin: "http://localhost:10000\rspoofed",
      }),
      false,
    );

    expect(output).not.toContain("\u001B");
    expect(output.split("\n")).toHaveLength(7);
    expect(output.split("\n").every((line) => line.length === 78)).toBe(true);
  });
});

describe("compact and machine-readable formats", () => {
  test("Docker 健康探针保持单行低干扰摘要", () => {
    const output = formatHealthProbe(
      recordWith({ source: "docker-health" }),
      false,
    );

    expect(output.split("\n")).toHaveLength(1);
    expect(output).toContain("[HEALTH]");
    expect(output).toContain("#a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6");
    expect(output).toContain("200");
  });

  test("生产格式输出可解析的单行 JSON", () => {
    const output = formatRequestJson(recordWith({ durationMs: 8.126 }));
    const payload = JSON.parse(output) as Record<string, unknown>;

    expect(output.split("\n")).toHaveLength(1);
    expect(payload).toEqual({
      event: "http_request",
      request_id: "a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6",
      timestamp: "2026-08-05T13:50:49.533Z",
      method: "GET",
      path: "/profile",
      status: 200,
      duration_ms: 8.13,
      origin: "http://localhost:10000",
      source: "client",
    });
  });
});
