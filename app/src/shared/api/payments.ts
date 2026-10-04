/**
 * [INPUT]: 依赖统一 apiRequest 与服务端订单/审计接口
 * [OUTPUT]: 提供订单/旧报价替换标识、付款核对、收银台 URL 校验与 Web/桌面导航
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
export const getOrder = (id: string, signal?: AbortSignal) =>
  apiRequest<PaymentOrder>(`/billing/orders/${encodeURIComponent(id)}`, { signal });
export const refreshOrder = (id: string, admin = false, signal?: AbortSignal) =>
  apiRequest<PaymentOrder>(
    `/billing/${admin ? "admin/" : ""}orders/${encodeURIComponent(id)}/refresh`,
    { method: "POST", ...(admin ? { body: JSON.stringify({}) } : {}), signal },
  );
export function checkoutUrl(url: string) {
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
  return parsed.href;
}

export function openCheckout(url: string) {
  const target = checkoutUrl(url);
  // 桌面宿主把新窗口交给系统浏览器；Web 同页导航不依赖弹窗权限。
  if (window.foluneDesktop) window.open(target, "_blank", "noopener,noreferrer");
  else window.location.assign(target);
}
