/**
 * [INPUT]: 依赖已验证用户、旧订阅仓储及支付周期仓储
 * [OUTPUT]: 解析当前已付周期和唯一日额度，兼容历史订阅
 * [POS]: 权益唯一判定层；按当前时间选周期，不使用用户可编辑资料或前端成功信号
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { env } from "../config/env.ts";
import { paymentRepository } from "../repository/payment.repository.ts";
import { HttpError } from "../common/http-error.ts";
import { getBillingPlan } from "../config/billing-plans.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { SubscriptionSnapshot } from "../model/billing.model.ts";
import { billingRepository } from "../repository/billing.repository.ts";

export const subscriptionService = {
  async getEntitlement(authUser: AuthUser, accessToken: string): Promise<{
    subscription: SubscriptionSnapshot;
    dailyLimit: number;
  }> {
    if (env.BILLING_LEDGER_ENABLED) {
      const periods=await paymentRepository.periods(authUser.id);
      const now=Date.now();
      const current=periods.find(period=>Date.parse(period.starts_at)<=now && Date.parse(period.ends_at)>now);
      if (current) return { subscription:{plan_id:current.plan_id,status:"active" as const,billing_interval:current.billing_interval,
        current_period_start:current.starts_at,current_period_end:current.ends_at,cancel_at_period_end:true},dailyLimit:getBillingPlan(current.plan_id).daily_token_limit };
    }
    const row = await billingRepository.findSubscription(authUser.id, accessToken);
    if (row && row.user_id !== authUser.id) {
      throw new HttpError(403, "BILLING_ACCESS_DENIED", "无法读取其他账户的订阅信息。");
    }
    const now = Date.now();
    const ended = row !== null && Date.parse(row.current_period_end) <= now;
    const started = row !== null && Date.parse(row.current_period_start) <= now;
    const active = row !== null && row.status === "active" && started && !ended;
    const planId = active ? row.plan_id : "free";
    let status: SubscriptionSnapshot["status"] = row?.status ?? "free";
    if (status === "active" && !active) status = ended ? "expired" : "free";
    return {
      subscription: {
        plan_id: planId,
        status,
        billing_interval: row?.billing_interval ?? null,
        current_period_start: row?.current_period_start ?? null,
        current_period_end: row?.current_period_end ?? null,
        cancel_at_period_end: row?.cancel_at_period_end ?? false,
      },
      dailyLimit: getBillingPlan(planId).daily_token_limit,
    };
  },
};
