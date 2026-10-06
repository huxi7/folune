/**
 * [INPUT]: 依赖 Mastra 路由上下文、config/env、请求 Bearer JWT 与 upstream-http 的完整响应期限/只读重试
 * [OUTPUT]: 对外提供 authMiddleware，将 Supabase Auth 验证后的可信 userId 写入 RequestContext
 * [POS]: middleware 层身份信任边界；同 token 合并验证，单个请求取消不影响其他等待者；成功身份按摘要键缓存 45 秒、最多 1024 项，主动清理过期前缀，撤销延迟上限不变
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ContextWithMastra, Middleware } from "@mastra/core/server";
import { z } from "zod";

import { env } from "@/config/env";
import { fetchUpstreamResponse } from "@/lib/upstream-http";

type RouteMiddleware = Exclude<Middleware, { path: string }>;

const authUserSchema = z.object({
  id: z.uuid(),
});

const readBearerToken = (authorization: string | undefined): string | null => {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

// 与 api/src/service/auth.service.ts 保持相同的 TTL、容量与淘汰规则；两服务独立部署。
const IDENTITY_TTL_MS = 45_000;
const MAX_CACHED_IDENTITIES = 1_024;

// 缓存要活过请求，键只能是摘要——原始 token 禁止驻留、禁止落日志。
const resolvedIdentities = new Map<
  string,
  { userId: string; expiresAt: number }
>();

const identityKey = (accessToken: string): string =>
  new Bun.CryptoHasher("sha256").update(accessToken).digest("hex");

type IdentityResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 502; code: string; message: string };

const inFlightAuthentications = new Map<string, Promise<IdentityResult>>();
const upstreamUnavailable = (): IdentityResult => ({
  ok: false, status: 502, code: "AUTH_UPSTREAM_UNAVAILABLE",
  message: "Authentication service is unavailable",
});

const verifyIdentity = async (accessToken: string): Promise<IdentityResult> => {
  let response: Response;
  try {
    response = await fetchUpstreamResponse(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
      },
    }, { timeoutMs: 6_000, retryRead: true });
  } catch {
    return upstreamUnavailable();
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false, status: 401, code: "UNAUTHORIZED",
      message: "Invalid or expired access token",
    };
  }

  if (!response.ok) {
    return {
      ok: false, status: 502, code: "AUTH_UPSTREAM_ERROR",
      message: "Authentication service rejected the request",
    };
  }

  const user = authUserSchema.safeParse(await response.json().catch(() => null));

  if (!user.success) {
    return {
      ok: false, status: 502, code: "AUTH_UPSTREAM_ERROR",
      message: "Authentication service returned an invalid user",
    };
  }
  return { ok: true, userId: user.data.id };
};

const pruneResolvedIdentities = (now: number): void => {
  // 写入时按到期顺序排列，释放轮换后不会再被访问的旧 token 摘要。
  for (const [key, identity] of resolvedIdentities) {
    if (identity.expiresAt > now) break;
    resolvedIdentities.delete(key);
  }
};

const authenticate = (accessToken: string): Promise<IdentityResult> => {
  const key = identityKey(accessToken);
  const inFlight = inFlightAuthentications.get(key);
  if (inFlight) return inFlight;
  const now = Date.now();
  pruneResolvedIdentities(now);
  const cached = resolvedIdentities.get(key);
  if (cached && cached.expiresAt > now) return Promise.resolve({ ok: true, userId: cached.userId });
  resolvedIdentities.delete(key);

  // 查表/写表间不得 await，否则同 token 并发会穿透；失败结果随 finally 释放，永不缓存。
  const request = verifyIdentity(accessToken).then((result) => {
    if (result.ok) {
      const now = Date.now();
      pruneResolvedIdentities(now);
      if (resolvedIdentities.size >= MAX_CACHED_IDENTITIES) {
        const oldest = resolvedIdentities.keys().next().value;
        if (oldest !== undefined) resolvedIdentities.delete(oldest);
      }
      resolvedIdentities.set(key, { userId: result.userId, expiresAt: now + IDENTITY_TTL_MS });
    }
    return result;
  }).finally(() => {
    if (inFlightAuthentications.get(key) === request) inFlightAuthentications.delete(key);
  });
  inFlightAuthentications.set(key, request);
  return request;
};

const waitForIdentity = async (accessToken: string, signal: AbortSignal): Promise<IdentityResult> => {
  let onAbort: () => void = () => undefined;
  try {
    signal.throwIfAborted();
    // 共享验证仍受完整 HTTP 期限约束；取消只释放当前等待者，不误伤同 token 的其他请求。
    return await Promise.race([
      authenticate(accessToken),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      }),
    ]);
  } catch {
    return upstreamUnavailable();
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};

export const authMiddleware: RouteMiddleware = async (rawContext, next) => {
  const context = rawContext as ContextWithMastra;
  const accessToken = readBearerToken(context.req.header("Authorization"));
  if (!accessToken) {
    return context.json({ error: {
      code: "UNAUTHORIZED", message: "Missing or malformed bearer token",
    } }, 401);
  }
  const result = await waitForIdentity(accessToken, context.req.raw.signal);
  const identity = context.req.raw.signal.aborted ? upstreamUnavailable() : result;
  if (!identity.ok) {
    return context.json({ error: { code: identity.code, message: identity.message } }, identity.status);
  }

  context.get("requestContext").set("userId", identity.userId);
  await next();
};
