/**
 * [INPUT]: 依赖 env 的免费与付费日额度，以及 BillingPlan 领域契约
 * [OUTPUT]: 对外提供唯一套餐/积分预览目录、10,000 token/积分换算与按 ID 读取的报价
 * [POS]: 价格与权益的单一来源；积分包仅作预览，不能改变每日额度或创建购买余额
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { BillingPlan, CreditPack, CreditPackId, PlanId } from "../model/billing.model.ts";
import { env } from "./env.ts";

export const TOKENS_PER_CREDIT = 10_000;
const ANNUAL_DISCOUNT = 0.2;

const sharedFeatures = [
  "AI 对话与写作 · 从提问到成稿",
  "引用笔记 · 围绕你的资料回答",
  "智能归档 · 自动找到合适的位置",
  "批量整理 · 一次处理多篇笔记",
  "知识画布 · 让相关想法彼此连接",
  "可撤销操作 · 每次改动都有余地",
  "云端同步 · 网页与桌面接续记录",
] as const;

const plan = (
  id: PlanId,
  name: string,
  description: string,
  monthlyAmount: number,
  dailyTokenLimit: number,
  highlighted = false,
): BillingPlan => Object.freeze({
  id, name, description,
  prices: Object.freeze({
    monthly: Object.freeze({ amount: monthlyAmount, currency: "USD", interval: "month" }),
    yearly: Object.freeze({ amount: Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)), currency: "USD", interval: "year" }),
  }),
  daily_token_limit: dailyTokenLimit,
  credits: Object.freeze({ daily: dailyTokenLimit / TOKENS_PER_CREDIT, monthly: 0 }),
  features: sharedFeatures,
  highlighted,
});

export const BILLING_PLANS: readonly BillingPlan[] = Object.freeze([
  plan("free", "Free", "从第一条记录，开始有序积累", 0, env.AI_DAILY_TOKEN_LIMIT),
  plan("starter", "Starter", "日常记录与轻量写作所需的一切", 500, env.AI_STARTER_DAILY_TOKEN_LIMIT),
  plan("pro", "Pro", "高频记录者的从容之选", 2_000, env.AI_PRO_DAILY_TOKEN_LIMIT, true),
  plan("studio", "Studio", "为长文创作与深度研究而生", 10_000, env.AI_STUDIO_DAILY_TOKEN_LIMIT),
]);

export const getBillingPlan = (id: PlanId): BillingPlan => BILLING_PLANS.find(item => item.id === id)!;

// ---- 积分包仍是预览目录；开售前必须另接可信支付和独立购买账本 ----
export const CREDIT_PACK_STATUS = "preview" as const;
const creditPack = (id: CreditPackId, credits: number, amount: number): CreditPack => Object.freeze({
  id, credits, price: Object.freeze({ amount, currency: "USD" }),
});
export const CREDIT_PACKS: readonly CreditPack[] = Object.freeze([
  creditPack("credits_500", 500, 500),
  creditPack("credits_1000", 1_000, 1_000),
  creditPack("credits_2000", 2_000, 2_000),
  creditPack("credits_5000", 5_000, 5_000),
  creditPack("credits_8000", 8_000, 8_000),
  creditPack("credits_10000", 10_000, 10_000),
]);
export const getCreditPack = (id: CreditPackId): CreditPack => CREDIT_PACKS.find(item => item.id === id)!;
