/**
 * [INPUT]: 依赖 aiRepository 的 findTodayUsage/incrementUsage、env.AI_DAILY_TOKEN_LIMIT、AuthUser 与 AiDailyUsageStatus
 * [OUTPUT]: 对外提供 getDailyStatus（按 UTC 日额度门禁判定）与 recordUsage（累加本轮真实 token 消耗后回读判定）
 * [POS]: service 层 AI 用量配额编排；每日上限来自配置，判定与累加都以验签用户身份经 RLS/受控 RPC 落地，不信任入参身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { env } from "../config/env.ts";
import type { AiDailyUsageStatus } from "../model/ai.model.ts";
import type { AuthUser } from "../model/auth.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";

// 与数据库 (now() at time zone 'utc')::date 同口径，避免服务端本地时区错位。
const utcToday = (): string => new Date().toISOString().slice(0, 10);

const toStatus = (
  usageDate: string,
  totalTokens: number,
): AiDailyUsageStatus => {
  const limit = env.AI_DAILY_TOKEN_LIMIT;
  return {
    usage_date: usageDate,
    total_tokens: totalTokens,
    daily_limit: limit,
    remaining: Math.max(0, limit - totalTokens),
    exceeded: totalTokens >= limit,
  };
};

const readStatus = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<AiDailyUsageStatus> => {
  const usageDate = utcToday();
  const row = await aiRepository.findTodayUsage(authUser.id, usageDate, accessToken);
  return toStatus(usageDate, row?.total_tokens ?? 0);
};

export const aiUsageService = {
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
    const total = await aiRepository.incrementUsage(
      authUser.id,
      Math.floor(tokens),
      accessToken,
    );
    return toStatus(utcToday(), total);
  },
};
