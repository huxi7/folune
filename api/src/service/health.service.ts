/**
 * [INPUT]: 依赖 model/health.model 的 HealthStatus 领域类型
 * [OUTPUT]: 对外提供 healthService.getStatus 健康状态用例
 * [POS]: service 层的健康检查业务入口，不依赖 Hono Context
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { HealthStatus } from "../model/health.model.ts";

export const healthService = {
  getStatus(): HealthStatus {
    return { status: "healthy" };
  },
};
