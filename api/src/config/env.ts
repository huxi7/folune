/**
 * [INPUT]: 依赖 zod 的 schema 校验能力与 Bun.env 进程环境变量
 * [OUTPUT]: 对外提供经过校验、转换且不含默认真实凭据的 env 配置
 * [POS]: config 层唯一环境变量入口，集中约束端口、运行环境、系统名、CORS 与 Supabase Publishable key
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

const DEFAULT_CORS_ORIGINS =
  "http://localhost:10000,http://127.0.0.1:10000";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(10_001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SYSTEM_NAME: z.string().trim().min(1).default("SuperNote API"),
  CORS_ORIGINS: z
    .string()
    .default(DEFAULT_CORS_ORIGINS)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  SUPABASE_URL: z
    .url()
    .transform((value) => value.replace(/\/+$/, "")),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .startsWith("sb_publishable_"),
});

const result = envSchema.safeParse({
  PORT: Bun.env["PORT"],
  NODE_ENV: Bun.env["NODE_ENV"],
  SYSTEM_NAME: Bun.env["SYSTEM_NAME"],
  CORS_ORIGINS: Bun.env["CORS_ORIGINS"],
  SUPABASE_URL: Bun.env["SUPABASE_URL"],
  SUPABASE_PUBLISHABLE_KEY: Bun.env["SUPABASE_PUBLISHABLE_KEY"],
});

if (!result.success) {
  const reasons = result.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid API environment: ${reasons}`);
}

export const env = Object.freeze(result.data);
export type Env = typeof env;
