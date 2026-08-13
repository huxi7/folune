/**
 * [INPUT]: 依赖 zod 的严格对象、枚举和长度约束
 * [OUTPUT]: 对外提供 approval-agent 唯一结构化输出契约、审批决定类型与 fail-closed 手工兜底常量
 * [POS]: lib 层模型审批与执行协调器之间的窄协议；模型不能携带工具、命令或任意状态越过该边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approve", "manual", "deny"]),
  risk: z.enum(["low", "medium", "high"]),
  reason: z.string().trim().min(1).max(1000),
}).strict();

export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const MANUAL_APPROVAL_FALLBACK: ApprovalDecision = {
  decision: "manual",
  risk: "high",
  reason: "审批判断不可用，已安全转为人工确认。",
};
