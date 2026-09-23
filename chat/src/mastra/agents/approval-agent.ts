/**
 * [INPUT]: 依赖 config/models 固定模型、config/env 输出预算与 approval-agent 系统提示词
 * [OUTPUT]: 对外提供无工具、无记忆、无子代理、只产生 ApprovalDecision 的 approvalAgent
 * [POS]: agents 子域独立审批器，不作为 memoAgent 子代理注册；Chat 协调器显式调用，避免执行者自我批准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { approvalAgentPrompt } from "@/mastra/prompts/approval-agent";

export const approvalAgent = new Agent({
  id: "approval-agent",
  name: "Folune 独立审批器",
  instructions: approvalAgentPrompt,
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: Math.min(env.MAX_OUTPUT_TOKENS, 1_024),
    },
  },
});
