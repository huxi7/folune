/**
 * [INPUT]: 依赖统一 apiRequest 与后端 billing 的服务端报价、订阅事实和 UTC 日用量契约
 * [OUTPUT]: 对外提供套餐/积分包/概览/结账类型与 HTTP 入口、服务端积分事实与服务端精确积分投影
 * [POS]: shared/api 的订阅边界；客户端不保存付款事实、不决定权益，选购只请求真实结账状态
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
export type BillingCredits = { daily: number; monthly: number; used: number; balance: number; tokens_per_credit: number; resets_at: string };
export type BillingOverview = {
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
  | { status: "ready"; checkout_url: string };

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
export const createCheckout = (input: { plan_id: Exclude<PlanId, "free">; billing_interval: BillingInterval }, signal?: AbortSignal) =>
  apiRequest<CheckoutResult>("/billing/checkout", { method: "POST", body: JSON.stringify(input), signal });

export const getCreditPacks = (signal?: AbortSignal) =>
  apiRequest<CreditPackCatalog>("/billing/credits/packs", { signal });
export const createCreditCheckout = (input: { pack_id: CreditPackId }, signal?: AbortSignal) =>
  apiRequest<CheckoutResult>("/billing/credits/checkout", { method: "POST", body: JSON.stringify(input), signal });
