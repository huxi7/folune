/**
 * [INPUT]: 依赖 Hono 路由、health DTO、health service 与 common/response 的 ok helper
 * [OUTPUT]: 对外提供挂载 GET / 的 healthRouter
 * [POS]: router 层的 /health HTTP 适配器，只校验边界、调用 service 并返回统一信封
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Hono } from "hono";

import { ok } from "../common/response.ts";
import { healthDataSchema } from "../dto/health.dto.ts";
import { healthService } from "../service/health.service.ts";

export const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  const data = healthDataSchema.parse(healthService.getStatus());

  return ok(c, data);
});
