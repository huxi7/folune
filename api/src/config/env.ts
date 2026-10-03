/**
 * [INPUT]: 依赖 zod 与服务端进程环境
 * [OUTPUT]: 提供独立账本/开售门禁、NOWPayments/受限支付 JWT/调度/记账配置
 * [POS]: 唯一秘密读取入口；校验受限角色和 HTTPS 来源，开售不能跳过账本和对账配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

const DEFAULT_CORS_ORIGINS =
  "http://localhost:10000,http://127.0.0.1:10000";

const optionalSecret = z.string().trim().default("").transform(value => value || undefined);
// 登录密码区分大小写和空格；不能像 API Key 一样 trim 改写。
const optionalPassword = z.string().default("").transform(value => value || undefined);

const enabled = z.enum(["true", "false"]).default("false").transform(value => value === "true");
const optionalOrigin = z.string().trim().default("").refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === value && !url.username && !url.password; } catch { return false; }
}, "Must be an HTTPS origin without a trailing slash").transform(value => value || undefined);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(10_001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SYSTEM_NAME: z.string().trim().min(1).default("Folune API"),
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
  // 每 UTC 日 token 额度（输入+输出总和）；只有已验证、有效的付费订阅能取得对应上限。
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().min(1).default(100_000),
  AI_STARTER_DAILY_TOKEN_LIMIT: z.coerce.number().int().min(1).default(2_000_000),
  AI_PRO_DAILY_TOKEN_LIMIT: z.coerce.number().int().min(1).default(10_000_000),
  AI_STUDIO_DAILY_TOKEN_LIMIT: z.coerce.number().int().min(1).default(50_000_000),
  NOWPAYMENTS_ENV: z.enum(["sandbox", "production"]).default("production"),
  NOWPAYMENTS_API_KEY: optionalSecret,
  NOWPAYMENTS_IPN_SECRET: optionalSecret,
  NOWPAYMENTS_EMAIL: optionalSecret,
  NOWPAYMENTS_PASSWORD: optionalPassword,
  PAYMENT_APP_ORIGIN: optionalOrigin,
  PAYMENT_API_ORIGIN: optionalOrigin,
  PAYMENT_DB_JWT: optionalSecret,
  PAYMENT_RECONCILE_SECRET: optionalSecret,
  BILLING_USAGE_SECRET: optionalSecret,
  BILLING_LEDGER_ENABLED: enabled,
  PAYMENT_CHECKOUT_ENABLED: enabled,
  PAYMENT_ADMIN_IDS: z.string().default("").transform(value => value.split(",").map(x => x.trim()).filter(Boolean)).pipe(z.array(z.uuid())),
});

const result = envSchema.safeParse({
  PORT: Bun.env["PORT"],
  NODE_ENV: Bun.env["NODE_ENV"],
  SYSTEM_NAME: Bun.env["SYSTEM_NAME"],
  CORS_ORIGINS: Bun.env["CORS_ORIGINS"],
  SUPABASE_URL: Bun.env["SUPABASE_URL"],
  SUPABASE_PUBLISHABLE_KEY: Bun.env["SUPABASE_PUBLISHABLE_KEY"],
  AI_DAILY_TOKEN_LIMIT: Bun.env["AI_DAILY_TOKEN_LIMIT"],
  AI_STARTER_DAILY_TOKEN_LIMIT: Bun.env["AI_STARTER_DAILY_TOKEN_LIMIT"],
  AI_PRO_DAILY_TOKEN_LIMIT: Bun.env["AI_PRO_DAILY_TOKEN_LIMIT"],
  AI_STUDIO_DAILY_TOKEN_LIMIT: Bun.env["AI_STUDIO_DAILY_TOKEN_LIMIT"],
  NOWPAYMENTS_ENV: Bun.env["NOWPAYMENTS_ENV"],
  NOWPAYMENTS_API_KEY: Bun.env["NOWPAYMENTS_API_KEY"],
  NOWPAYMENTS_IPN_SECRET: Bun.env["NOWPAYMENTS_IPN_SECRET"],
  NOWPAYMENTS_EMAIL: Bun.env["NOWPAYMENTS_EMAIL"],
  NOWPAYMENTS_PASSWORD: Bun.env["NOWPAYMENTS_PASSWORD"],
  PAYMENT_APP_ORIGIN: Bun.env["PAYMENT_APP_ORIGIN"],
  PAYMENT_API_ORIGIN: Bun.env["PAYMENT_API_ORIGIN"],
  PAYMENT_DB_JWT: Bun.env["PAYMENT_DB_JWT"],
  PAYMENT_RECONCILE_SECRET: Bun.env["PAYMENT_RECONCILE_SECRET"],
  BILLING_USAGE_SECRET: Bun.env["BILLING_USAGE_SECRET"],
  BILLING_LEDGER_ENABLED: Bun.env["BILLING_LEDGER_ENABLED"],
  PAYMENT_CHECKOUT_ENABLED: Bun.env["PAYMENT_CHECKOUT_ENABLED"],
  PAYMENT_ADMIN_IDS: Bun.env["PAYMENT_ADMIN_IDS"],

});

if (!result.success) {
  const reasons = result.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid API environment: ${reasons}`);
}

if (result.data.BILLING_LEDGER_ENABLED && (!result.data.PAYMENT_DB_JWT || !result.data.BILLING_USAGE_SECRET)) {
  throw new Error("Billing ledger requires PAYMENT_DB_JWT and BILLING_USAGE_SECRET");
}
if (result.data.PAYMENT_DB_JWT) {
  try {
    const claims=JSON.parse(Buffer.from(result.data.PAYMENT_DB_JWT.split(".")[1] ?? "","base64url").toString());
    if (claims.role !== "folune_billing" || typeof claims.exp !== "number" || claims.exp*1000<=Date.now()) throw new Error();
  } catch { throw new Error("PAYMENT_DB_JWT must be an unexpired folune_billing token"); }
}
if (result.data.PAYMENT_CHECKOUT_ENABLED && (!result.data.BILLING_LEDGER_ENABLED || !result.data.NOWPAYMENTS_API_KEY || !result.data.NOWPAYMENTS_IPN_SECRET ||
  !result.data.NOWPAYMENTS_EMAIL || !result.data.NOWPAYMENTS_PASSWORD || !result.data.PAYMENT_APP_ORIGIN || !result.data.PAYMENT_API_ORIGIN || !result.data.PAYMENT_RECONCILE_SECRET)) {
  throw new Error("Payment checkout requires the ledger, NOWPayments credentials, HTTPS origins and reconciliation configuration");
}
export const env = Object.freeze(result.data);
export type Env = typeof env;
