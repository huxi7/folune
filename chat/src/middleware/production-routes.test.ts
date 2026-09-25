/**
 * [INPUT]: 依赖 Bun test 与 productionRouteGuard 的路径隔离契约
 * [OUTPUT]: 验证框架执行入口不可绕过 Folune 路由，正常业务与跨域预检可继续下传
 * [POS]: Chat 生产发布门禁，不访问真实数据库或模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { expect, test } from "bun:test";
import { productionRouteGuard } from "./production-routes";

test("生产仅开放 Folune 业务路径，框架接口和近似路径返回 404", async () => {
  for (const path of ["/api/agents", "/api/agents/memo-agent/generate", "/api/workflows", "/swagger-ui", "/v1/chat/extra", "/api/../api/agents"]) {
    let continued = false;
    const context = {
      req: { url: `https://chat.example.com${path}` },
      json: (body: unknown, status: number) => Response.json(body, { status }),
    } as unknown as Parameters<typeof productionRouteGuard>[0];
    const result = await productionRouteGuard(context, async () => { continued = true; });
    expect(result?.status).toBe(404);
    expect(continued).toBe(false);
  }
});

test("健康检查和业务请求包括预检继续交由现有路由处理", async () => {
  for (const path of ["/health", "/v1/chat", "/v1/organize", "/v1/explore", "/v1/canvas-expand"]) {
    let continued = false;
    const context = {
      req: { url: `https://chat.example.com${path}?test=1`, method: "OPTIONS" },
    } as unknown as Parameters<typeof productionRouteGuard>[0];
    await productionRouteGuard(context, async () => { continued = true; });
    expect(continued).toBe(true);
  }
});
