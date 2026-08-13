/**
 * [INPUT]: 依赖 config/models 的固定模型、config/env 输出预算与 organize-planner 系统提示词
 * [OUTPUT]: 对外提供无工具、无记忆、仅用于结构化 OrganizePlan 的 organizePlannerAgent
 * [POS]: agents 子域整理推理器，只做语义判断；所有写操作、幂等、revision 与确认规则留在 API/Workflow
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { organizePlannerPrompt } from "@/mastra/prompts/organize-planner";

export const organizePlannerAgent = new Agent({
  id: "organize-planner-agent",
  name: "SuperNote 整理规划器",
  instructions: organizePlannerPrompt,
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: Math.min(env.MAX_OUTPUT_TOKENS, 4_096),
    },
  },
});
