/**
 * [INPUT]: 依赖统一 env 与 NOWPayments 网关适配器
 * [OUTPUT]: 提供真实配置门禁和单一 NOWPayments 客户端
 * [POS]: 支付基础设施选择边界；开售开关与已购买权益读取相互独立
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { env } from "../config/env.ts";
import { nowpaymentsClient } from "./nowpayments.ts";
export const paymentProvider = {
  get availability() {
    const available = Boolean(
      env.BILLING_LEDGER_ENABLED &&
      env.PAYMENT_CHECKOUT_ENABLED &&
      env.NOWPAYMENTS_API_KEY &&
      env.NOWPAYMENTS_IPN_SECRET &&
      env.PAYMENT_DB_JWT &&
      env.PAYMENT_APP_ORIGIN &&
      env.PAYMENT_API_ORIGIN &&
      env.PAYMENT_RECONCILE_SECRET &&
      env.NOWPAYMENTS_EMAIL &&
      env.NOWPAYMENTS_PASSWORD,
    );
    return { available, provider: available ? "nowpayments" : null };
  },
  client: nowpaymentsClient(env),
};
