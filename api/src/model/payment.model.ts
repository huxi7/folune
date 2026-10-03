/**
 * [INPUT]: 依赖计费领域的方案/周期概念
 * [OUTPUT]: 定义持久订单/汇率快照、权威付款事实和旧收银台替换提示
 * [POS]: 支付领域的数据边界；金额以美分整数或精确十进制字符串跨层传递
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type PaymentEnvironment = "sandbox" | "production";
export type OrderStatus =
  | "created"
  | "creating"
  | "pending"
  | "confirming"
  | "partially_paid"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "review";
export interface PaymentOrder {
  id: string;
  user_id: string;
  environment: PaymentEnvironment;
  idempotency_key: string;
  kind: "subscription" | "credits";
  sku: string;
  billing_interval: "monthly" | "yearly" | null;
  amount_cents: number;
  is_fixed_rate: boolean;
  credit_tokens: number;
  status: OrderStatus;
  invoice_id: string | null;
  payment_id: string | null;
  checkout_url: string | null;
  fulfilled_at: string | null;
  refunded_at: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
}
export interface VerifiedPayment {
  payment_id: string;
  invoice_id: string;
  order_id: string;
  payment_status: string;
  price_amount: string;
  price_currency: string;
  pay_amount: string;
  actually_paid: string;
  pay_currency: string;
  updated_at: string;
}
export const publicOrder = (order: PaymentOrder) => ({
  id: order.id,
  kind: order.kind,
  sku: order.sku,
  billing_interval: order.billing_interval,
  amount_cents: order.amount_cents,
  status: order.status,
  checkout_url: order.is_fixed_rate && !order.fulfilled_at ? null : order.checkout_url,
  checkout_replacement_required: Boolean(order.is_fixed_rate && !order.fulfilled_at && !order.refunded_at),
  created_at: order.created_at,
  fulfilled_at: order.fulfilled_at,
});
