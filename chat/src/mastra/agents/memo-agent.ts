/**
 * [INPUT]: 依赖 prompts/memoAgentPrompt、celebrationTool、config/models 唯一 DeepSeek V4 Flash 模型与 config/env 输出预算
 * [OUTPUT]: 对外提供可调用“庆祝”浏览器工具、无记忆的 memoAgent
 * [POS]: agents 子域首个对话能力，负责语言交互与工具选择，把浏览器执行、系统指令和模型配置留在各自边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { memoAgentPrompt } from "@/mastra/prompts";
import { celebrationTool } from "@/mastra/tools/celebration";

export const memoAgent = new Agent({
  id: "memo-agent",
  name: "SuperNote 备忘录助手",
  instructions: memoAgentPrompt,
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  tools: {
    celebration: celebrationTool,
  },
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    },
  },
});
