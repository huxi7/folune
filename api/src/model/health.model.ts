/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型
 * [OUTPUT]: 对外提供 HealthStatus 健康状态领域模型
 * [POS]: model 层的健康检查领域语义，被 health service 返回并由 DTO 校验
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface HealthStatus {
  status: "healthy";
}
