/**
 * [INPUT]: 依赖服务端结账/付款查询、共享权益刷新、Toast 与浏览器导航生命周期
 * [OUTPUT]: 提供一次点击结账、同意图幂等重试、取消隔离与后台付款核对
 * [POS]: 订阅与积分共用的购买编排；返回参数只定位付款，权益只认服务端确认
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createCheckout, createCreditCheckout, type CreditPackId } from "../shared/api/subscription";
import { getOrder, refreshOrder, openCheckout, checkoutUrl } from "../shared/api/payments";
import { useBilling } from "../shared/api/useBilling";
import { useToast } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";
import type { CheckoutState } from "../widgets/CheckoutTransition";

type PurchaseIntent =
  | { kind: "subscription"; plan_id: "starter" | "pro" | "studio"; billing_interval: "monthly" | "yearly" }
  | { kind: "credits"; pack_id: CreditPackId };
const REQUEST_TIMEOUT_MS = 15_000;
const CHECKOUT_POLL_MS = 2_000;
const PAYMENT_POLL_MS = 30_000;

function rememberPayment(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("order", id);
  window.history.replaceState(window.history.state, "", url);
}

export function useCheckoutFlow(kind: PurchaseIntent["kind"]) {
  const { t } = useLocale();
  const { refresh } = useBilling();
  const { toast } = useToast();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });
  const [paymentId, setPaymentId] = useState<string | null>(() => {
    const creditsPage = window.location.pathname.endsWith("/credits");
    return creditsPage === (kind === "credits") ? new URLSearchParams(window.location.search).get("order") : null;
  });
  const request = useRef<AbortController | null>(null);
  const attempt = useRef<{ intent: PurchaseIntent; signature: string; key: string } | null>(null);

  const reset = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(() => {
    // 浏览器后退可能恢复整个页面，不能把离开前的过渡层一起永久恢复。
    const resume = () => reset();
    window.addEventListener("pageshow", resume);
    return () => { request.current?.abort(); request.current = null; window.removeEventListener("pageshow", resume); };
  }, [reset]);

  useEffect(() => {
    if (!paymentId) return;
    let current = true;
    let controller: AbortController | null = null;
    let running = false;
    let notified = "";
    async function check() {
      if (running || !current) return;
      running = true;
      const active = new AbortController();
      controller = active;
      const timeout = window.setTimeout(() => active.abort(), REQUEST_TIMEOUT_MS);
      try {
        let order = await getOrder(paymentId!, active.signal);
        if (!current || active.signal.aborted) return;
        if (["created", "creating", "pending", "confirming", "partially_paid", "review"].includes(order.status)) {
          order = await refreshOrder(order.id, false, active.signal);
        }
        if (!current || active.signal.aborted) return;
        if (["paid", "refunded"].includes(order.status)) await refresh();
        if (!current || active.signal.aborted) return;
        if (notified !== order.status) {
          if (order.status === "paid") toast({ variant: "success", title: t("付款已确认", "Payment confirmed") });
          if (order.status === "refunded") toast({ title: t("退款已处理，账户已更新。", "Refund processed. Your account has been updated.") });
          if (order.status === "partially_paid") toast({ variant: "warning", title: t("付款金额不足，请返回收银台补足。", "Payment is incomplete. Return to checkout to pay the remainder.") });
          notified = order.status;
        }
        if (["paid", "refunded", "failed", "expired"].includes(order.status)) {
          attempt.current = null;
          const url = new URL(window.location.href);
          if (url.searchParams.get("order") === paymentId) {
            url.searchParams.delete("order");
            window.history.replaceState(window.history.state, "", url);
          }
          setPaymentId(null);
        }
      } catch { /* 暂时失联保留付款身份，返回窗口或下一轮继续核对。 */ }
      finally { window.clearTimeout(timeout); running = false; }
    }
    const onReturn = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    const timer = window.setInterval(onReturn, PAYMENT_POLL_MS);
    return () => {
      current = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [paymentId, refresh, t, toast]);

  async function start(intent: PurchaseIntent) {
    if (request.current) return;
    const signature = JSON.stringify(intent);
    if (attempt.current?.signature !== signature) attempt.current = { intent, signature, key: crypto.randomUUID() };
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let navigating = false;
    setState({ status: "loading" });
    try {
      let result = intent.kind === "credits"
        ? await createCreditCheckout({ pack_id: intent.pack_id, idempotency_key: attempt.current.key }, controller.signal)
        : await createCheckout({ plan_id: intent.plan_id, billing_interval: intent.billing_interval, idempotency_key: attempt.current.key }, controller.signal);
      if (controller.signal.aborted) throw new Error("Checkout aborted");
      if (result.status === "pending") {
        setPaymentId(result.order_id);
        rememberPayment(result.order_id);
        // 创建回包未知时只读取原付款，不自动创建另一笔。
        while (!controller.signal.aborted) {
          const order = await getOrder(result.order_id, controller.signal);
          if (request.current !== controller) return;
          if (controller.signal.aborted) throw new Error("Checkout timed out");
          if (order.status === "paid") {
            await refresh();
            if (request.current === controller && !controller.signal.aborted) setState({ status: "idle" });
            return;
          }
          if (order.checkout_url && !order.checkout_replacement_required && ["pending", "partially_paid"].includes(order.status)) {
            result = { status: "ready", order_id: order.id, checkout_url: order.checkout_url };
            break;
          }
          if (!["created", "creating", "pending"].includes(order.status) || order.checkout_replacement_required) throw new Error("Checkout is being checked");
          await new Promise<void>(resolve => {
            const finish = () => { window.clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
            const timer = window.setTimeout(finish, CHECKOUT_POLL_MS);
            controller.signal.addEventListener("abort", finish, { once: true });
          });
        }
      }
      if (request.current !== controller) return;
      if (controller.signal.aborted) throw new Error("Checkout timed out");
      if (result.status === "ready") {
        const url = checkoutUrl(result.checkout_url);
        if (result.order_id) { rememberPayment(result.order_id); setPaymentId(result.order_id); }
        openCheckout(url);
        navigating = !window.foluneDesktop;
        if (!navigating) setState({ status: "idle" });
      } else if (result.status === "unavailable") {
        setState({ status: "unavailable", message: intent.kind === "credits"
          ? t("积分购买即将开放。本次没有产生订单或扣款。", "Credit purchases are coming soon. No order or charge was created.")
          : t("在线订阅即将开放。本次没有产生订单或扣款。", "Subscriptions are coming soon. No order or charge was created.") });
      }
    } catch {
      if (request.current === controller) setState({ status: "error", message: controller.signal.aborted
        ? t("连接收银台超时，请重试。", "Checkout timed out. Please try again.")
        : t("暂时无法打开收银台，请重试。", "Unable to open checkout. Please try again.") });
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller && !navigating) request.current = null;
    }
  }
  return { state, start, reset, retry: () => { if (attempt.current) void start(attempt.current.intent); } };
}
