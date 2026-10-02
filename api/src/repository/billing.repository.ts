/**
 * [INPUT]: 依赖用户 JWT、唯一 supabase-rest 和 subscriptionRowsSchema
 * [OUTPUT]: 对外提供 owner-scoped 的 findSubscription，只读取订阅公开字段并净化存储错误
 * [POS]: repository 层订阅事实只读边界；不暴露支付平台标识、不提供客户端可调用的升降级写口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { HttpError } from "../common/http-error.ts";
import { subscriptionRowsSchema } from "../dto/billing.dto.ts";
import { createPostgrestQuery, supabaseRest } from "../lib/supabase-rest.ts";
import type { SubscriptionRecord } from "../model/billing.model.ts";

export const billingRepository = {
  async findSubscription(userId: string, accessToken: string): Promise<SubscriptionRecord | null> {
    const query = createPostgrestQuery({
      select: ["user_id", "plan_id", "status", "billing_interval", "current_period_start", "current_period_end", "cancel_at_period_end"],
      eq: { user_id: userId },
      limit: 1,
    });
    let payload: unknown;
    try {
      payload = await supabaseRest<unknown>(`billing_subscriptions${query}`, { accessToken });
    } catch (error) {
      if (error instanceof HttpError && error.code === "SUPABASE_REST_ERROR") {
        throw new HttpError(502, "BILLING_UNAVAILABLE", "订阅信息暂时不可用，请稍后重试。");
      }
      throw error;
    }
    const result = subscriptionRowsSchema.safeParse(payload);
    if (!result.success) {
      throw new HttpError(502, "BILLING_DATA_INVALID", "订阅信息暂时不可用，请稍后重试。");
    }
    return result.data[0] ?? null;
  },
};
