/**
 * [INPUT]: 依赖唯一目录、共享用量、统一支付 service 和受限管理员配置
 * [OUTPUT]: 提供目录、余额/每日用量、管理员能力与两类结账
 * [POS]: 订阅和积分复用同一内部订单/网关/发放链路，金额只能来自服务端
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BILLING_PLANS, CREDIT_PACKS, getBillingPlan, getCreditPack, TOKENS_PER_CREDIT } from "../config/billing-plans.ts";
import type { CreateCheckoutInput, CreateCreditCheckoutInput } from "../dto/billing.dto.ts";
import { env } from "../config/env.ts";
import { paymentService } from "./payment.service.ts";
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
      status: paymentProvider.availability.available ? "available" : "preview",
      packs: CREDIT_PACKS,
      tokens_per_credit: TOKENS_PER_CREDIT,
      checkout: paymentProvider.availability,
    };
  },

  async getOverview(authUser: AuthUser, accessToken: string): Promise<BillingOverview> {
    const account = await aiUsageService.getAccountUsage(authUser, accessToken);
    return {
      ...account,
      is_payment_admin:env.PAYMENT_ADMIN_IDS.includes(authUser.id),
      credits: {
        tokens_per_credit: TOKENS_PER_CREDIT,
        used: account.usage.total_tokens / TOKENS_PER_CREDIT,
        daily: account.usage.daily_limit / TOKENS_PER_CREDIT,
        monthly: getBillingPlan(account.subscription.plan_id).credits.monthly,
        balance: account.usage.remaining / TOKENS_PER_CREDIT,
        resets_at: account.usage.resets_at,
        ...(account.usage.purchased_tokens === undefined ? {} : { purchased: account.usage.purchased_tokens / TOKENS_PER_CREDIT, daily_remaining: (account.usage.daily_remaining ?? 0) / TOKENS_PER_CREDIT }),
      },
      checkout: paymentProvider.availability,
    };
  },

  async createCheckout(authUser: AuthUser, input: CreateCheckoutInput): Promise<CheckoutResult> {
    const plan = getBillingPlan(input.plan_id);
    return paymentService.checkout({ user_id:authUser.id, key:input.idempotency_key ?? crypto.randomUUID(), kind:"subscription", sku:input.plan_id,
      interval:input.billing_interval, amount:plan.prices[input.billing_interval].amount, tokens:0 });
  },

  async createCreditCheckout(authUser: AuthUser, input: CreateCreditCheckoutInput): Promise<CheckoutResult> {
    const pack=getCreditPack(input.pack_id);
    return paymentService.checkout({user_id:authUser.id,key:input.idempotency_key ?? crypto.randomUUID(),kind:"credits",sku:input.pack_id,
      interval:null,amount:pack.price.amount,tokens:pack.credits*TOKENS_PER_CREDIT});
  },
};
