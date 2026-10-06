/**
 * [INPUT]: 依赖 lib/supabase-auth 的 Auth HTTP 适配器与 router 提取的用户 access token
 * [OUTPUT]: 对外提供 authService.authenticate，将 access token 转换为可信 AuthUser
 * [POS]: service 层认证用例；在途按 access token 合并同一校验，已完成身份按 SHA-256(token) 键入 45 秒 TTL/1024 项上限缓存，原始 token 不越过请求生命周期，不依赖 Hono Context，不记录、返回或持久化 token；撤销延迟上限即 TTL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getSupabaseAuthUser } from "../lib/supabase-auth.ts";
import type { AuthUser } from "../model/auth.model.ts";

// 撤销延迟上限即 TTL；调大即调大安全窗口，改动前先读 api/CLAUDE.md 分层禁令。
const IDENTITY_TTL_MS = 45_000;
const MAX_CACHED_IDENTITIES = 1_024;

// 在途键是原始 token，但随 finally 在请求结束时删除，不越过请求生命周期。
const inFlightAuthentications = new Map<string, Promise<AuthUser>>();

// 已完成身份要活过请求，因此键只能是摘要——原始 token 禁止驻留（api/CLAUDE.md 分层禁令）。
const resolvedIdentities = new Map<
  string,
  { user: AuthUser; expiresAt: number }
>();

// 必须同步：一旦引入 await，在途查表与写表之间就会出现微任务缝隙，并发去重随即失效。
const identityKey = (accessToken: string): string =>
  new Bun.CryptoHasher("sha256").update(accessToken).digest("hex");

const pruneResolvedIdentities = (now: number): void => {
  // 成功写入按到期顺序排列；从最早项释放，不等轮换后再也不会到来的旧 token。
  for (const [key, identity] of resolvedIdentities) {
    if (identity.expiresAt > now) break;
    resolvedIdentities.delete(key);
  }
};

export const authService = {
  authenticate(accessToken: string): Promise<AuthUser> {
    const inFlight = inFlightAuthentications.get(accessToken);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const now = Date.now();
    pruneResolvedIdentities(now);
    const key = identityKey(accessToken);
    const cached = resolvedIdentities.get(key);
    if (cached !== undefined) {
      if (cached.expiresAt > now) {
        return Promise.resolve(cached.user);
      }
      resolvedIdentities.delete(key);
    }

    const request = getSupabaseAuthUser(accessToken)
      .then((user) => {
        // 只缓存成功身份；401/502 永不入缓存，失效 token 过 TTL 后立即恢复拒绝。
        const now = Date.now();
        pruneResolvedIdentities(now);
        if (resolvedIdentities.size >= MAX_CACHED_IDENTITIES) {
          const oldestKey = resolvedIdentities.keys().next().value;
          if (oldestKey !== undefined) resolvedIdentities.delete(oldestKey);
        }
        resolvedIdentities.set(key, {
          user,
          expiresAt: now + IDENTITY_TTL_MS,
        });
        return user;
      })
      .finally(() => {
        if (inFlightAuthentications.get(accessToken) === request) {
          inFlightAuthentications.delete(accessToken);
        }
      });

    inFlightAuthentications.set(accessToken, request);
    return request;
  },

  // 模块级缓存跨测试文件存活，且四个测试文件共用同一 token 字面量；不清空则 401 与操作序列断言互相污染。
  resetIdentityCacheForTests(): void {
    inFlightAuthentications.clear();
    resolvedIdentities.clear();
  },
};
