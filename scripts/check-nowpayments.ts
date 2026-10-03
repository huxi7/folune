/**
 * [INPUT]: 依赖统一 API 配置、网关预检、支付角色/环境读取
 * [OUTPUT]: 输出无秘密的 API/商户发现/数据库状态和缺失字段，开账本前也能验证数据库身份
 * [POS]: 部署前诊断入口；IPN、定时器与实际到账仍须分别联调验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { paymentProvider } from "../api/src/lib/payment-provider.ts";
import { paymentRepository } from "../api/src/repository/payment.repository.ts";
import { env } from "../api/src/config/env.ts";
import { HttpError } from "../api/src/common/http-error.ts";
import { checkNowpaymentsConnection } from "../api/src/lib/nowpayments.ts";

try {
  const result = await checkNowpaymentsConnection(env);
  let database = "not_configured";
  if (env.PAYMENT_DB_JWT) {
    await paymentRepository.list();
    database = "role_and_environment_verified";
  }
  const required = ["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET", "NOWPAYMENTS_EMAIL",
    "NOWPAYMENTS_PASSWORD", "PAYMENT_APP_ORIGIN", "PAYMENT_API_ORIGIN", "PAYMENT_DB_JWT",
    "PAYMENT_RECONCILE_SECRET", "BILLING_USAGE_SECRET"] as const;
  const missing = required.filter(key => !env[key]);
  const { merchant_currencies, ...connection } = result;
  process.stdout.write(
    `${JSON.stringify({ ...connection, merchant_currency_count: merchant_currencies.length, database,
      missing_configuration: missing, ledger_enabled: env.BILLING_LEDGER_ENABLED,
      checkout_enabled: env.PAYMENT_CHECKOUT_ENABLED, checkout_available: paymentProvider.availability.available }, null, 2)}\n`,
  );
  process.stdout.write("配置/连通检查不能代替真实 IPN、付款和定时调度验收。\n");
  if (
    result.api_key === "missing" ||
    result.ipn_secret === "missing" ||
    result.merchant_currencies.length === 0 ||
    result.discovery_auth !== "accepted" ||
    database === "not_configured" || missing.length > 0
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  const message =
    error instanceof HttpError
      ? `${error.code}: ${error.message}`
      : "支付配置检查失败。";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
