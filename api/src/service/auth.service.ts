/**
 * [INPUT]: 依赖 lib/supabase-auth 的 Auth HTTP 适配器与 router 提取的用户 access token
 * [OUTPUT]: 对外提供 authService.authenticate，将 access token 转换为可信 AuthUser
 * [POS]: service 层认证用例；仅在请求存活期间用 access token 合并同一在途校验，不缓存已完成身份，不依赖 Hono Context，不记录、返回或持久化 token
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getSupabaseAuthUser } from "../lib/supabase-auth.ts";
import type { AuthUser } from "../model/auth.model.ts";

const inFlightAuthentications = new Map<string, Promise<AuthUser>>();

export const authService = {
  authenticate(accessToken: string): Promise<AuthUser> {
    const inFlight = inFlightAuthentications.get(accessToken);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const request = getSupabaseAuthUser(accessToken).finally(() => {
      if (inFlightAuthentications.get(accessToken) === request) {
        inFlightAuthentications.delete(accessToken);
      }
    });

    inFlightAuthentications.set(accessToken, request);
    return request;
  },
};
