/**
 * [INPUT]: 依赖 config/env 中仅存在于服务端的 provider 凭据
 * [OUTPUT]: 对外提供仅含 DeepSeek V4 Flash 的模型白名单、resolveModel 与 Mastra 配置转换
 * [POS]: config 层唯一模型信任边界，拒绝任何模型切换并阻止 API key 进入代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MastraModelConfig } from "@mastra/core/llm";

import { env } from "@/config/env";

type ModelDefinition = {
  id: `${string}/${string}`;
  url: string;
  apiKeyEnv: "DEEPSEEK_API_KEY";
};

export const MODEL_WHITELIST = {
  "deepseek/deepseek-v4-flash": {
    id: "deepseek/deepseek-v4-flash",
    url: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
} as const satisfies Record<string, ModelDefinition>;

export const resolveModel = (id: string): ModelDefinition => {
  const model = MODEL_WHITELIST[id as keyof typeof MODEL_WHITELIST];

  if (!model) {
    throw new Error(`Unsupported chat model: ${id}`);
  }

  return model;
};

export const toMastraModelConfig = (id: string): MastraModelConfig => {
  const model = resolveModel(id);

  return {
    url: model.url,
    id: model.id,
    apiKey: env[model.apiKeyEnv],
  };
};
