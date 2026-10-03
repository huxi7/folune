/**
 * [INPUT]: 依赖本人/管理员支付 API、useBilling 与统一 Dialog/Button
 * [OUTPUT]: 提供指定订单/历史弹窗、返回核对及审计；旧固定报价引导重新购买
 * [POS]: 订阅页的支付事实视图；轮询只请求服务器核对，不从 URL 推断成功
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import {
  getOrders,
  getOrder,
  refreshOrder,
  getOrderEvents,
  openCheckout,
  type PaymentOrder,
  type PaymentEvent,
} from "../shared/api/payments";
import { useBilling } from "../shared/api/useBilling";
import { useLocale } from "../shared/locale";
import { Button, Dialog } from "../shared/design-system/components";
const statusText: Record<string, [string, string]> = {
  created: ["准备中", "Preparing"],
  creating: ["核对收银台", "Checking checkout"],
  pending: ["等待付款", "Awaiting payment"],
  confirming: ["链上确认中", "Confirming"],
  partially_paid: ["金额不足", "Underpaid"],
  paid: ["付款已确认", "Payment confirmed"],
  failed: ["支付失败", "Failed"],
  expired: ["已过期", "Expired"],
  refunded: ["已退款", "Refunded"],
  review: ["需要人工核查", "Needs review"],
};
export function PaymentOrders({
  open,
  onClose,
  admin = false,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  admin?: boolean;
  orderId?: string;
}) {
  const { t } = useLocale();
  const { refresh } = useBilling();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [events, setEvents] = useState<PaymentEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let running = false;
    let settledState = "";
    setOrders([]);
    setEvents(null);
    setError(null);
    async function load() {
      if (running) return;
      running = true;
      try {
        const values = orderId && !admin
          ? [await getOrder(orderId, controller.signal)]
          : await getOrders(admin, controller.signal);
        if (controller.signal.aborted) return;
        setOrders(values);
        setError(null);
        const settled = values.filter(order => ["paid", "refunded"].includes(order.status))
          .map(order => `${order.id}:${order.status}`).join(",");
        if (settled && settled !== settledState) { settledState = settled; void refresh(); }
        const pending = values.find((order) =>
          ["pending", "confirming", "partially_paid", "creating"].includes(
            order.status,
          ),
        );
        if (pending) {
          const updated = await refreshOrder(
            pending.id,
            admin,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setOrders(
            values.map((order) => (order.id === updated.id ? updated : order)),
          );
          if (["paid", "refunded"].includes(updated.status)) await refresh();
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            t(
              "订单暂时无法刷新，请稍后重试。",
              "Unable to refresh orders. Try again.",
            ),
          );
      } finally {
        running = false;
      }
    }
    void load();
    const onReturn = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [open, admin, orderId, reload, refresh, t]);
  async function inspect(order?: PaymentOrder) {
    setBusy(true);
    try {
      setEvents(await getOrderEvents(order?.id));
    } catch {
      setError(t("无法读取日志。", "Unable to load events."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={
        admin
          ? t("支付管理", "Payment administration")
          : t("订单记录", "Order history")
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
        <p className="text-sm text-muted-foreground">
          {t(
            "付款确认后自动到账。订阅按购买顺序接续，不自动扣款；购买积分长期有效，每日额度优先使用。",
            "Confirmed payments are credited automatically. Subscription periods run in purchase order without automatic renewal. Purchased credits do not expire; daily credits are used first.",
          )}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <Button onClick={() => setReload((value) => value + 1)}>
          {t("刷新", "Refresh")}
        </Button>
        {admin ? (
          <Button disabled={busy} onClick={() => void inspect()}>
            {t("全部 IPN / 对账日志", "All IPN / reconciliation events")}
          </Button>
        ) : null}
        {!orders.length ? (
          <p>{t("暂无订单", "No orders yet")}</p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="flex flex-col gap-2 border-b border-border py-3"
            >
              <strong>
                {order.kind === "credits"
                  ? `${order.sku.replace("credits_", "")} ${t("积分", "credits")}`
                  : `Folune ${order.sku}`}{" "}
                · ${(order.amount_cents / 100).toFixed(2)}
              </strong>
              <span>
                {t(...(statusText[order.status] ?? ["核对中", "Checking"]))}
              </span>
              {order.checkout_replacement_required ? <>
                <p>{t("这笔订单使用旧报价，请返回选购以获取新的付款页面。", "This order uses an old quote. Return to purchase for a new checkout.")}</p>
                <Button onClick={onClose}>{t("返回选购", "Back to purchase")}</Button>
              </> : null}
              <small>
                {new Date(order.created_at).toLocaleString()} · {order.id}
              </small>
              {order.checkout_url &&
              !order.checkout_replacement_required &&
              ["pending", "partially_paid"].includes(order.status) ? (
                <Button onClick={() => openCheckout(order.checkout_url!)}>
                  {t("继续支付", "Continue payment")}
                </Button>
              ) : null}
              {admin ? (
                <Button disabled={busy} onClick={() => void inspect(order)}>
                  {t("查看 IPN / 对账记录", "View IPN / reconciliation events")}
                </Button>
              ) : null}
            </article>
          ))
        )}
        {events ? (
          <section
            aria-label={t("支付事件", "Payment events")}
            className="text-sm"
          >
            {events.map((event) => (
              <p key={event.id}>
                {new Date(event.received_at).toLocaleString()} · {event.source}{" "}
                · {event.outcome}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
