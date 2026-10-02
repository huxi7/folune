/**
 * [INPUT]: 依赖 AiDailyUsageStatus 的既有 UTC 日 token 口径
 * [OUTPUT]: 对外提供套餐/积分包目录、只读订阅事实、含服务端换算比例及精确已用积分的日额度快照与分别受控的订阅/积分支付适配契约
 * [POS]: model 层订阅领域边界；展示目录与付款事实分离，checkout 结果永不等于订阅生效
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
  subscription: SubscriptionSnapshot;
  usage: BillingUsage;
  credits: { daily: number; monthly: number; used: number; balance: number; tokens_per_credit: number; resets_at: string };
  checkout: CheckoutAvailability;
}

export type CheckoutResult = {
  status: "unavailable";
  code: "PAYMENT_NOT_CONFIGURED";
  message: string;
  checkout_url: null;
} | {
  status: "ready";
  checkout_url: string;
};

export interface PaymentProvider {
  availability: Readonly<CheckoutAvailability>;
  createCheckout(input: {
    user_id: string;
    plan_id: PaidPlanId;
    billing_interval: BillingInterval;
    price: PlanPrice;
  }): Promise<CheckoutResult>;
  createCreditCheckout(input: {
    user_id: string;
    pack: CreditPack;
  }): Promise<CheckoutResult>;
}
