/**
 * [INPUT]: 依赖服务端套餐目录、aiUsageService 的同源权益/用量快照与 paymentProvider
 * [OUTPUT]: 对外提供套餐/积分目录、含换算比例/精确已用积分的账户概览和两类 checkout；积分预览不转化为订单或购买余额
 * [POS]: service 层订阅购买编排，选购不会修改订阅；只有支付适配器返回的真实会话可启动结账
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BILLING_PLANS, CREDIT_PACKS, CREDIT_PACK_STATUS, getBillingPlan, getCreditPack, TOKENS_PER_CREDIT } from "../config/billing-plans.ts";
import type { CreateCheckoutInput, CreateCreditCheckoutInput } from "../dto/billing.dto.ts";
import { paymentProvider } from "../lib/payment-provider.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { BillingCatalog, BillingOverview, CheckoutResult, CreditPackCatalog } from "../model/billing.model.ts";
import { aiUsageService } from "./ai-usage.service.ts";

export const billingService = {
  getCatalog(): BillingCatalog {
    return { tokens_per_credit: TOKENS_PER_CREDIT, plans: BILLING_PLANS, checkout: paymentProvider.availability };
  },

  getCreditPacks(): CreditPackCatalog {
    return {
      status: CREDIT_PACK_STATUS,
      packs: CREDIT_PACKS,
      tokens_per_credit: TOKENS_PER_CREDIT,
      checkout: { available: false, provider: null },
    };
  },

  async getOverview(authUser: AuthUser, accessToken: string): Promise<BillingOverview> {
    const account = await aiUsageService.getAccountUsage(authUser, accessToken);
    return {
      ...account,
      credits: {
        tokens_per_credit: TOKENS_PER_CREDIT,
        used: account.usage.total_tokens / TOKENS_PER_CREDIT,
        daily: account.usage.daily_limit / TOKENS_PER_CREDIT,
        monthly: getBillingPlan(account.subscription.plan_id).credits.monthly,
        balance: account.usage.remaining / TOKENS_PER_CREDIT,
        resets_at: account.usage.resets_at,
      },
      checkout: paymentProvider.availability,
    };
  },

  async createCheckout(authUser: AuthUser, input: CreateCheckoutInput): Promise<CheckoutResult> {
    const plan = getBillingPlan(input.plan_id);
    return paymentProvider.createCheckout({
      user_id: authUser.id,
      plan_id: input.plan_id,
      billing_interval: input.billing_interval,
      price: plan.prices[input.billing_interval],
    });
  },

  async createCreditCheckout(authUser: AuthUser, input: CreateCreditCheckoutInput): Promise<CheckoutResult> {
    // 预览目录必须显式开售后才允许接入支付；不可因订阅网关就绪而顺带卖积分。
    if (CREDIT_PACK_STATUS === "preview") {
      return { status: "unavailable", code: "PAYMENT_NOT_CONFIGURED", message: "积分购买即将开放", checkout_url: null };
    }
    return paymentProvider.createCreditCheckout({ user_id: authUser.id, pack: getCreditPack(input.pack_id) });
  },
};
