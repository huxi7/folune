/**
 * [INPUT]: 依赖 prompts/memoAgentPrompt、config/models 唯一 DeepSeek V4 Flash 模型与 config/env 输出预算
 * [OUTPUT]: 对外提供无工具、无记忆的 memoAgent 纯聊天 Agent
 * [POS]: agents 子域首个对话能力，专注语言交互并把系统指令与模型配置留在各自资产层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { memoAgentPrompt } from "@/mastra/prompts";

export const memoAgent = new Agent({
  id: "memo-agent",
  name: "SuperNote 备忘录助手",
  instructions: memoAgentPrompt,
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    },
  },
});
