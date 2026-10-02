/**
 * [INPUT]: 依赖 aiRepository 的 findTodayUsage/incrementUsage、subscriptionService 的可信权益与 AuthUser
 * [OUTPUT]: 对外提供共享 getAccountUsage、Chat getDailyStatus 与 recordUsage，按同一 UTC 日和有效订阅上限编排
 * [POS]: service 层唯一 AI 用量口径；设置/订阅页与 Chat 门禁同源，计数只以验签用户身份经 RLS/受控 RPC 累加
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

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
  ): Promise<AiDailyUsageStatus> {
    if (!Number.isFinite(tokens) || tokens <= 0) {
      return readStatus(authUser, accessToken);
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
