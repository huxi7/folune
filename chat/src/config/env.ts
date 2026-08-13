/**
 * [INPUT]: 依赖 zod 的运行时校验能力与服务进程环境变量
 * [OUTPUT]: 对外提供经过校验、转换并冻结的 chat 服务 env 配置
 * [POS]: config 层唯一环境入口，集中约束运行模式、服务名、端口、CORS、Supabase 鉴权、Business API、唯一模型与整理阈值/预算
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SYSTEM_NAME: z.string().trim().min(1).default("SuperNote Chat"),
  PORT: z.coerce.number().int().min(1).max(65_535),
  ALLOWED_ORIGINS: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  SUPABASE_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .startsWith("sb_publishable_"),
  BUSINESS_API_BASE_URL: z
    .url()
    .default("http://localhost:10001")
    .transform((value) => value.replace(/\/+$/, "")),
  DEEPSEEK_API_KEY: z.string().trim().min(1),
  DEFAULT_MODEL: z
    .literal("deepseek/deepseek-v4-flash")
    .default("deepseek/deepseek-v4-flash"),
  MAX_STEPS: z.coerce.number().int().min(1).default(50),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).default(393_216),
  ORGANIZE_AUTO_APPLY_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.85),
});

const result = envSchema.safeParse({
  NODE_ENV: process.env["NODE_ENV"],
  SYSTEM_NAME: process.env["SYSTEM_NAME"],
  PORT: process.env["PORT"],
  ALLOWED_ORIGINS: process.env["ALLOWED_ORIGINS"],
  SUPABASE_URL: process.env["SUPABASE_URL"],
  SUPABASE_PUBLISHABLE_KEY: process.env["SUPABASE_PUBLISHABLE_KEY"],
  BUSINESS_API_BASE_URL: process.env["BUSINESS_API_BASE_URL"],
  DEEPSEEK_API_KEY: process.env["DEEPSEEK_API_KEY"],
  DEFAULT_MODEL: process.env["DEFAULT_MODEL"],
  MAX_STEPS: process.env["MAX_STEPS"],
  MAX_OUTPUT_TOKENS: process.env["MAX_OUTPUT_TOKENS"],
  ORGANIZE_AUTO_APPLY_CONFIDENCE:
    process.env["ORGANIZE_AUTO_APPLY_CONFIDENCE"],
});

if (!result.success) {
  const reasons = result.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid chat environment: ${reasons}`);
}

export const env = Object.freeze(result.data);
export type Env = typeof env;
