/**
 * [INPUT]: 依赖支付仓储、NOWPayments 适配器、服务端报价与已验证用户身份
 * [OUTPUT]: 提供统一结账、IPN 查单和对账；用户/管理投影均阻止旧固定报价继续导航
 * [POS]: 支付编排和权限唯一所有者；只有经过签名且重新查单或主动对账取得的事实可进入发放事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "../common/http-error.ts";
import { env } from "../config/env.ts";
import { paymentProvider } from "../lib/payment-provider.ts";
import {
  providerId,
  requireOriginalPayment,
  verifyNowpaymentsIpn,
} from "../lib/nowpayments.ts";
import { usdCents } from "../lib/payment-amount.ts";
import { paymentRepository as repo } from "../repository/payment.repository.ts";
import { publicOrder, type PaymentOrder } from "../model/payment.model.ts";
import type { CheckoutResult } from "../model/billing.model.ts";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function requireInternalSecret(
  received: string | undefined,
  expected: string | undefined,
) {
  if (
    !expected ||
    !received ||
    !timingSafeEqual(
      Buffer.from(digest(received)),
      Buffer.from(digest(expected)),
    )
  )
    throw new HttpError(401, "UNAUTHORIZED", "服务身份验证失败。");
}
async function findOrder(id: string, userId?: string) {
  const order = await repo.get(id);
  if (!order || (userId && order.user_id !== userId))
    throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在。");
  return order;
}
async function applyPayment(order: PaymentOrder, paymentId: string) {
  const payment = await paymentProvider.client.getPayment(paymentId);
  if (
    payment.order_id !== order.id ||
    payment.price_currency !== "usd" ||
    usdCents(payment.price_amount) !== order.amount_cents ||
    (order.invoice_id && payment.invoice_id !== order.invoice_id)
  )
    throw new HttpError(
      409,
      "PAYMENT_MISMATCH",
      "付款与订单不匹配，需要人工核查。",
    );
  return repo.apply(order, payment);
}
async function reconcile(order: PaymentOrder) {
  try {
    const ids =
      order.payment_id && order.fulfilled_at
        ? [order.payment_id]
        : await paymentProvider.client.discoverPayments(order);
    if (ids.length > 1)
      throw new HttpError(
        409,
        "PAYMENT_MULTIPLE_ATTEMPTS",
        "订单存在多笔付款，需人工核查。",
      );
    const updated = ids[0]
      ? await applyPayment(order, ids[0])
      : await repo.patch(
          order.id,
          {
            ...(order.status === "creating" &&
            Date.now() - Date.parse(order.created_at) > 300_000
              ? { status: "review", error_code: "INVOICE_RESULT_UNKNOWN" }
              : {}),
            last_checked_at: new Date().toISOString(),
            next_check_at: new Date(Date.now() + 120_000).toISOString(),
            lease_until: null,
            lease_id: null,
          },
          order.status,
        );
    await repo.event({
      order_id: order.id,
      source: "poll",
      digest: crypto.randomUUID(),
      outcome: ids.length ? "verified" : "no_payment",
    });
    return updated;
  } catch (error) {
    const code =
      error instanceof HttpError ? error.code : "PAYMENT_RECONCILE_FAILED";
    await repo.patch(
      order.id,
      {
      ...((code === "PAYMENT_MULTIPLE_ATTEMPTS" || code === "PAYMENT_DEPOSIT_REQUIRES_REVIEW") &&
      !order.fulfilled_at && !order.refunded_at ? { status: "review" } : {}),
        error_code: code,
        next_check_at: new Date(Date.now() + 300_000).toISOString(),
        lease_until: null,
        lease_id: null,
      },
      order.status,
    );
    await repo.event({
      order_id: order.id,
      source: "poll",
      digest: crypto.randomUUID(),
      outcome: code,
    });
    throw error;
  }
}
export const paymentService = {
  async checkout(input: {
    user_id: string;
    key: string;
    kind: "credits" | "subscription";
    sku: string;
    interval: "monthly" | "yearly" | null;
    amount: number;
    tokens: number;
  }): Promise<CheckoutResult> {
    if (!paymentProvider.availability.available)
      return {
        status: "unavailable",
        code: "PAYMENT_NOT_CONFIGURED",
        message:
          input.kind === "credits" ? "积分购买即将开放" : "在线订阅即将开放",
        checkout_url: null,
      };
    let order = await repo.prepare(input);
    if (
      order.checkout_url &&
      !order.is_fixed_rate &&
      ["pending", "confirming", "partially_paid"].includes(order.status)
    )
      return {
        status: "ready",
        checkout_url: order.checkout_url,
        order_id: order.id,
      };
    if (order.status !== "created" || !(await repo.claimInvoice(order.id)))
      return {
        status: "pending",
        order_id: order.id,
        message: "订单正在核对，请在订单记录中查看进度。",
      };
    try {
      const invoice = await paymentProvider.client.createInvoice(order);
      order = await repo.attachInvoice(
        order.id,
        invoice.invoice_id,
        invoice.checkout_url,
      );
      await repo.event({
        order_id: order.id,
        source: "checkout",
        digest: order.id,
        outcome: "invoice_created",
      });
      return {
        status: "ready",
        checkout_url: invoice.checkout_url,
        order_id: order.id,
      };
    } catch (error) {
      // 任何超时都可能已经创建发票，不自动重发；后台用 order_id 发现已付款记录。
      await repo.patch(order.id, {
        error_code: "INVOICE_RESULT_UNKNOWN",
        next_check_at: new Date().toISOString(),
      });
      await repo.event({
        order_id: order.id,
        source: "checkout",
        digest: order.id,
        outcome: "invoice_result_unknown",
      });
      throw error;
    }
  },
  async ipn(raw: string, signature: string | undefined) {
    const hash = digest(raw);
    let order: PaymentOrder | null = null;
    try {
      const body = verifyNowpaymentsIpn(
        raw,
        signature,
        env.NOWPAYMENTS_IPN_SECRET,
      );
      const id = body["order_id"];
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
        throw new HttpError(400, "PAYMENT_ORDER_INVALID", "通知订单无效。");
      order = await findOrder(id);
      requireOriginalPayment(body);
      const paymentId = providerId(body["payment_id"]);
      const updated = await applyPayment(order, paymentId);
      await repo.event({
        order_id: order.id,
        source: "ipn",
        digest: hash,
        payment_id: paymentId,
        outcome: "verified",
        provider_status: updated.status,
      });
    } catch (error) {
      await repo.event({
        order_id: order?.id ?? null,
        source: "ipn",
        digest: hash,
        outcome: error instanceof HttpError ? error.code : "PAYMENT_IPN_FAILED",
      });
      throw error;
    }
  },
  async list(userId: string) {
    return (await repo.list(userId)).map(publicOrder);
  },
  async get(id: string, userId: string) {
    return publicOrder(await findOrder(id, userId));
  },
  async refresh(id: string, userId: string) {
    const order = await findOrder(id, userId);
    // 避免页面轮询把供应商打满；真正兜底由独立 scheduler 执行。
    if (
      order.last_checked_at &&
      Date.now() - Date.parse(order.last_checked_at) < 30_000
    )
      return publicOrder(order);
    return publicOrder(await reconcile(order));
  },
  requireAdmin(userId: string) {
    if (!env.PAYMENT_ADMIN_IDS.includes(userId))
      throw new HttpError(403, "FORBIDDEN", "没有支付管理权限。");
  },
  async adminOrders() {
    return (await repo.list()).map(order => ({ ...order, ...publicOrder(order) }));
  },
  async adminEvents(id?: string) {
    if (id) await findOrder(id);
    return repo.events(id);
  },
  async adminRefresh(id: string, paymentId?: string) {
    const order = await findOrder(id);
    if (!paymentId) return reconcile(order);
    const updated = await applyPayment(order, paymentId);
    await repo.event({
      order_id: id,
      source: "admin",
      digest: crypto.randomUUID(),
      payment_id: paymentId,
      outcome: "authoritative_payment_verified",
    });
    return updated;
  },
  async reconcileDue() {
    const orders = await repo.claimDue();
    const results = [];
    const deadline = Date.now() + 180_000;
    for (const order of orders) {
      if (Date.now() > deadline) {
        results.push({ id: order.id, error: "PAYMENT_RECONCILE_BUDGET" });
        break;
      }
      try {
        results.push({ id: order.id, status: (await reconcile(order)).status });
      } catch (error) {
        results.push({
          id: order.id,
          error:
            error instanceof HttpError
              ? error.code
              : "PAYMENT_RECONCILE_FAILED",
        });
      }
    }
    return results;
  },
};
