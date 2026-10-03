/**
 * [INPUT]: 依赖订阅权益、支付钱包/用量事务和旧日用量仓储
 * [OUTPUT]: 提供购买积分与每日赠送合并门禁及带收据的记账
 * [POS]: 新账本优先消耗当日赠送后购买余额，记录实际用量不抹掉欠额；旧模式仅用于迁移窗口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { env } from "../config/env.ts";
import { paymentRepository } from "../repository/payment.repository.ts";
import type { AiDailyUsageStatus } from "../model/ai.model.ts";
import { HttpError } from "../common/http-error.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { BillingUsage, SubscriptionSnapshot } from "../model/billing.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";
import { subscriptionService } from "./subscription.service.ts";

// 与数据库 (now() at time zone 'utc')::date 同口径，避免服务端本地时区错位。
const utcToday = (): string => new Date().toISOString().slice(0, 10);

const toStatus = (
  usageDate: string,
  totalTokens: number,
  limit: number,
): AiDailyUsageStatus => {
  return {
    usage_date: usageDate,
    total_tokens: totalTokens,
    daily_limit: limit,
    remaining: Math.max(0, limit - totalTokens),
    exceeded: totalTokens >= limit,
  };
};

const getAccountUsage = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<{ subscription: SubscriptionSnapshot; usage: BillingUsage }> => {
  const usageDate = utcToday();
  if (env.BILLING_LEDGER_ENABLED) {
    const [row,balance,entitlement]=await Promise.all([paymentRepository.usage(authUser.id,usageDate),paymentRepository.wallet(authUser.id),subscriptionService.getEntitlement(authUser,accessToken)]);
    const dailyRemaining=Math.max(0,entitlement.dailyLimit-row.free_tokens_used);
    const remaining=dailyRemaining+Math.max(0,balance);
    const resets=new Date(`${usageDate}T00:00:00Z`);resets.setUTCDate(resets.getUTCDate()+1);
    return {subscription:entitlement.subscription,usage:{usage_date:usageDate,total_tokens:row.total_tokens,daily_limit:entitlement.dailyLimit,
      remaining,exceeded:remaining<=0,purchased_tokens:Math.max(0,balance),daily_remaining:dailyRemaining,resets_at:resets.toISOString(),timezone:"UTC"}};
  }
  const [row, entitlement] = await Promise.all([
    aiRepository.findTodayUsage(authUser.id, usageDate, accessToken),
    subscriptionService.getEntitlement(authUser, accessToken),
  ]);
  if (row && (row.user_id !== authUser.id || row.usage_date !== usageDate)) {
    throw new HttpError(502, "AI_USAGE_DATA_INVALID", "用量信息暂时不可用，请稍后重试。");
  }
  const resetsAt = new Date(`${usageDate}T00:00:00Z`);
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
  return {
    subscription: entitlement.subscription,
    usage: {
      ...toStatus(usageDate, row?.total_tokens ?? 0, entitlement.dailyLimit),
      resets_at: resetsAt.toISOString(),
      timezone: "UTC",
    },
  };
};

const readStatus = async (authUser: AuthUser, accessToken: string): Promise<AiDailyUsageStatus> =>
  (await getAccountUsage(authUser, accessToken)).usage;

export const aiUsageService = {
  getAccountUsage,
  getDailyStatus: readStatus,

  // 本轮真实 token（输入+输出总和）落账后回读；非正数不写库，只回读当前额度。
  async recordUsage(
    authUser: AuthUser,
    accessToken: string,
    tokens: number,
    usageId?: string,
  ): Promise<AiDailyUsageStatus> {
    if (!Number.isFinite(tokens) || tokens <= 0) {
      return readStatus(authUser, accessToken);
    }
    if (env.BILLING_LEDGER_ENABLED) {
      if (!usageId) throw new HttpError(400,"USAGE_ID_REQUIRED","用量记账缺少幂等标识。");
      const entitlement=await subscriptionService.getEntitlement(authUser,accessToken);
      await paymentRepository.recordUsage(authUser.id,usageId,Math.floor(tokens),entitlement.dailyLimit);
      return readStatus(authUser,accessToken);
    }
    await aiRepository.incrementUsage(
      authUser.id,
      Math.floor(tokens),
      accessToken,
    );
    // 以当前 UTC 日期重读，避免 RPC 恰跨午夜时把上一日累计量标成今日。
    return readStatus(authUser, accessToken);
  },
};
