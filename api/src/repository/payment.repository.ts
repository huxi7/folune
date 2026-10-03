/**
 * [INPUT]: 依赖受限 folune_billing JWT、统一 PostgREST 与支付模型
 * [OUTPUT]: 提供环境验证、订单/事件/周期/钱包操作及受控事务 RPC
 * [POS]: 支付专用服务身份边界，普通资源仍使用用户 JWT，所有存储错误净化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { HttpError } from "../common/http-error.ts";
import { env } from "../config/env.ts";
import {
  supabaseRest,
  createPostgrestQuery,
  postgrestErrorCode,
} from "../lib/supabase-rest.ts";
import type { PaymentOrder, VerifiedPayment } from "../model/payment.model.ts";
import { usdCents } from "../lib/payment-amount.ts";

async function call<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  if (!env.PAYMENT_DB_JWT)
    throw new HttpError(503, "PAYMENT_NOT_CONFIGURED", "支付数据库尚未配置。");
  try {
    const binding = await supabaseRest<{ environment: string }[]>(
      "billing_environment?select=environment",
      { accessToken: env.PAYMENT_DB_JWT },
    );
    if (
      binding?.length !== 1 ||
      binding[0]?.environment !== env.NOWPAYMENTS_ENV
    )
      throw new HttpError(
        503,
        "PAYMENT_ENVIRONMENT_MISMATCH",
        "支付数据库环境不匹配。",
      );
    return (await supabaseRest<T>(path, {
      accessToken: env.PAYMENT_DB_JWT,
      ...(body === undefined
        ? {}
        : {
            method: method ?? "POST",
            body: JSON.stringify(body),
            returnRepresentation: true,
          }),
    })) as T;
  } catch (error) {
    if (
      error instanceof HttpError &&
      error.code === "PAYMENT_ENVIRONMENT_MISMATCH"
    )
      throw error;
    if (postgrestErrorCode(error) === "23505")
      throw new HttpError(
        409,
        "PAYMENT_CONFLICT",
        "订单请求冲突，请刷新后重试。",
      );
    throw new HttpError(
      503,
      "PAYMENT_STORAGE_UNAVAILABLE",
      "支付记录暂时不可用，请稍后重试。",
    );
  }
}
const rpc = <T>(name: string, body: unknown) => call<T>(`rpc/${name}`, body);
export const paymentRepository = {
  async get(id: string) {
    return (
      (
        await call<PaymentOrder[]>(
          `billing_orders${createPostgrestQuery({ eq: { id, environment: env.NOWPAYMENTS_ENV }, limit: 1 })}`,
        )
      )[0] ?? null
    );
  },
  async list(userId?: string) {
    return call<PaymentOrder[]>(
      `billing_orders${createPostgrestQuery({ eq: { environment: env.NOWPAYMENTS_ENV, ...(userId ? { user_id: userId } : {}) }, order: { column: "created_at", ascending: false }, limit: 100 })}`,
    );
  },
  prepare(input: {
    user_id: string;
    key: string;
    kind: string;
    sku: string;
    interval: string | null;
    amount: number;
    tokens: number;
  }) {
    return rpc<PaymentOrder>("billing_prepare_order", {
      p_user_id: input.user_id,
      p_environment: env.NOWPAYMENTS_ENV,
      p_key: input.key,
      p_kind: input.kind,
      p_sku: input.sku,
      p_interval: input.interval,
      p_amount: input.amount,
      p_tokens: input.tokens,
    });
  },
  attachInvoice(id: string, invoice: string, url: string) {
    return rpc<PaymentOrder>("billing_attach_invoice", {
      p_id: id,
      p_invoice: invoice,
      p_url: url,
    });
  },
  claimInvoice(id: string) {
    return rpc<boolean>("billing_claim_invoice", { p_id: id });
  },
  async patch(id: string, patch: Record<string, unknown>, expectedStatus?: string) {
    return (
      await call<PaymentOrder[]>(
        `billing_orders${createPostgrestQuery({ eq: { id, environment: env.NOWPAYMENTS_ENV, ...(expectedStatus ? {status:expectedStatus} : {}) } })}`,
        patch,
        "PATCH",
      )
    )[0] ?? await paymentRepository.get(id) as PaymentOrder;
  },
  apply(order: PaymentOrder, payment: VerifiedPayment) {
    return rpc<PaymentOrder>("billing_apply_payment", {
      p_id: order.id,
      p_environment: env.NOWPAYMENTS_ENV,
      p_payment: payment.payment_id,
      p_invoice: payment.invoice_id,
      p_status: payment.payment_status,
      p_amount_cents: usdCents(payment.price_amount),
      p_paid: payment.actually_paid,
      p_expected: payment.pay_amount,
      p_updated: payment.updated_at,
    });
  },
  claimDue() {
    return rpc<PaymentOrder[]>("billing_claim_due", {
      p_environment: env.NOWPAYMENTS_ENV,
      p_lease: crypto.randomUUID(),
      p_limit: 10,
    });
  },
  async event(input: {
    order_id: string | null;
    source: string;
    digest: string;
    payment_id?: string;
    provider_status?: string;
    outcome: string;
  }) {
    // 同一签名通知重送覆盖处理结果；不是按 payment_id 去重后续状态。
    if (!env.PAYMENT_DB_JWT) return;
    try {
      await supabaseRest(
        "billing_events?on_conflict=environment,source,digest",
        {
          accessToken: env.PAYMENT_DB_JWT,
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ ...input, environment: env.NOWPAYMENTS_ENV }),
        },
      );
    } catch {
      throw new HttpError(
        503,
        "PAYMENT_AUDIT_UNAVAILABLE",
        "支付审计记录暂时不可用。",
      );
    }
  },
  events(orderId?: string) {
    return call<unknown[]>(
      `billing_events${createPostgrestQuery({ eq: { ...(orderId ? { order_id: orderId } : {}), environment: env.NOWPAYMENTS_ENV }, order: { column: "received_at", ascending: false }, limit: 100 })}`,
    );
  },
  async wallet(userId: string) {
    return (
      (
        await call<{ balance_tokens: number }[]>(
          `billing_wallets${createPostgrestQuery({ eq: { user_id: userId }, select: "balance_tokens", limit: 1 })}`,
        )
      )[0]?.balance_tokens ?? 0
    );
  },
  async periods(userId: string) {
    return call<
      {
        plan_id: "starter" | "pro" | "studio";
        billing_interval: "monthly" | "yearly";
        starts_at: string;
        ends_at: string;
      }[]
    >(
      `billing_subscription_periods${createPostgrestQuery({ eq: { user_id: userId }, is: { revoked_at: null }, order: { column: "starts_at" }, limit: 1000 })}`,
    );
  },
  async usage(userId: string, date: string) {
    return (
      (
        await call<{ total_tokens: number; free_tokens_used: number }[]>(
          `ai_usage_daily${createPostgrestQuery({ eq: { user_id: userId, usage_date: date }, select: "total_tokens,free_tokens_used", limit: 1 })}`,
        )
      )[0] ?? { total_tokens: 0, free_tokens_used: 0 }
    );
  },
  recordUsage(userId: string, id: string, tokens: number, limit: number) {
    return rpc<number>("billing_record_usage", {
      p_user_id: userId,
      p_id: id,
      p_tokens: tokens,
      p_daily_limit: limit,
    });
  },
};
