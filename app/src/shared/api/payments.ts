/**
 * [INPUT]: 依赖统一 apiRequest 与服务端订单/审计接口
 * [OUTPUT]: 提供订单/旧报价替换标识、付款核对和管理员日志访问
 * [POS]: 浏览器只请求和展示支付事实，不把跳转参数或本地状态当作付款依据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { apiRequest } from "./client";
export type PaymentOrder = {
  id: string;
  kind: "credits" | "subscription";
  sku: string;
  billing_interval: "monthly" | "yearly" | null;
  amount_cents: number;
  status: string;
  checkout_url: string | null;
  checkout_replacement_required?: boolean;
  created_at: string;
  fulfilled_at: string | null;
};
export type PaymentEvent = {
  id: string;
  source: string;
  outcome: string;
  provider_status: string | null;
  received_at: string;
};
export const getOrders = (admin = false, signal?: AbortSignal) =>
  apiRequest<PaymentOrder[]>(
    admin ? "/billing/admin/orders" : "/billing/orders",
    { signal },
  );
export const getOrder = (id: string, signal?: AbortSignal) =>
  apiRequest<PaymentOrder>(`/billing/orders/${encodeURIComponent(id)}`, { signal });
export const refreshOrder = (id: string, admin = false, signal?: AbortSignal) =>
  apiRequest<PaymentOrder>(
    `/billing/${admin ? "admin/" : ""}orders/${encodeURIComponent(id)}/refresh`,
    { method: "POST", ...(admin ? { body: JSON.stringify({}) } : {}), signal },
  );
export const getOrderEvents = (id: string | undefined, signal?: AbortSignal) =>
  apiRequest<PaymentEvent[]>(
    id
      ? `/billing/admin/orders/${encodeURIComponent(id)}/events`
      : "/billing/admin/events",
    { signal },
  );
export function openCheckout(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    ![
      "nowpayments.io",
      "sandbox.nowpayments.io",
      "account-sandbox.nowpayments.io",
    ].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error("Invalid checkout URL");
  window.open(parsed.href, "_blank", "noopener,noreferrer");
}
