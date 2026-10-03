/**
 * [INPUT]: 依赖统一 apiRequest 与服务端订阅/积分/权限投影
 * [OUTPUT]: 提供目录/余额/结账类型与接口，支持幂等键和 pending 订单
 * [POS]: 客户端只提交选购意图并展示权威事实，不把回跳当支付证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { apiRequest } from "./client";

export type PlanId = "free" | "starter" | "pro" | "studio";
export type BillingInterval = "monthly" | "yearly";
export type BillingPlan = {
  id: PlanId;
  name: string;
  description: string;
  prices: Record<BillingInterval, { amount: number; currency: "USD"; interval: "month" | "year" }>;
  daily_token_limit: number;
  credits: { daily: number; monthly: number };
  features: readonly string[];
  highlighted: boolean;
};
export type CheckoutAvailability = { available: boolean; provider: string | null };
export type BillingCatalog = { tokens_per_credit: number; plans: readonly BillingPlan[]; checkout: CheckoutAvailability };
export type BillingCredits = { daily: number; monthly: number; used: number; balance: number; tokens_per_credit: number; resets_at: string; purchased?: number; daily_remaining?: number };
export type BillingOverview = {
  is_payment_admin?: boolean;
  credits: BillingCredits;
  subscription: {
    plan_id: PlanId;
    status: "free" | "active" | "past_due" | "canceled" | "expired";
    billing_interval: BillingInterval | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  usage: {
    usage_date: string;
    total_tokens: number;
    daily_limit: number;
    remaining: number;
    exceeded: boolean;
    resets_at: string;
    timezone: "UTC";
  };
  checkout: CheckoutAvailability;
};
export type CheckoutResult =
  | { status: "unavailable"; code: "PAYMENT_NOT_CONFIGURED"; message: string; checkout_url: null }
  | { status: "ready"; checkout_url: string; order_id?: string }
  | { status: "pending"; order_id: string; message: string };

export type CreditPackId = "credits_500" | "credits_1000" | "credits_2000" | "credits_5000" | "credits_8000" | "credits_10000";
export type CreditPack = { id: CreditPackId; credits: number; price: { amount: number; currency: "USD" } };
export type CreditPackCatalog = {
  status: "preview" | "available";
  packs: readonly CreditPack[];
  tokens_per_credit: number;
  checkout: CheckoutAvailability;
};

export const getBillingCatalog = (signal?: AbortSignal) =>
  apiRequest<BillingCatalog>("/billing/plans", { signal });
export const getBillingOverview = (signal?: AbortSignal) =>
  apiRequest<BillingOverview>("/billing/overview", { signal });
export const createCheckout = (input: { plan_id: Exclude<PlanId, "free">; billing_interval: BillingInterval; idempotency_key?: string }, signal?: AbortSignal) =>
  apiRequest<CheckoutResult>("/billing/checkout", { method: "POST", body: JSON.stringify(input), signal });

export const getCreditPacks = (signal?: AbortSignal) =>
  apiRequest<CreditPackCatalog>("/billing/credits/packs", { signal });
export const createCreditCheckout = (input: { pack_id: CreditPackId; idempotency_key?: string }, signal?: AbortSignal) =>
  apiRequest<CheckoutResult>("/billing/credits/checkout", { method: "POST", body: JSON.stringify(input), signal });
