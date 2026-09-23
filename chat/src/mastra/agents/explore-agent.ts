/**
 * [INPUT]: 依赖 config/models 的固定模型、config/env 输出预算与 explore 系统提示词
 * [OUTPUT]: 对外提供无工具、无记忆、仅做关联判断与理由生成的 exploreAgent
 * [POS]: agents 子域探索判断器，一次只判断一篇候选；召回由数据库负责，并行调度、引文复核与排序由 Workflow/契约层负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { explorePrompt } from "@/mastra/prompts/explore";

export const exploreAgent = new Agent({
  id: "explore-agent",
  name: "Folune 关联判断器",
  instructions: explorePrompt,
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  defaultOptions: {
    modelSettings: {
      // 判断本身只有四个字段，但推理与正文共享同一预算；给小了会「思考塞满、正文为空」
      maxOutputTokens: Math.min(env.MAX_OUTPUT_TOKENS, 16_384),
    },
  },
});
