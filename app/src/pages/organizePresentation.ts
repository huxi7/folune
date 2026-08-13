/**
 * [INPUT]: 依赖 AiRunStatus 类型
 * [OUTPUT]: 对外提供整理 Run 到 Workspace 工具唤醒目标的纯决策 getOrganizeWakeTarget
 * [POS]: app/src/pages 的整理表现策略边界；隔离业务 Hook 与无副作用测试，确保失败/stale 不唤醒工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRunStatus } from "../shared/api/ai";

export const getOrganizeWakeTarget = (
  status: AiRunStatus,
): "assistant" | "library" | null => {
  if (status === "awaiting_confirmation") return "assistant";
  if (status === "succeeded" || status === "undone") return "library";
  return null;
};
