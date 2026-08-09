/**
 * [INPUT]: 依赖 prompts/memoAgentPrompt、config/models 唯一 DeepSeek V4 Flash 模型与 config/env 输出预算
 * [OUTPUT]: 对外提供无静态工具、无记忆的 memoAgent，客户端工具只在请求期注入
 * [POS]: agents 子域的对话推理能力，负责语言交互与工具选择；浏览器工具契约由 chat 路由按请求注入，避免无 execute 工具回退为服务端执行
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
