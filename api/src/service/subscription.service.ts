/**
 * [INPUT]: 依赖可信 AuthUser、billingRepository 与服务端套餐目录
 * [OUTPUT]: 对外提供 getEntitlement，返回有效订阅快照及唯一日额度
 * [POS]: service 层付款事实到使用权益的授权边界；只有当前已生效且未到期的 active 记录能提权，用户资料与选购请求不参与授权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
