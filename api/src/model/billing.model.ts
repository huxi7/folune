/**
 * [INPUT]: 依赖 AiDailyUsageStatus 与既有套餐标识
 * [OUTPUT]: 定义订阅快照、购买/每日积分投影、管理员能力和结账结果
 * [POS]: 目录、订单准备和已付权益分离，pending 不等于付款成功
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AiDailyUsageStatus } from "./ai.model.ts";

export type PaidPlanId = "starter" | "pro" | "studio";
export type PlanId = "free" | PaidPlanId;
export type BillingInterval = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export interface PlanPrice {
  amount: number;
  currency: "USD";
  interval: "month" | "year";
}

export interface BillingPlan {
  id: PlanId;
  name: string;
  description: string;
  prices: { monthly: PlanPrice; yearly: PlanPrice };
  daily_token_limit: number;
  credits: { daily: number; monthly: number };
  features: readonly string[];
  highlighted: boolean;
}

export interface SubscriptionRecord {
  user_id: string;
  plan_id: PaidPlanId;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface SubscriptionSnapshot {
  plan_id: PlanId;
  status: "free" | SubscriptionStatus;
  billing_interval: BillingInterval | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface BillingUsage extends AiDailyUsageStatus {
  resets_at: string;
  timezone: "UTC";
}

export interface CheckoutAvailability {
  available: boolean;
  provider: string | null;
}

export interface BillingCatalog {
  tokens_per_credit: number;
  plans: readonly BillingPlan[];
  checkout: CheckoutAvailability;
}

export type CreditPackId = "credits_500" | "credits_1000" | "credits_2000" | "credits_5000" | "credits_8000" | "credits_10000";

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  price: { amount: number; currency: "USD" };
}

export interface CreditPackCatalog {
  status: "preview" | "available";
  packs: readonly CreditPack[];
  tokens_per_credit: number;
  checkout: CheckoutAvailability;
}

export interface BillingOverview {
  is_payment_admin?: boolean;
  subscription: SubscriptionSnapshot;
  usage: BillingUsage;
  credits: { daily: number; monthly: number; used: number; balance: number; tokens_per_credit: number; resets_at: string; purchased?: number; daily_remaining?: number };
  checkout: CheckoutAvailability;
}

export type CheckoutResult = {
  status: "unavailable";
  code: "PAYMENT_NOT_CONFIGURED";
  message: string;
  checkout_url: null;
} | { status: "pending"; order_id: string; message: string; } | {
  status: "ready";
  checkout_url: string;
  order_id?: string;
};
